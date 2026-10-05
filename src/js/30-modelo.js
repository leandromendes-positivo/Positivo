/* ==========================================================================
   Estado, carregamento, regras de negócio e números derivados.

   Documentos no banco:
     config/geral                regras e modelos de mensagem
     cadastro/tecnicos           { t: { tid: {chave,nome,apelido,regiao,tipo,meta,telefone,email,obs} } }
     dados/indice                arquivos importados por "tipo:regiao" (geração atual e anterior)
     dados/catalogo              { m: { codigoMaterial: descrição } }
     dados/<u|n>-<UF>-<geração>-<parte>   linhas compactas da foto atual
     acompanhamento/<tid>        previsões, observações e cobranças do técnico
     devolucoes/<AAAA-MM-DD>     peças usadas que saíram do relatório naquele dia
     historico/<AAAA-MM-DD>      totais do dia por técnico (gráfico de evolução)
     importacoes/<lote>          registro de cada importação
     resumo/atual                resumo dos próximos 7 dias (lido pela notificação diária)
   ========================================================================== */

const PADROES = {
  prazo: 7,          // dias máximos com peça usada
  alerta: 5,         // a partir de quantos dias avisar "vence em breve"
  meta: 10,          // peças novas por técnico
  tolerancia: 3,     // faixa aceitável: meta ± tolerância
  tiposIgnorados: [],
  msgCobranca:
    "{saudacao}, {nome}! Tudo bem?\n\n" +
    "No controle de peças consta que você está com {qtd} peça(s) usada(s) pendente(s) de devolução:\n\n" +
    "{lista}\n\n" +
    "O prazo para devolver é de {prazo} dias. Pode me passar uma previsão de quando vai devolver?\n\nObrigado!",
  msgLembrete:
    "{saudacao}, {nome}! Passando para lembrar das peças usadas que vencem o prazo de devolução nos próximos dias:\n\n" +
    "{lista}\n\nConsegue programar a devolução? Obrigado!",
};

const STATUS = {
  no_prazo: { rotulo: "No prazo", classe: "ok", icone: "ok" },
  vencendo: { rotulo: "Vence em breve", classe: "alerta", icone: "relogio" },
  atrasada: { rotulo: "Atrasada", classe: "crit", icone: "alerta" },
  aguardando: { rotulo: "Com previsão", classe: "info", icone: "calendario" },
  previsao_vencida: { rotulo: "Previsão vencida", classe: "crit", icone: "quebra" },
};
const STATUS_NOVAS = {
  abaixo: { rotulo: "Abaixo da meta", classe: "alerta", icone: "desce" },
  ideal: { rotulo: "Na meta", classe: "ok", icone: "ok" },
  acima: { rotulo: "Acima da meta", classe: "grave", icone: "sobe" },
  sem_meta: { rotulo: "Sem meta", classe: "neutro", icone: "info" },
};
const TIPOS_TEC = { tecnico: "Técnico", base: "Base / depósito", ignorar: "Ignorado" };

const E = {
  status: "carregando",
  erro: null,
  config: { ...PADROES },
  existe: {},          // quais documentos fixos já existem no banco
  indice: { arquivos: {}, anterior: {} },
  catalogo: {},
  cadastro: {},
  usadas: [],
  novas: [],
  acomp: {},
  historico: [],
  devolucoes: [],
  importacoes: [],
  usuario: { id: null, podeEscrever: null },
  versoesProprias: new Set(), // versões do índice gravadas por esta tela
  rev: 0,
  ouvintes: [],
};
const aoMudar = new Set();
function mudou() { E.rev++; for (const f of aoMudar) f(); }

const caminhoParte = (tipo, regiao, gen, parte) => `dados/${tipo === "usadas" ? "u" : "n"}-${regiao}-${gen}-${parte}`;

