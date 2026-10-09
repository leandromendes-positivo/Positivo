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
  sessao: crypto.randomUUID(),
  modo: null,        // "claude" | "firebase" | "memoria"
  usuario: null,     // {uid, email, nome} no Firebase
  auth: null, fs: null, perfil: null, pararPerfil: null,
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
  if (v && typeof v.toDate === "function") return dataHoraBrasilia(v.toDate());
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

/** Entrada federada; a autorização é verificada no banco antes de carregar dados. */
function pedirLogin(auth, firebase, mensagem = '') {
  return new Promise(resolver => {
    const tela = document.getElementById('acesso'); tela.hidden = false;
    tela.innerHTML = `<div class="circuitos-login" aria-hidden="true"><div class="circuito-grade"></div><svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice"><g class="trilhas"><path d="M0 180H250L400 330H620L750 200H1200"/><path d="M0 680H300L460 520H780L960 700H1200"/><path d="M200 0V170L360 330V660L220 800V900"/><path d="M980 0V280L850 410V620L1040 810V900"/><path d="M0 440H1200"/></g><g class="pulsos"><path d="M0 180H250L400 330H620L750 200H1200"/><path d="M0 680H300L460 520H780L960 700H1200"/><path d="M200 0V170L360 330V660L220 800V900"/></g><g class="nos"><circle cx="400" cy="330" r="5"/><circle cx="780" cy="520" r="5"/><circle cx="850" cy="410" r="5"/><circle cx="250" cy="180" r="5"/></g></svg></div>
      <div class="acesso-tema">${document.getElementById('botao-tema').innerHTML}</div>
      <div class="acesso-layout"><div class="acesso-apresentacao"><video class="login-video" autoplay muted loop playsinline preload="auto" poster="/*__LOGIN_POSTER__*/" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"><source src="/*__LOGIN_WEBM__*/" type="video/webm"><source src="/*__LOGIN_MP4__*/" type="video/mp4"></video></div>
      <div class="acesso-cartao"><span class="logo-positivo" role="img" aria-label="Positivo Tecnologia"></span><span class="acesso-etiqueta">ACESSO À OPERAÇÃO</span><h1>Entre na sua conta</h1><p>Use o e-mail autorizado pelo administrador.</p><p class="acesso-erro" role="alert" ${mensagem ? '' : 'hidden'}></p>
        <button class="btn grande acesso-provedor" id="entrar-google"><span class="marca-google" aria-hidden="true">G</span>Entrar com Google${icone('direita')}</button>
        <button class="btn grande acesso-provedor" id="entrar-microsoft"><span class="marca-microsoft" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Entrar com Microsoft${icone('direita')}</button>
        <small class="acesso-microsoft">Outlook, Hotmail ou conta corporativa do Microsoft 365.</small><div class="acesso-restrito">${icone('info')}Somente e-mails cadastrados podem acessar. Não há cadastro público.</div>
      </div></div><footer class="acesso-rodape">Positivo Tecnologia · Controle de Peças</footer>`;
    Tema.atualizarBotoes(); tela.querySelector('.acesso-erro').textContent = mensagem;
    const video = tela.querySelector('.login-video'), eventosVideo = new AbortController();
    const reproduzir = () => {
      if (video.isConnected && !document.hidden) { video.muted = true; video.play().catch(() => {}); }
    };
    reproduzir();
    // Retoma se o navegador suspender a aba ou exigir a primeira interação.
    document.addEventListener('visibilitychange', reproduzir, { signal: eventosVideo.signal });
    tela.addEventListener('pointerdown', reproduzir, { signal: eventosVideo.signal });
    tela.addEventListener('keydown', reproduzir, { signal: eventosVideo.signal });
    const parar = auth.onAuthStateChanged(u => {
      if (!u) return; parar(); eventosVideo.abort(); video.pause(); tela.hidden = true; tela.innerHTML = ''; resolver(u);
    });
    for (const tipo of ['google','microsoft']) tela.querySelector(`#entrar-${tipo}`).addEventListener('click', async () => {
      const p = tipo === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.OAuthProvider('microsoft.com');
      p.setCustomParameters(tipo === 'google' ? { prompt: 'select_account' } : { prompt: 'select_account', tenant: 'common' });
      tela.querySelectorAll('.acesso-provedor').forEach(b => b.disabled = true);
      try { await auth.signInWithPopup(p); }
      catch (e) {
        if (e.code === 'auth/popup-blocked') {
          try { await auth.signInWithRedirect(p); return; } catch (erro) { e = erro; }
        }
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
          const erros = {
            'auth/operation-not-allowed': 'Esta opção de entrada ainda precisa ser habilitada pelo administrador.',
            'auth/unauthorized-domain': 'O endereço deste painel precisa ser autorizado no Firebase pelo administrador.',
            'auth/account-exists-with-different-credential': 'Este e-mail já usa outro provedor. Entre pela opção usada no primeiro acesso; o administrador pode orientar a vinculação das contas.',
            'auth/network-request-failed': 'Confira sua conexão e tente novamente.',
          };
          const aviso = tela.querySelector('.acesso-erro'); if (aviso) { aviso.hidden = false; aviso.textContent = erros[e.code] || 'Não foi possível entrar. Tente novamente ou consulte o administrador.'; }
        }
      } finally { tela.querySelectorAll('.acesso-provedor').forEach(b => b.disabled = false); }
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
  if (window.__CP_FIREBASE_EMULADOR__ && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
    fs.useEmulator("127.0.0.1", 8080);
  }
  Acesso.auth = auth; Acesso.fs = fs;
  await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  try { await auth.getRedirectResult(); } catch (e) { console.warn("login por redirecionamento", e); }
  let usuario = await new Promise((ok) => { const parar = auth.onAuthStateChanged((u) => { parar(); ok(u); }); });
  if (window.__CP_FIREBASE_EMULADOR__ && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.__CP_LOGIN_TESTE__ && !usuario) {
    const cred = firebase.auth.GoogleAuthProvider.credential(JSON.stringify(window.__CP_LOGIN_TESTE__));
    usuario = (await auth.signInWithCredential(cred)).user;
  }
  if (!usuario) usuario = await pedirLogin(auth, firebase);
  await usuario.reload();
  await usuario.getIdToken(true);
  Acesso.usuario = { uid: usuario.uid, email: usuario.email || '', nome: primeiroNomeEmail(usuario.email), verificado: usuario.emailVerified };
  try {
    const ref = fs.doc(`usuarios/${usuario.email.toLowerCase()}`);
    const perfil = await ref.get({ source: 'server' });
    if (!usuario.emailVerified || !perfil.exists || !perfil.data().ativo || !PERFIS[perfil.data().perfil]) throw new Error('sem_permissao');
    const versao = await fs.doc('seguranca/controle').get({ source: 'server' });
    if (versao.data()?.versao !== 2) throw new Error('seguranca_pendente');
    Acesso.perfil = decodificarFS(perfil.data());
    Acesso.usuario.nome = nomeDaConta().split(' ')[0];
    Acesso.pararPerfil?.();
    Acesso.pararPerfil = ref.onSnapshot(s => {
      if (s.metadata.hasPendingWrites) return;
      if (!s.exists || !s.data().ativo || !PERFIS[s.data().perfil]) { bloquearSessao(); return; }
      const mudouPerfil = Acesso.perfil?.perfil !== s.data().perfil;
      const mudouNome = Acesso.perfil?.nome !== s.data().nome;
      Acesso.perfil = decodificarFS(s.data());
      Acesso.usuario.nome = nomeDaConta().split(' ')[0];
      if (mudouPerfil && E.status === 'pronto') {
        E.usuarios = [];
        if (!podeAdministrar()) fecharModaisAdministrativos();
        assinarMudancas(); montarMoldura();
        // Mudanças de permissão não aguardam a pessoa sair de um campo em edição.
        renderizar(true);
      }
      if ((mudouPerfil || mudouNome) && E.status === 'pronto') mudou();
    }, () => bloquearSessao());
    auth.onAuthStateChanged(u => { if (Acesso.perfil && (!u || u.uid !== Acesso.usuario?.uid)) bloquearSessao('Sua sessão foi alterada ou encerrada. Entre novamente.'); });
  } catch (e) {
    Acesso.perfil = null;
    Acesso.negado = !usuario.emailVerified ? 'Confirme a propriedade deste e-mail antes de acessar.'
      : e.message === 'seguranca_pendente' ? 'O administrador precisa concluir a configuração de segurança do painel.'
      : 'Este e-mail não tem acesso ativo. Solicite autorização ao administrador.';
  }
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
  OutlookCobranca.desconectar();
  if (Acesso.auth) await Acesso.auth.signOut();
  location.reload();
}
