/* ==========================================================================
   Banco no Firebase (quando o painel roda fora do Claude, ex.: GitHub Pages).

   - A configuração vem de window.CP_FIREBASE (embutida pelo build.py a partir
     de firebase-config.json) ou, enquanto não houver, do que foi colado em
     Configurações (guardado neste navegador).
   - Login com Google (Firebase Authentication). Quem pode ler e gravar é
     decidido pelas regras do Firestore (firestore.rules).
   - O adaptador abaixo oferece a mesma interface do banco do Claude
     (doc/collection/where/orderBy/limit/onSnapshot), então o resto do código
     não muda.
   ========================================================================== */

const FIREBASE_VERSAO = "10.14.1";
const CHAVE_CONFIG_LOCAL = "cp-firebase-config";

/** Como os dados estão sendo guardados nesta visualização. */
const Acesso = {
  modo: null,        // "claude" | "firebase" | "memoria"
  usuario: null,     // {uid, email, nome} no Firebase
  auth: null,
  projeto: "",
  configLocal: false,
};

function configFirebase() {
  const embutida = window.CP_FIREBASE;
  if (embutida && embutida.projectId && embutida.apiKey) return { ...embutida, origem: "site" };
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE_CONFIG_LOCAL) || "null");
    if (salva && salva.projectId && salva.apiKey) return { ...salva, origem: "navegador" };
  } catch (_) { /* navegador sem armazenamento */ }
  return null;
}

/** Aceita o trecho copiado do console ("const firebaseConfig = {...}") ou JSON. */
function lerTextoConfig(texto) {
  const campos = {};
  const re = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)["']?\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(String(texto || "")))) campos[m[1]] = m[2];
  if (!campos.apiKey || !campos.projectId) return null;
  if (!campos.authDomain) campos.authDomain = `${campos.projectId}.firebaseapp.com`;
  return campos;
}
function salvarConfigLocal(cfg) {
  try { localStorage.setItem(CHAVE_CONFIG_LOCAL, JSON.stringify(cfg)); return true; } catch (_) { return false; }
}
function apagarConfigLocal() {
  try { localStorage.removeItem(CHAVE_CONFIG_LOCAL); } catch (_) { /* nada a fazer */ }
}