function decodificarUsada(l, regiao) {
  return { k: l[0], tid: l[1], regiao, nf: l[2], remessa: l[3], mat: l[4], chamado: l[5], dataFT: l[6] || null, qtd: l[7], desde: l[8], matSol: l[9] || "" };
}
const codificarUsada = (u) => [u.k, u.tid, u.nf, u.remessa, u.mat, u.chamado, u.dataFT || "", u.qtd, u.desde, u.matSol || ""];
function decodificarNova(l, regiao) {
  return { tid: l[0], regiao, mat: l[1], tipoEnvio: l[2], qtd: l[3], linhas: l[4], desde: l[5] };
}
const codificarNova = (n) => [n.tid, n.mat, n.tipoEnvio, n.qtd, n.linhas, n.desde];

/** Lê as partes de um arquivo do índice e devolve as linhas decodificadas. */
async function lerArquivoDoIndice(chave, ent) {
  const [tipo, regiao] = chave.split(":");
  const partes = await Promise.all(
    Array.from({ length: ent.partes || 0 }, (_, i) => Armazem.ler(caminhoParte(tipo, regiao, ent.gen, i)))
  );
  const linhas = [];
  for (const p of partes) if (p && Array.isArray(p.itens)) for (const l of p.itens) linhas.push(l);
  return linhas.map((l) => (tipo === "usadas" ? decodificarUsada(l, regiao) : decodificarNova(l, regiao)));
}

async function carregarFotos() {
  const usadas = [], novas = [];
  const entradas = Object.entries(E.indice.arquivos || {}).filter(([, ent]) => ent && ent.gen);
  const listas = await Promise.all(entradas.map(([chave, ent]) => lerArquivoDoIndice(chave, ent)));
  entradas.forEach(([chave], i) => (chave.startsWith("usadas:") ? usadas : novas).push(...listas[i]));
  E.usadas = usadas;
  E.novas = novas;
}

async function carregarHistoricos() {
  const corte = somaDias(hojeISO(), -120);
  const [hist, devs, imps] = await Promise.all([
    Armazem.consultar("historico", { onde: [["data", ">=", corte]] }),
    Armazem.consultar("devolucoes", { onde: [["data", ">=", corte]] }),
    Armazem.consultar("importacoes", { ordem: ["em", "desc"], limite: 40 }),
  ]);
  E.historico = hist.sort((a, b) => comparar(a.data, b.data));
  E.devolucoes = [];
  for (const d of devs) for (const l of d.itens || []) {
    E.devolucoes.push({ k: l[0], tid: l[1], mat: l[2], chamado: l[3], dataFT: l[4], qtd: l[5], em: l[6], dias: l[7], regiao: l[8], lote: l[9], doc: d.id });
  }
  E.importacoes = imps;
}

async function carregarTudo() {
  E.status = "carregando";
  mudou();
  try {
    const [config, indice, catalogo, cadastro, acomp] = await Promise.all([
      Armazem.ler("config/geral"),
      Armazem.ler("dados/indice"),
      Armazem.ler("dados/catalogo"),
      Armazem.ler("cadastro/tecnicos"),
      Armazem.consultar("acompanhamento"),
    ]);
    E.existe = { config: !!config, indice: !!indice, catalogo: !!catalogo, cadastro: !!cadastro };
    E.config = { ...PADROES, ...(config || {}) };
    E.indice = { arquivos: {}, anterior: {}, ...(indice || {}) };
    E.catalogo = (catalogo && catalogo.m) || {};
    E.cadastro = (cadastro && cadastro.t) || {};
    E.acomp = {};
    for (const a of acomp) E.acomp[a.id] = a;
    await Promise.all([carregarFotos(), carregarHistoricos()]);
    E.status = "pronto";
  } catch (e) {
    console.error(e);
    E.status = "erro";
    const amigavel = erroAmigavel(e);
    E.erro = amigavel.message;
    E.erroCodigo = amigavel.code;
  }
  mudou();
  assinarMudancas();
}

