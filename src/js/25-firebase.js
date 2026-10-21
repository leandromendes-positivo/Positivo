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

// Relatório limitado a sinais técnicos; nunca lê ou exibe credenciais armazenadas.
function diagnosticoSessao(auth) {
  let armazenamento = 'bloqueado';
  const chave = 'cp-diagnostico-' + crypto.randomUUID();
  try {
    localStorage.setItem(chave, '1');
    armazenamento = localStorage.getItem(chave) === '1' ? 'disponível' : 'bloqueado';
  } catch (_) { /* apenas informa a disponibilidade */ }
  finally { try { localStorage.removeItem(chave); } catch (_) {} }
  return [
    'Versão: /*__VERSAO_ACESSO__*/',
    'Endereço: ' + location.origin + location.pathname,
    'Destino: ' + (location.hash === '#ferias' ? 'Férias da equipe' : 'Painel'),
    'Armazenamento local: ' + armazenamento,
    'Sessão reconhecida nesta aba: ' + (auth?.currentUser ? 'sim' : 'não'),
    'Janela incorporada: ' + (window.top !== window.self ? 'sim' : 'não'),
  ].join('\n');
}

/** A autenticação não libera dados: as regras verificam perfil e troca de senha. */
function pedirLogin(auth, firebase, mensagem = '', sucesso=false) {
  return new Promise(resolver => {
    const tela=montarTelaAcesso('Entre na sua conta','Use o e-mail cadastrado e sua senha do painel.',`<form class="form acesso-form" id="login-senha"><label class="campo"><span>E-mail</span><input type="email" name="email" required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label class="campo"><span>Senha</span><input type="password" name="senha" required maxlength="128" autocomplete="current-password"></label><button class="btn prim" type="submit">Entrar</button><button class="acesso-link" type="button" data-esqueci>Esqueci minha senha</button></form><div class="acesso-ou"><span>ou</span></div><button class="btn acesso-provedor" id="entrar-google"><span class="marca-google" aria-hidden="true">G</span>Entrar com Google${icone('direita')}</button><details class="acesso-diagnostico"><summary>Diagnóstico de acesso</summary><pre></pre><p>Este diagnóstico não contém e-mail, senha nem tokens.</p></details>`);
    const diagnostico=tela.querySelector('.acesso-diagnostico');
    diagnostico.querySelector('pre').textContent=diagnosticoSessao(auth);
    diagnostico.addEventListener('toggle',()=>{if(diagnostico.open)diagnostico.querySelector('pre').textContent=diagnosticoSessao(auth);});
    if(mensagem){erroTelaAcesso(tela,mensagem);if(sucesso){const aviso=tela.querySelector('.acesso-erro');aviso.classList.add('acesso-sucesso');aviso.setAttribute('role','status');}}
    const parar=auth.onAuthStateChanged(u=>{if(!u)return;parar();tela.hidden=true;tela.innerHTML='';resolver(u);});
    const f=tela.querySelector('form');
    f.onsubmit=async e=>{
      e.preventDefault();if(!f.reportValidity())return;const b=f.querySelector('[type=submit]');b.disabled=true;
      try{await auth.signInWithEmailAndPassword(f.email.value.trim().toLowerCase(),f.senha.value);}
      catch(e){f.senha.value='';erroTelaAcesso(tela,e.code==='auth/operation-not-allowed'?'O administrador precisa habilitar E-mail/senha no Firebase.':e.code==='auth/too-many-requests'?'Muitas tentativas. Aguarde alguns minutos.':'Não foi possível entrar. Confira seu e-mail e sua senha ou use a recuperação de acesso.');b.disabled=false;}
    };
    tela.querySelector('[data-esqueci]').onclick=()=>{
      const email=f.email.value;f.senha.value='';
      const cartao=tela.querySelector('.acesso-cartao'),titulo=cartao.querySelector('h1'),descricao=cartao.querySelector(':scope > p');
      const anteriores=[titulo.textContent,descricao.textContent];titulo.textContent='Recuperar acesso';descricao.textContent='Enviaremos instruções para o e-mail cadastrado.';
      const ocultar=[f,tela.querySelector('.acesso-ou'),tela.querySelector('#entrar-google'),diagnostico];ocultar.forEach(el=>el.hidden=true);
      const area=document.createElement('section');area.innerHTML=`<form class="form acesso-form"><label class="campo"><span>E-mail cadastrado</span><input name="email" type="email" required maxlength="254" autocomplete="email" value="${esc(email)}"></label><small>Solicitar a recuperação não altera sua senha atual.</small><p role="status" aria-live="polite"></p><button class="btn prim" type="submit">Enviar instruções</button><button class="acesso-link" type="button" data-voltar>Voltar ao login</button></form>`;
      cartao.insertBefore(area,cartao.querySelector('.acesso-restrito'));
      area.querySelector('[data-voltar]').onclick=()=>{area.remove();ocultar.forEach(el=>el.hidden=false);[titulo.textContent,descricao.textContent]=anteriores;};
      const form=area.querySelector('form'),b=form.querySelector('[type=submit]');
      form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity()||b.disabled)return;b.disabled=true;try{const d=await solicitarConta('recuperar',{email:form.email.value});form.querySelector('[role=status]').textContent=d.mensagem;}catch(e){form.querySelector('[role=status]').textContent=e.message;b.disabled=false;}};
    };
    tela.querySelector('#entrar-google').onclick=async()=>{
      const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
      try{await auth.signInWithPopup(p);}catch(e){if(e.code==='auth/popup-blocked'){try{await auth.signInWithRedirect(p);return;}catch{}}if(e.code!=='auth/popup-closed-by-user')erroTelaAcesso(tela,'Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.');}
    };
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
  // Reutiliza a identidade no mesmo navegador, inclusive ao abrir um link do e-mail em outra aba.
  // Não concede acesso: token atualizado e perfil ativo continuam obrigatórios em cada abertura.
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  try { await auth.getRedirectResult(); } catch (e) { console.warn("login por redirecionamento", e); }
  const recuperada=await abrirRecuperacaoPublica(auth);
  let usuario = await new Promise((ok) => { const parar = auth.onAuthStateChanged((u) => { parar(); ok(u); }); });
  if (window.__CP_FIREBASE_EMULADOR__ && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.__CP_LOGIN_TESTE__ && !usuario) {
    const cred = firebase.auth.GoogleAuthProvider.credential(JSON.stringify(window.__CP_LOGIN_TESTE__));
    usuario = (await auth.signInWithCredential(cred)).user;
  }
  if (!usuario) usuario = await pedirLogin(auth, firebase,recuperada?'Senha redefinida. Entre com sua nova senha.':'',recuperada);
  for(;;){
    try{usuario=await prepararAcessoSenha(auth,usuario);break;}
    catch(e){await auth.signOut();usuario=await pedirLogin(auth,firebase,e.message||'Solicite a recuperação do acesso.');}
  }
  await usuario.reload();
  await usuario.getIdToken(true);
  Acesso.usuario = { uid: usuario.uid, email: usuario.email || '', nome: primeiroNomeEmail(usuario.email), verificado: usuario.emailVerified };
  try {
    const ref = fs.doc(`usuarios/${usuario.email.toLowerCase()}`);
    const perfil = await ref.get({ source: 'server' });
    if (!usuario.emailVerified || !perfil.exists || !perfil.data().ativo || !PERFIS[perfil.data().perfil]) throw new Error('sem_permissao');
    const versao = await fs.doc(perfil.data().perfil==='tecnico'?'seguranca/portal':'seguranca/controle').get({ source: 'server' });
    if (versao.data()?.versao !== 2) throw new Error('seguranca_pendente');
    Acesso.perfil = decodificarFS(perfil.data());
    Acesso.usuario.nome = nomeDaConta().split(' ')[0];
    Acesso.pararPerfil?.();
    Acesso.pararPerfil = ref.onSnapshot(s => {
      if (s.metadata.hasPendingWrites) return;
      if (!s.exists || !s.data().ativo || !PERFIS[s.data().perfil]) { bloquearSessao(); return; }
      const mudouPerfil = Acesso.perfil?.perfil !== s.data().perfil || Acesso.perfil?.tecnicoId !== s.data().tecnicoId;
      const mudouNome = Acesso.perfil?.nome !== s.data().nome;
      Acesso.perfil = decodificarFS(s.data());
      Acesso.usuario.nome = nomeDaConta().split(' ')[0];
      if (mudouPerfil) {
        bloquearSessao('As permissões desta conta mudaram. Recarregando o acesso…');
        location.reload();
        return;
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
