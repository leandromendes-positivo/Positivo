/* Senhas são tratadas pelo Firebase/servidor; nunca persistidas neste navegador. */
function urlServicoContas(){
  const u=new URL(window.CP_CONTAS_URL||'https://positivo.leandromendes-positivo.workers.dev/');
  if(u.protocol!=='https:'&&!((window.__CP_FIREBASE_EMULADOR__)&&/^(localhost|127\.0\.0\.1)$/.test(u.hostname)))throw new Error('Serviço de contas inválido.');
  return u;
}
async function solicitarConta(caminho,dados={},autenticado=false,timeout=30000){
  const headers={'Content-Type':'application/json'};
  if(autenticado){if(!Acesso.auth?.currentUser)throw new Error('Entre novamente para continuar.');headers.Authorization='Bearer '+await Acesso.auth.currentUser.getIdToken();}
  const r=await fetch(new URL('contas/'+caminho,urlServicoContas()),{method:'POST',headers,body:JSON.stringify(dados),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(timeout)});
  let d;try{d=await r.json();}catch{throw new Error('O serviço de contas não está disponível. Tente novamente.');}
  if(!r.ok)throw Object.assign(new Error(d.erro||'Não foi possível concluir.'),{status:r.status});return d;
}
function montarTelaAcesso(titulo,descricao,corpo){
  const tela=document.getElementById('acesso');tela.hidden=false;
  tela.innerHTML=`<div class="acesso-tema">${document.getElementById('botao-tema').innerHTML}</div><div class="acesso-layout"><div class="acesso-apresentacao" aria-hidden="true"><img class="login-imagem" src="/*__LOGIN_IMAGEM__*/" alt=""><div class="login-luz"></div></div><div class="acesso-cartao"><span class="logo-positivo" role="img" aria-label="Positivo Tecnologia"></span><span class="acesso-etiqueta">ACESSO À OPERAÇÃO</span><h1>${esc(titulo)}</h1><p>${esc(descricao)}</p><p class="acesso-erro" role="alert" hidden></p>${corpo}<div class="acesso-restrito">${icone('info')}Acesso exclusivo a pessoas cadastradas pelo administrador.</div></div></div><footer class="acesso-rodape">Positivo Tecnologia · Controle de Peças</footer>`;
  Tema.atualizarBotoes();return tela;
}
function erroTelaAcesso(tela,mensagem){const el=tela.querySelector('.acesso-erro');if(el){el.hidden=false;el.classList.remove('acesso-sucesso');el.setAttribute('role','alert');el.textContent=mensagem;}}
function formularioNovaSenha(){return `<form class="form acesso-form" data-nova-senha><label class="campo"><span>Nova senha</span><input name="senha" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="senha-ajuda"></label><label class="campo"><span>Confirme a nova senha</span><input name="confirmacao" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><small id="senha-ajuda">Use pelo menos 12 caracteres. Prefira uma frase que só você conheça.</small><button class="btn prim" type="submit">Definir minha senha</button></form>`;}
async function prepararAcessoSenha(auth,usuario){
  if(!usuario.providerData.some(p=>p.providerId==='password'))return usuario;
  // O provedor da sessão importa: contas antigas podem ter Google e senha vinculados.
  if((await usuario.getIdTokenResult()).signInProvider!=='password')return usuario;
  const estado=await solicitarConta('situacao',{},true);
  if(!estado.trocaObrigatoria)return usuario;
  return new Promise(resolve=>{
    const tela=montarTelaAcesso('Crie sua própria senha','Este é seu primeiro acesso ou sua senha foi redefinida. Troque a senha temporária para continuar.',formularioNovaSenha()+'<button class="btn" data-voltar-login>Sair e voltar ao login</button>');
    const f=tela.querySelector('form');
    tela.querySelector('[data-voltar-login]').onclick=async()=>{await auth.signOut();location.reload();};
    f.onsubmit=async e=>{
      e.preventDefault();if(!f.reportValidity()||f.senha.value!==f.confirmacao.value){erroTelaAcesso(tela,'As senhas devem ser iguais.');return;}
      const btn=f.querySelector('button');btn.disabled=true;
      try{
        const senha=f.senha.value,email=usuario.email,resultado=await solicitarConta('primeiro-acesso',{senha},true);
        f.reset();await auth.signOut();await new Promise(ok=>setTimeout(ok,1100));
        const cred=await auth.signInWithEmailAndPassword(email,senha);await cred.user.getIdToken(true);
        tela.hidden=true;tela.innerHTML='';resolve(cred.user);
      }catch(e){erroTelaAcesso(tela,e.message||'Não foi possível trocar a senha. Solicite a recuperação de acesso.');btn.disabled=false;}
    };
  });
}
async function abrirRecuperacaoPublica(auth){
  const token=location.hash.startsWith('#redefinir-senha=')?location.hash.slice('#redefinir-senha='.length):'';
  if(!token)return false;
  // Remove o segredo da barra e do histórico antes de carregar qualquer dado do painel.
  history.replaceState(null,'',location.pathname+location.search);
  let concluida=false;
  await new Promise(resolve=>{
    const tela=montarTelaAcesso('Redefinir senha','Defina uma nova senha para seu acesso ao painel.',formularioNovaSenha()+'<button class="btn" data-voltar-login>Voltar ao login</button>');
    tela.querySelector('[data-voltar-login]').onclick=resolve;
    const f=tela.querySelector('form');
    f.onsubmit=async e=>{
      e.preventDefault();if(!f.reportValidity()||f.senha.value!==f.confirmacao.value){erroTelaAcesso(tela,'As senhas devem ser iguais.');return;}
      const b=f.querySelector('button');b.disabled=true;
      try{const d=await solicitarConta('redefinir',{token,senha:f.senha.value});f.reset();await auth.signOut();await new Promise(ok=>setTimeout(ok,1100));concluida=true;resolve();}
      catch(e){erroTelaAcesso(tela,e.message);b.disabled=false;}
    };
  });
  await auth.signOut();return concluida;
}
async function confirmarAdministradorSenha(){
  const u=Acesso.auth.currentUser;if(!u)throw new Error('Entre novamente.');
  const token=await u.getIdTokenResult();if(Date.now()/1000-token.claims.auth_time<=840)return;
  if(token.signInProvider==='password'){
    await new Promise((resolve,reject)=>{
      let terminou=false;
      const m=abrirModal({titulo:'Confirme sua identidade',aoFechar:()=>{if(!terminou)reject(new Error('Confirmação cancelada.'));},corpo:'<form class="form"><label class="campo"><span>Sua senha atual</span><input type="password" name="senha" required autocomplete="current-password"></label><p role="alert"></p></form>',rodape:'<button class="btn" data-cancelar>Cancelar</button><button class="btn prim" data-confirmar>Confirmar</button>'});
      const f=m.el.querySelector('form'),b=m.el.querySelector('[data-confirmar]');m.el.querySelector('[data-cancelar]').onclick=()=>m.fechar();
      const confirmar=async()=>{if(!f.reportValidity())return;b.disabled=true;try{await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,f.senha.value));f.reset();terminou=true;m.fechar();resolve();}catch{f.querySelector('[role=alert]').textContent='Não foi possível confirmar sua senha.';b.disabled=false;}};
      b.onclick=confirmar;f.onsubmit=e=>{e.preventDefault();confirmar();};
    });
  }else{
    if(token.signInProvider!=='google.com')throw new Error('Entre novamente para confirmar sua identidade.');
    await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
  }
  await u.getIdToken(true);
}
async function gerarSenhaCadastro(email,operacao=crypto.randomUUID()){
  await confirmarAdministradorSenha();return solicitarConta('temporaria',{email,operacao},true);
}

// Links do e-mail também funcionam quando o navegador reutiliza a aba já aberta.
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#redefinir-senha='))location.reload();});