/** Mantém a tela em dia quando outro dispositivo importa ou edita. */
function assinarMudancas() {
  for (const parar of E.ouvintes) parar();
  E.ouvintes = [];
  if (!Armazem.online) return;
  let versaoIndice = E.indice.versao || 0;
  E.ouvintes.push(Armazem.ouvirDoc("dados/indice", async (d) => {
    if (!d || (d.versao || 0) === versaoIndice) return;
    versaoIndice = d.versao || 0;
    if (E.versoesProprias.has(versaoIndice)) return; // a própria importação desta tela
    E.indice = { arquivos: {}, anterior: {}, ...d };
    E.existe.indice = true;
    try {
      const cat = await Armazem.ler("dados/catalogo");
      E.catalogo = (cat && cat.m) || E.catalogo;
      await Promise.all([carregarFotos(), carregarHistoricos()]);
      mudou();
      if (typeof toast === "function") toast("Os dados foram atualizados em outro dispositivo.", "info");
    } catch (e) { console.warn(e); }
  }));
  E.ouvintes.push(Armazem.ouvirDoc("cadastro/tecnicos", (d) => {
    if (!d) return;
    E.cadastro = d.t || {};
    E.existe.cadastro = true;
    mudou();
  }));
  E.ouvintes.push(Armazem.ouvirDoc("config/geral", (d) => {
    if (!d) return;
    E.config = { ...PADROES, ...d };
    E.existe.config = true;
    mudou();
  }));
  E.ouvintes.push(Armazem.ouvirColecao("acompanhamento", (docs) => {
    const novo = {};
    for (const a of docs) novo[a.id] = a;
    E.acomp = novo;
    mudou();
  }));
}

// ============================================================ regras

function nomeTecnico(tid) {
  const t = E.cadastro[tid];
  if (!t) return tid;
  return limpar(t.apelido) || nomeBonito(t.nome) || tid;
}

function statusUsada(dias, previsao, cfg, hoje) {
  if (previsao && previsao < hoje) return "previsao_vencida";
  if (dias > cfg.prazo) return previsao ? "aguardando" : "atrasada";
  if (dias >= cfg.alerta) return "vencendo";
  return "no_prazo";
}
function statusNovas(qtd, meta, tol) {
  if (!meta) return "sem_meta";
  if (qtd < meta - tol) return "abaixo";
  if (qtd > meta + tol) return "acima";
  return "ideal";
}

let cacheDerivado = null;

