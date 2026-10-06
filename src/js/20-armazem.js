/* ==========================================================================
   Armazenamento.
   - Online: banco de documentos do Claude (capability "db"), compartilhado
     entre os seus dispositivos.
   - Sem conexão com o banco: o mesmo formato em memória (nada é salvo).
   ========================================================================== */

/** Banco em memória com a mesma interface usada aqui (doc/collection/where...). */
function criarDbMemoria() {
  const docs = new Map(); // caminho -> {dados, versao}
  const ouvintesDoc = new Map();
  const ouvintesCol = new Set();
  const clonar = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  // como no banco do Claude, o que a leitura entrega vem congelado
  const congelar = (o) => {
    if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) congelar(v); }
    return o;
  };
  const pai = (caminho) => caminho.split("/").slice(0, -1).join("/");
  const erro = (code, message) => Object.assign(new Error(message), { code });

  function validar(caminho, par) {
    const seg = caminho.split("/");
    if (seg.some((s) => !/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(s) || s === "." || s === ".."))
      throw new TypeError("caminho inválido: " + caminho);
    if ((seg.length % 2 === 0) !== par) throw new TypeError("paridade inválida: " + caminho);
  }
  function snapDoc(caminho) {
    const d = docs.get(caminho);
    return {
      id: caminho.split("/").pop(), exists: !!d,
      data: () => (d ? congelar(clonar(d.dados)) : undefined),
      metadata: { fromCache: false, hasPendingWrites: false },
    };
  }
  function mesclarProfundo(alvo, origem) {
    for (const [k, v] of Object.entries(origem)) {
      if (v && typeof v === "object" && !Array.isArray(v) && alvo[k] && typeof alvo[k] === "object" && !Array.isArray(alvo[k])) {
        mesclarProfundo(alvo[k], v);
      } else alvo[k] = clonar(v);
    }
  }
  function compara(op, a, b) {
    switch (op) {
      case "==": return a === b;
      case "!=": return a !== b;
      case "<": return a < b;
      case "<=": return a <= b;
      case ">": return a > b;
      case ">=": return a >= b;
      case "in": return Array.isArray(b) && b.includes(a);
      case "not-in": return Array.isArray(b) && !b.includes(a);
      case "array-contains": return Array.isArray(a) && a.includes(b);
      default: throw erro("invalid_argument", "operador inválido " + op);
    }
  }
  function executar(col, filtros, ordem, limite) {
    let lista = [];
    for (const [caminho, d] of docs) if (pai(caminho) === col) lista.push(caminho);
    lista = lista.filter((c) => filtros.every(([f, op, v]) => {
      const dado = docs.get(c).dados[f];
      return dado !== undefined && compara(op, dado, v);
    }));
    lista.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (ordem) {
      const [f, dir] = ordem;
      lista.sort((a, b) => {
        const x = docs.get(a).dados[f], y = docs.get(b).dados[f];
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        const r = x < y ? -1 : x > y ? 1 : 0;
        return dir === "desc" ? -r : r;
      });
    }
    if (limite) lista = lista.slice(0, limite);
    const snaps = lista.map(snapDoc);
    return { docs: snaps, size: snaps.length, empty: !snaps.length, docChanges: () => snaps.map((doc, i) => ({ type: "added", doc, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function avisar(caminho) {
    const set = ouvintesDoc.get(caminho);
    if (set) for (const cb of set) setTimeout(() => cb(snapDoc(caminho)), 0);
    const col = pai(caminho);
    for (const o of ouvintesCol) if (o.col === col) setTimeout(() => o.cb(executar(o.col, o.filtros, o.ordem, o.limite)), 0);
  }
  function consulta(col, filtros = [], ordem = null, limite = null) {
    return {
      where: (f, op, v) => consulta(col, [...filtros, [f, op, v]], ordem, limite),
      orderBy: (f, dir = "asc") => consulta(col, filtros, [f, dir], limite),
      limit: (n) => consulta(col, filtros, ordem, n),
      get: async () => executar(col, filtros, ordem, limite),
      onSnapshot(next) {
        const o = { col, filtros, ordem, limite, cb: next };
        ouvintesCol.add(o);
        setTimeout(() => next(executar(col, filtros, ordem, limite)), 0);
        return () => ouvintesCol.delete(o);
      },
    };
  }
  function docRef(caminho) {
    validar(caminho, true);
    return {
      id: caminho.split("/").pop(), path: caminho,
      get: async () => snapDoc(caminho),
      async set(dados) {
        const atual = docs.get(caminho);
        docs.set(caminho, { dados: clonar(dados), versao: atual ? atual.versao + 1 : 1 });
        avisar(caminho);
      },
      async update(dados) {
        const atual = docs.get(caminho);
        if (!atual) throw erro("invalid_argument", "documento não existe: " + caminho);
        mesclarProfundo(atual.dados, dados);
        atual.versao++;
        avisar(caminho);
      },
      async delete() { docs.delete(caminho); avisar(caminho); },
      onSnapshot(next) {
        let set = ouvintesDoc.get(caminho);
        if (!set) ouvintesDoc.set(caminho, (set = new Set()));
        set.add(next);
        setTimeout(() => next(snapDoc(caminho)), 0);
        return () => set.delete(next);
      },
      collection: (sub) => colRef(caminho + "/" + sub),
    };
  }
  function colRef(caminho) {
    validar(caminho, false);
    return Object.assign(consulta(caminho), {
      path: caminho,
      doc: (id) => docRef(caminho + "/" + (id || "d" + Math.random().toString(36).slice(2, 12))),
      async add(dados) { const r = docRef(caminho + "/d" + Math.random().toString(36).slice(2, 12)); await r.set(dados); return r; },
    });
  }
  return {
    doc: docRef, collection: colRef,
    exportar() { const o = {}; for (const [c, d] of docs) o[c] = clonar(d.dados); return o; },
    carregar(o) { for (const [c, d] of Object.entries(o)) docs.set(c, { dados: clonar(d), versao: 1 }); },
  };
}

const MSG_ERRO_DB = {
  quota_exceeded: "O espaço do banco de dados acabou. Procure o administrador para ampliar a capacidade e preservar o histórico.",
  invalid_argument: "Você não tem permissão para alterar estes dados, ou o dado é inválido.",
  revoked: "O acesso ao banco de dados foi retirado desta página. Recarregue a página.",
  not_granted: "Esta visualização não tem acesso ao banco de dados.",
  resource_exhausted: "Muitas gravações seguidas. Aguarde alguns segundos e tente de novo.",
  unavailable: "O banco de dados não respondeu. Verifique a internet e tente de novo.",
  sem_permissao: "Esta conta não tem permissão para realizar a ação. Procure o administrador do painel.",
};
function erroAmigavel(e) {
  if (e && e.amigavel) return e;
  const code = (e && e.code) || "unavailable";
  const msg = MSG_ERRO_DB[code] || (e && e.message) || "Erro desconhecido ao acessar os dados.";
  return Object.assign(new Error(msg), { code, amigavel: true, original: e });
}

const Armazem = {
  db: null,
  online: false,
  fila: Promise.resolve(),

  /** Ordem: banco do Claude (página publicada lá) > Firebase (site próprio) > memória. */
  async iniciar() {
    let db = null;
    if (!window.__CP_SEM_DB__) {
      try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (_) { db = null; }
    }
    if (db) {
      Object.assign(this, { db, online: true });
      Acesso.modo = "claude";
      return true;
    }
    const cfg = window.__CP_SEM_DB__ ? null : configFirebase();
    if (cfg) {
      Acesso.modo = "firebase";
      try {
        Object.assign(this, { db: await iniciarFirebase(cfg), online: true });
        return true;
      } catch (e) {
        console.error(e);
        Acesso.erroFirebase = (e && e.message) || String(e);
        throw e; // produção nunca cai silenciosamente em armazenamento temporário
      }
    }
    Acesso.modo = "memoria";
    Object.assign(this, { db: criarDbMemoria(), online: false });
    return false;
  },

  /** Repete em falhas passageiras (rede/limite de ritmo). */
  async tentar(fn) {
    let espera = 700;
    for (let t = 0; ; t++) {
      try { return await fn(); } catch (e) {
        const code = e && e.code;
        if (code === "unavailable" && t < 2) { await sleep(300 + Math.random() * 700); continue; }
        if (code === "resource_exhausted" && t < 6) { await sleep(espera + Math.random() * 500); espera *= 2; continue; }
        throw erroAmigavel(e);
      }
    }
  },
  /** Gravações uma de cada vez, na ordem em que foram pedidas. */
  enfileirar(fn) {
    const p = this.fila.then(() => this.tentar(fn));
    this.fila = p.catch(() => {});
    return p;
  },

  async ler(caminho) {
    const snap = await this.tentar(() => this.db.doc(caminho).get());
    return snap.exists ? snap.data() : null;
  },
  gravar(caminho, dados) { return this.enfileirar(() => this.db.doc(caminho).set(dados)); },
  /** Mescla campos (objetos aninhados se fundem; listas são trocadas). */
  mesclar(caminho, dados, existe) {
    return this.enfileirar(async () => {
      const ref = this.db.doc(caminho);
      if (existe === false) return ref.set(dados);
      try { return await ref.update(dados); } catch (e) {
        if (e && e.code === "invalid_argument" && existe !== true) {
          const snap = await ref.get();
          if (!snap.exists) return ref.set(dados);
        }
        throw e;
      }
    });
  },
  apagar(caminho) { return this.enfileirar(() => this.db.doc(caminho).delete()); },
  async consultar(colecao, { onde = [], ordem = null, limite = null } = {}) {
    let q = this.db.collection(colecao);
    for (const [f, op, v] of onde) q = q.where(f, op, v);
    if (ordem) q = q.orderBy(ordem[0], ordem[1] || "asc");
    if (limite) q = q.limit(limite);
    const snap = await this.tentar(() => q.get());
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  ouvirDoc(caminho, cb) {
    try {
      return this.db.doc(caminho).onSnapshot((s) => cb(s.exists ? s.data() : null), (e) => console.warn("assinatura", caminho, e));
    } catch (e) { console.warn(e); return () => {}; }
  },
  ouvirColecao(colecao, cb, montar) {
    try {
      let q = this.db.collection(colecao);
      if (montar) q = montar(q);
      return q.onSnapshot((s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.warn("assinatura", colecao, e));
    } catch (e) { console.warn(e); return () => {}; }
  },
};