function carregarScript(src) {
  return new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => falha(new Error("não consegui carregar " + src));
    document.head.appendChild(s);
  });
}
async function carregarSdkFirebase() {
  if (window.firebase && window.firebase.firestore && window.firebase.auth) return window.firebase;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}`;
  await carregarScript(`${base}/firebase-app-compat.js`);
  await Promise.all([carregarScript(`${base}/firebase-auth-compat.js`), carregarScript(`${base}/firebase-firestore-compat.js`)]);
  return window.firebase;
}

// O Firestore não aceita lista dentro de lista: as linhas compactas viram {cp_lista: [...]}.
const CAMPO_LISTA = "cp_lista";
function codificarFS(v, dentroDeLista = false) {
  if (Array.isArray(v)) {
    const lista = v.map((x) => codificarFS(x, true));
    return dentroDeLista ? { [CAMPO_LISTA]: lista } : lista;
  }
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = codificarFS(x, false);
    return o;
  }
  return v;
}
function decodificarFS(v) {
  if (Array.isArray(v)) return v.map(decodificarFS);
  if (v && typeof v === "object") {
    const chaves = Object.keys(v);
    if (chaves.length === 1 && chaves[0] === CAMPO_LISTA && Array.isArray(v[CAMPO_LISTA])) return v[CAMPO_LISTA].map(decodificarFS);
    const o = {};
    for (const k of chaves) o[k] = decodificarFS(v[k]);
    return o;
  }
  return v;
}

/** Códigos do Firestore -> códigos usados pelo resto do painel. */
function erroFirestore(e) {
  const mapa = {
    "permission-denied": "sem_permissao", unauthenticated: "sem_permissao",
    "resource-exhausted": "resource_exhausted", unavailable: "unavailable", "deadline-exceeded": "unavailable",
    "invalid-argument": "invalid_argument", "failed-precondition": "invalid_argument", "not-found": "invalid_argument",
  };
  const code = (e && mapa[e.code]) || "unavailable";
  return Object.assign(new Error((e && e.message) || "erro no Firestore"), { code, original: e });
}

function criarDbFirestore(fs) {
  const congelar = (o) => {
    if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const x of Object.values(o)) congelar(x); }
    return o;
  };
  const snapDoc = (s) => {
    let cache;
    return {
      id: s.id, exists: s.exists, metadata: s.metadata,
      data: () => (s.exists ? (cache || (cache = congelar(decodificarFS(s.data())))) : undefined),
    };
  };
  const snapConsulta = (s) => {
    const docs = s.docs.map(snapDoc);
    return { docs, size: docs.length, empty: !docs.length, metadata: s.metadata, docChanges: () => [] };
  };
  const proteger = (p) => p.catch((e) => { throw erroFirestore(e); });
  function consulta(q) {
    return {
      where: (f, op, v) => consulta(q.where(f, op, v)),
      orderBy: (f, dir = "asc") => consulta(q.orderBy(f, dir)),
      limit: (n) => consulta(q.limit(n)),
      get: () => proteger(q.get().then(snapConsulta)),
      onSnapshot: (next, erro) => q.onSnapshot((s) => next(snapConsulta(s)), (e) => erro && erro(erroFirestore(e))),
    };
  }
  function docRef(caminho) {
    const ref = fs.doc(caminho);
    return {
      id: ref.id, path: caminho,
      get: () => proteger(ref.get().then(snapDoc)),
      set: (dados) => proteger(ref.set(codificarFS(dados))),
      // como no banco do Claude: objetos aninhados se fundem, listas são trocadas
      update: (dados) => proteger(ref.set(codificarFS(dados), { merge: true })),
      delete: () => proteger(ref.delete()),
      onSnapshot: (next, erro) => ref.onSnapshot((s) => next(snapDoc(s)), (e) => erro && erro(erroFirestore(e))),
      collection: (sub) => colRef(caminho + "/" + sub),
    };
  }
  function colRef(caminho) {
    const col = fs.collection(caminho);
    return Object.assign(consulta(col), {
      path: caminho,
      doc: (id) => docRef(caminho + "/" + (id || col.doc().id)),
      add: async (dados) => { const r = docRef(caminho + "/" + col.doc().id); await r.set(dados); return r; },
    });
  }
  return { doc: docRef, collection: colRef };
}

/** Mostra a tela de entrada e espera a pessoa entrar com a conta Google. */
function pedirLogin(auth, firebase, mensagem = "") {
  return new Promise((resolver) => {
    const tela = document.getElementById("acesso");
    tela.hidden = false;
    tela.innerHTML = `<div class="acesso-tema">${document.getElementById("botao-tema").innerHTML}</div>
    <div class="acesso-cartao">
      <span class="logo-positivo" role="img" aria-label="Positivo Tecnologia"></span>
      <h1>Controle de Peças</h1>
      <p>Entre com a conta Google autorizada para ver e atualizar o painel.</p>
      ${mensagem ? `<p class="acesso-erro"></p>` : ""}
      <button class="btn prim grande" id="entrar-google">${icone("pessoa")}Entrar com Google</button>
      <small>Projeto: <span class="mono"></span></small>
    </div>`;
    Tema.atualizarBotoes();
    if (mensagem) tela.querySelector(".acesso-erro").textContent = mensagem;
    tela.querySelector("small .mono").textContent = Acesso.projeto;
    const parar = auth.onAuthStateChanged((u) => {
      if (!u) return;
      parar();
      tela.hidden = true;
      tela.innerHTML = "";
      resolver(u);
    });
    tela.querySelector("#entrar-google").addEventListener("click", async () => {
      const provedor = new firebase.auth.GoogleAuthProvider();
      provedor.setCustomParameters({ prompt: "select_account" });
      try {
        await auth.signInWithPopup(provedor);
      } catch (e) {
        if (e && /popup-blocked|operation-not-supported|cancelled-popup/.test(e.code || "")) {
          await auth.signInWithRedirect(provedor);
        } else if (e && e.code !== "auth/popup-closed-by-user") {
          const p = tela.querySelector(".acesso-erro") || Object.assign(document.createElement("p"), { className: "acesso-erro" });
          p.textContent = e.code === "auth/unauthorized-domain"
            ? "Este endereço ainda não foi autorizado no Firebase (Authentication → Configurações → Domínios autorizados)."
            : `Não foi possível entrar (${e.code || e.message}).`;
          tela.querySelector(".acesso-cartao").insertBefore(p, tela.querySelector("#entrar-google"));
        }
      }
    });
  });
}

/** Liga o Firebase, garante o login e devolve o banco já adaptado. */
async function iniciarFirebase(cfg) {
  const firebase = await carregarSdkFirebase();
  Acesso.projeto = cfg.projectId;
  Acesso.configLocal = cfg.origem === "navegador";
  const { origem, ...config } = cfg;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
  const auth = firebase.auth(app);
  const fs = firebase.firestore(app);
  fs.settings({ ignoreUndefinedProperties: true, merge: true });
  if (window.__CP_FIREBASE_EMULADOR__) {
    auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
    fs.useEmulator("127.0.0.1", 8080);
  }
  Acesso.auth = auth;
  try { await auth.getRedirectResult(); } catch (e) { console.warn("login por redirecionamento", e); }
  let usuario = await new Promise((ok) => { const parar = auth.onAuthStateChanged((u) => { parar(); ok(u); }); });
  if (window.__CP_LOGIN_TESTE__ && !usuario) {
    const cred = firebase.auth.GoogleAuthProvider.credential(JSON.stringify(window.__CP_LOGIN_TESTE__));
    usuario = (await auth.signInWithCredential(cred)).user;
  }
  if (!usuario) usuario = await pedirLogin(auth, firebase);
  Acesso.usuario = { uid: usuario.uid, email: usuario.email || "", nome: usuario.displayName || "" };
  return criarDbFirestore(fs);
}

/** Título e explicação do aviso "os dados não estão sendo salvos". */
function textoSemBanco() {
  if (window.claude) {
    return ["Os dados não estão sendo salvos", "Esta visualização não tem acesso ao banco de dados. Abra o painel pelo link do Claude, conectado à sua conta, para salvar as importações e as cobranças."];
  }
  if (Acesso.erroFirebase) {
    return ["Não consegui ligar o banco do Firebase", `Os dados não estão sendo salvos. Detalhe: ${Acesso.erroFirebase}`];
  }
  return ["Os dados não estão sendo salvos", "Configure o banco do Firebase em Configurações → Banco de dados para guardar as importações e as cobranças."];
}

async function sairDoFirebase() {
  if (Acesso.auth) await Acesso.auth.signOut();
  location.reload();
}