/** Todos os números da tela, recalculados quando algo muda. */
function derivar() {
  const hoje = hojeISO();
  if (cacheDerivado && cacheDerivado.rev === E.rev && cacheDerivado.hoje === hoje) return cacheDerivado;
  const cfg = E.config;
  const prazo = Number(cfg.prazo) || 7;
  const tecs = new Map();

  function tec(tid, regiao) {
    let t = tecs.get(tid);
    if (t) return t;
    const c = E.cadastro[tid] || {};
    const metaPropria = c.meta === 0 || c.meta ? Number(c.meta) : null;
    t = {
      tid, cad: c,
      nome: limpar(c.apelido) || nomeBonito(c.nome) || tid,
      nomeOriginal: c.nome || tid,
      regiao: c.regiao || regiao || "",
      tipo: c.tipo || "tecnico",
      telefone: c.telefone || "", email: c.email || "", obs: c.obs || "",
      metaPropria,
      meta: metaPropria != null ? metaPropria : Number(cfg.meta) || 0,
      usadas: [], novasLinhas: [],
      regioes: new Set(),
    };
    tecs.set(tid, t);
    return t;
  }

  // ---- peças usadas
  const itens = [];
  for (const u of E.usadas) {
    const c = E.cadastro[u.tid];
    if (c && c.tipo === "ignorar") continue;
    const an = (E.acomp[u.tid] && E.acomp[u.tid].itens && E.acomp[u.tid].itens[u.k]) || {};
    const base = (u.dataFT || u.desde || hoje).slice(0, 10);
    const dias = Math.max(0, diffDias(base, hoje));
    const previsao = an.p || "";
    const status = statusUsada(dias, previsao, { ...cfg, prazo }, hoje);
    const t = tec(u.tid, u.regiao);
    t.regioes.add(u.regiao);
    const item = {
      ...u, desc: E.catalogo[u.mat] || "", dias, previsao, obs: an.o || "",
      nCobrancas: an.c || 0, ultimaCobranca: an.uc || "",
      status, cobrar: status === "atrasada" || status === "previsao_vencida",
      atrasada: dias > prazo, atraso: Math.max(0, dias - prazo), venceEm: prazo - dias,
      nome: t.nome, tipoTec: t.tipo,
    };
    itens.push(item);
    t.usadas.push(item);
  }

  // ---- peças novas
  const ignorados = new Set(cfg.tiposIgnorados || []);
  const tiposEnvio = new Map();
  for (const n of E.novas) {
    const c = E.cadastro[n.tid];
    if (c && c.tipo === "ignorar") continue;
    const t = tec(n.tid, n.regiao);
    t.regioes.add(n.regiao);
    tiposEnvio.set(n.tipoEnvio, (tiposEnvio.get(n.tipoEnvio) || 0) + n.qtd);
    t.novasLinhas.push({ ...n, desc: E.catalogo[n.mat] || "", conta: !ignorados.has(n.tipoEnvio), dias: Math.max(0, diffDias(n.desde, hoje)) });
  }
  // técnicos cadastrados sem peças continuam aparecendo (exceto ignorados)
  for (const [tid, c] of Object.entries(E.cadastro)) if (c.tipo !== "ignorar" && !tecs.has(tid)) tec(tid, c.regiao);

  // ---- histórico de devoluções (90 dias)
  const corte90 = somaDias(hoje, -90);
  const devPorTec = agrupar(E.devolucoes.filter((d) => d.em && d.em.slice(0, 10) >= corte90), (d) => d.tid);

  // ---- cobranças registradas
  const ultimaCob = (tid) => {
    const a = E.acomp[tid];
    const lista = (a && a.cobrancas) || [];
    return lista.length ? lista[lista.length - 1] : null;
  };

  const lista = [];
  for (const t of tecs.values()) {
    const u = t.usadas;
    u.sort((a, b) => b.dias - a.dias || comparar(a.chamado, b.chamado));
    t.nUsadas = somar(u, (i) => i.qtd);
    t.itensCobrar = u.filter((i) => i.cobrar);
    t.itensVencendo = u.filter((i) => i.status === "vencendo");
    t.itensAguardando = u.filter((i) => i.status === "aguardando");
    t.nCobrar = somar(t.itensCobrar, (i) => i.qtd);
    t.nAtrasadas = somar(u.filter((i) => i.atrasada), (i) => i.qtd);
    t.nVencendo = somar(t.itensVencendo, (i) => i.qtd);
    t.nAguardando = somar(t.itensAguardando, (i) => i.qtd);
    t.nPrevVencida = somar(u.filter((i) => i.status === "previsao_vencida"), (i) => i.qtd);
    t.maxDias = u.length ? u[0].dias : 0;
    const futuras = u.map((i) => i.previsao).filter((p) => p && p >= hoje).sort();
    t.proxPrevisao = futuras[0] || "";
    t.previsoesHoje = u.filter((i) => i.previsao === hoje);

    const contam = t.novasLinhas.filter((n) => n.conta);
    t.novasQtd = somar(contam, (n) => n.qtd);
    t.novasItens = contam.length;
    t.novasTodas = somar(t.novasLinhas, (n) => n.qtd);
    t.porTipo = {};
    for (const n of t.novasLinhas) t.porTipo[n.tipoEnvio] = (t.porTipo[n.tipoEnvio] || 0) + n.qtd;
    const tol = Number(cfg.tolerancia) || 0;
    t.metaMin = Math.max(0, t.meta - tol);
    t.metaMax = t.meta + tol;
    t.statusNovas = t.tipo === "tecnico" ? statusNovas(t.novasQtd, t.meta, tol) : "sem_meta";
    t.difNovas = t.novasQtd - t.meta;

    const cob = ultimaCob(t.tid);
    t.ultimaCobranca = cob;
    t.nCobrancas = ((E.acomp[t.tid] && E.acomp[t.tid].cobrancas) || []).length;

    const devs = devPorTec.get(t.tid) || [];
    t.devolvidas90 = somar(devs, (d) => d.qtd);
    t.mediaDiasDev = devs.length ? somar(devs, (d) => d.dias * d.qtd) / Math.max(1, t.devolvidas90) : null;
    t.noPrazoDev = devs.length ? somar(devs.filter((d) => d.dias <= prazo), (d) => d.qtd) / Math.max(1, t.devolvidas90) : null;

    if (!t.regiao && t.regioes.size) t.regiao = [...t.regioes][0];
    t.temDados = u.length > 0 || t.novasLinhas.length > 0;
    lista.push(t);
  }
  lista.sort((a, b) => comparar(a.nome, b.nome));

  // ---- totais
  const tecnicos = lista.filter((t) => t.tipo === "tecnico");
  const ativosTec = tecnicos.filter((t) => t.temDados);
  const cobrarTec = lista.filter((t) => t.nCobrar > 0)
    .sort((a, b) => (b.nPrevVencida > 0) - (a.nPrevVencida > 0) || b.maxDias - a.maxDias || b.nCobrar - a.nCobrar);
  const corte7 = somaDias(hoje, -6);
  const dev7 = E.devolucoes.filter((d) => d.em && d.em.slice(0, 10) >= corte7);
  const total = somar(itens, (i) => i.qtd);
  const kpi = {
    usadas: total,
    usadasTecnicos: lista.filter((t) => t.nUsadas > 0).length,
    atrasadas: somar(itens.filter((i) => i.atrasada), (i) => i.qtd),
    cobrarTecnicos: cobrarTec.length,
    cobrarPecas: somar(itens.filter((i) => i.cobrar), (i) => i.qtd),
    prevVencida: somar(itens.filter((i) => i.status === "previsao_vencida"), (i) => i.qtd),
    vencendo: somar(itens.filter((i) => i.status === "vencendo"), (i) => i.qtd),
    aguardando: somar(itens.filter((i) => i.status === "aguardando"), (i) => i.qtd),
    maisAntiga: itens.reduce((m, i) => Math.max(m, i.dias), 0),
    previsoesHoje: itens.filter((i) => i.previsao === hoje),
    devolvidas7: somar(dev7, (d) => d.qtd),
    devolvidas7NoPrazo: somar(dev7.filter((d) => d.dias <= prazo), (d) => d.qtd),
    temHistoricoDev: E.importacoes.filter((i) => !i.desfeito).length > 1 || E.devolucoes.length > 0,
    novas: somar(ativosTec, (t) => t.novasQtd),
    novasTecnicos: ativosTec.length,
    abaixo: ativosTec.filter((t) => t.statusNovas === "abaixo").length,
    ideal: ativosTec.filter((t) => t.statusNovas === "ideal").length,
    acima: ativosTec.filter((t) => t.statusNovas === "acima").length,
    bases: lista.filter((t) => t.tipo === "base" && t.temDados).length,
  };
  kpi.mediaNovas = ativosTec.length ? kpi.novas / ativosTec.length : 0;

  // ---- faixas de idade (gráfico)
  const alerta = Math.min(Number(cfg.alerta) || 5, prazo);
  const faixas = [
    { rotulo: `0–${Math.max(0, alerta - 1)}`, min: 0, max: alerta - 1, status: "ok" },
    { rotulo: `${alerta}–${prazo}`, min: alerta, max: prazo, status: "alerta" },
    { rotulo: `${prazo + 1}–${prazo * 2}`, min: prazo + 1, max: prazo * 2, status: "grave" },
  ];
  let ini = prazo * 2 + 1;
  for (const fim of [30, 60, 90]) if (fim >= ini) { faixas.push({ rotulo: `${ini}–${fim}`, min: ini, max: fim, status: "crit" }); ini = fim + 1; }
  faixas.push({ rotulo: `+${ini - 1}`, min: ini, max: Infinity, status: "crit" });
  for (const f of faixas) f.valor = somar(itens.filter((i) => i.dias >= f.min && i.dias <= f.max), (i) => i.qtd);

  // ---- por região
  const regioes = [...new Set([...itens.map((i) => i.regiao), ...E.novas.map((n) => n.regiao)])].sort();
  const porRegiao = regioes.map((r) => {
    const its = itens.filter((i) => i.regiao === r);
    const q = (f) => somar(its.filter(f), (i) => i.qtd);
    const tr = lista.filter((t) => t.tipo === "tecnico" && t.temDados && t.regiao === r);
    return {
      regiao: r,
      no_prazo: q((i) => i.status === "no_prazo"),
      vencendo: q((i) => i.status === "vencendo"),
      cobrar: q((i) => i.cobrar),
      aguardando: q((i) => i.status === "aguardando"),
      total: q(() => true),
      abaixo: tr.filter((t) => t.statusNovas === "abaixo").length,
      ideal: tr.filter((t) => t.statusNovas === "ideal").length,
      acima: tr.filter((t) => t.statusNovas === "acima").length,
      novas: somar(tr, (t) => t.novasQtd),
    };
  });

  // ---- atualização das planilhas
  const frescor = [];
  for (const r of new Set([...regioes, ...Object.keys(E.indice.arquivos || {}).map((k) => k.split(":")[1])])) {
    for (const tipo of ["novas", "usadas"]) {
      const ent = (E.indice.arquivos || {})[`${tipo}:${r}`];
      frescor.push({ regiao: r, tipo, em: ent ? ent.em : null, dias: ent ? diffDias(ent.em.slice(0, 10), hoje) : null, arquivo: ent ? ent.arquivo : "" });
    }
  }
  frescor.sort((a, b) => comparar(a.regiao, b.regiao) || comparar(a.tipo, b.tipo));

  cacheDerivado = {
    rev: E.rev, hoje, cfg: { ...cfg, prazo, alerta }, itens, tecnicos: lista, mapa: new Map(lista.map((t) => [t.tid, t])),
    cobrarTec, kpi, faixas, porRegiao, regioes, frescor,
    tiposEnvio: [...tiposEnvio.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
  return cacheDerivado;
}

// ============================================================ mensagens

function montarMensagem(t, itens, modelo) {
  const cfg = E.config;
  const max = 15;
  const ordenados = [...itens].sort((a, b) => b.dias - a.dias);
  let lista = ordenados.slice(0, max).map((i) =>
    `• ${i.desc || "Material"} (cód. ${i.mat})${i.chamado ? ` — chamado ${i.chamado}` : ""} — ${i.dias} ${i.dias === 1 ? "dia" : "dias"}`
  ).join("\n");
  if (ordenados.length > max) lista += `\n• ... e mais ${ordenados.length - max} peça(s)`;
  const valores = {
    saudacao: saudacao(), nome: primeiroNome(t.nome), nome_completo: t.nome,
    qtd: somar(itens, (i) => i.qtd), lista, prazo: cfg.prazo, regiao: t.regiao,
  };
  return String(modelo || "").replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));
}

// ============================================================ resumo diário

/**
 * Projeta, para hoje e os próximos 6 dias, quem precisará ser cobrado se nada
 * mudar. A notificação diária só lê o dia corrente deste documento.
 */
function montarResumo() {
  const D = derivar();
  const cfg = D.cfg;
  const hoje = D.hoje;
  const dias = {};
  for (let n = 0; n < 7; n++) {
    const dia = somaDias(hoje, n);
    const cobrar = [];
    let pend = 0, atr = 0;
    for (const t of D.tecnicos) {
      let pecas = 0, maxDias = 0, vencidas = 0;
      for (const i of t.usadas) {
        const d = Math.max(0, diffDias((i.dataFT || i.desde).slice(0, 10), dia));
        pend += i.qtd;
        if (d > cfg.prazo) atr += i.qtd;
        const prevVencida = i.previsao && i.previsao < dia;
        if ((d > cfg.prazo && !(i.previsao && i.previsao >= dia)) || prevVencida) {
          pecas += i.qtd;
          if (prevVencida) vencidas += i.qtd;
          maxDias = Math.max(maxDias, d);
        }
      }
      if (pecas) {
        const uc = t.ultimaCobranca;
        cobrar.push({
          nome: t.nome, regiao: t.regiao, tipo: t.tipo, pecas, maxDias, previsaoVencida: vencidas,
          telefone: t.telefone ? fmtTelefone(t.telefone) : "",
          ultimaCobranca: uc ? uc.em : "", proxPrevisao: t.proxPrevisao || "",
        });
      }
    }
    cobrar.sort((a, b) => b.maxDias - a.maxDias || b.pecas - a.pecas);
    const previsoes = [];
    for (const t of D.tecnicos) {
      const pecas = somar(t.usadas.filter((i) => i.previsao === dia), (i) => i.qtd);
      if (pecas) previsoes.push({ nome: t.nome, regiao: t.regiao, pecas });
    }
    dias[dia] = {
      cobrar: cobrar.slice(0, 60), totalTecnicos: cobrar.length,
      totalPecas: somar(cobrar, (c) => c.pecas), pendentes: pend, atrasadas: atr,
      previsoes: previsoes.slice(0, 30),
    };
  }
  const k = D.kpi;
  return {
    geradoEm: agoraISO(), hoje, prazo: cfg.prazo, meta: cfg.meta,
    dias,
    estoque: {
      abaixo: D.tecnicos.filter((t) => t.tipo === "tecnico" && t.temDados && t.statusNovas === "abaixo").map((t) => ({ nome: t.nome, regiao: t.regiao, qtd: t.novasQtd })).slice(0, 40),
      acima: k.acima, ideal: k.ideal, totalNovas: k.novas,
    },
    vencendoAmanha: somar(D.itens.filter((i) => i.dias === cfg.prazo), (i) => i.qtd),
    previsoesHoje: k.previsoesHoje.length,
    atualizacao: D.frescor.map((f) => ({ arquivo: `${f.regiao} ${f.tipo}`, em: f.em || "" })),
  };
}

let gravandoResumo = null;
const agendarResumo = debounce(async () => {
  if (!Armazem.online || E.status !== "pronto") return;
  try {
    gravandoResumo = Armazem.gravar("resumo/atual", montarResumo());
    await gravandoResumo;
  } catch (e) { console.warn("resumo", e); }
}, 2500);

/** Totais do dia para o gráfico de evolução (um documento por dia). */
async function gravarHistoricoDoDia() {
  const D = derivar();
  const t = {};
  for (const x of D.tecnicos) if (x.temDados) t[x.tid] = [x.nUsadas, x.nAtrasadas, x.maxDias, x.novasQtd];
  const doc = {
    data: D.hoje, em: agoraISO(), t,
    tot: {
      usadas: D.kpi.usadas, atrasadas: D.kpi.atrasadas, cobrarTec: D.kpi.cobrarTecnicos, cobrarPecas: D.kpi.cobrarPecas,
      novas: D.kpi.novas, abaixo: D.kpi.abaixo, ideal: D.kpi.ideal, acima: D.kpi.acima,
    },
  };
  await Armazem.gravar(`historico/${D.hoje}`, doc);
  E.historico = [...E.historico.filter((h) => h.data !== D.hoje), { id: D.hoje, ...doc }].sort((a, b) => comparar(a.data, b.data));
}

// ============================================================ edições

function docAcomp(tid) {
  return E.acomp[tid] || { itens: {}, cobrancas: [] };
}

/** Define (ou limpa, com "") a previsão de devolução de vários itens. */
async function definirPrevisao(itens, previsao) {
  const porTec = agrupar(itens, (i) => i.tid);
  for (const [tid, lista] of porTec) {
    const mud = {};
    for (const i of lista) mud[i.k] = { p: previsao || "" };
    const existe = !!E.acomp[tid];
    const atual = docAcomp(tid);
    const novo = { ...atual, itens: { ...(atual.itens || {}) } };
    for (const [k, v] of Object.entries(mud)) novo.itens[k] = { ...(novo.itens[k] || {}), ...v };
    E.acomp[tid] = novo;
    mudou();
    await Armazem.mesclar(`acompanhamento/${tid}`, existe ? { itens: mud, atualizadoEm: agoraISO() } : { itens: mud, cobrancas: [], atualizadoEm: agoraISO() }, existe);
  }
  agendarResumo();
}

async function definirObs(item, texto) {
  const tid = item.tid;
  const existe = !!E.acomp[tid];
  const atual = docAcomp(tid);
  E.acomp[tid] = { ...atual, itens: { ...(atual.itens || {}), [item.k]: { ...((atual.itens || {})[item.k] || {}), o: texto } } };
  mudou();
  const mud = { itens: { [item.k]: { o: texto } }, atualizadoEm: agoraISO() };
  if (!existe) mud.cobrancas = [];
  await Armazem.mesclar(`acompanhamento/${tid}`, mud, existe);
}

/** Registra uma cobrança feita ao técnico (e, opcionalmente, a previsão informada). */
async function registrarCobranca(tid, { canal, previsao, obs, itens }) {
  const atual = docAcomp(tid);
  const em = agoraISO();
  const reg = { em, canal: canal || "whatsapp", previsao: previsao || "", obs: obs || "", pecas: somar(itens, (i) => i.qtd), por: E.usuario.id || "" };
  const cobrancas = [...(atual.cobrancas || []), reg].slice(-80);
  // mantém só anotações de itens ainda pendentes ou com observação
  const ativos = new Set(E.usadas.filter((u) => u.tid === tid).map((u) => u.k));
  const itensDoc = {};
  for (const [k, v] of Object.entries(atual.itens || {})) if (ativos.has(k)) itensDoc[k] = v;
  for (const i of itens) {
    const ant = itensDoc[i.k] || {};
    itensDoc[i.k] = { ...ant, c: (ant.c || 0) + 1, uc: em, ...(previsao ? { p: previsao } : {}) };
  }
  const novo = { itens: itensDoc, cobrancas, atualizadoEm: em };
  E.acomp[tid] = { ...atual, ...novo };
  mudou();
  await Armazem.gravar(`acompanhamento/${tid}`, novo);
  agendarResumo();
}

async function salvarTecnico(tid, campos) {
  const atual = E.cadastro[tid] || {};
  E.cadastro = { ...E.cadastro, [tid]: { ...atual, ...campos } };
  mudou();
  await Armazem.mesclar("cadastro/tecnicos", { t: { [tid]: campos } }, E.existe.cadastro);
  E.existe.cadastro = true;
  agendarResumo();
}

async function salvarConfig(campos) {
  E.config = { ...E.config, ...campos };
  mudou();
  await Armazem.mesclar("config/geral", { ...campos, atualizadoEm: agoraISO() }, E.existe.config);
  E.existe.config = true;
  agendarResumo();
}
