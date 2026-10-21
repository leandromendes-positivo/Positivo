// Firebase Auth/Firestore reais no emulador; e-mail é capturado sem sair da máquina.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {atenderContas,authAdministrativa,gerarTemporaria} from '../cloudflare/contas.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),{chromium}=require('playwright');
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')||!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||''))throw Error('Somente emulador');
const projeto='demo-controle-seguranca',app=initializeApp({projectId:projeto},'teste-senhas'),db=getFirestore(app),auth=getAuth(app);
const ambiente=await initializeTestEnvironment({projectId:projeto,firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
const fetchLocal=(url,init)=>{assert.ok(url.startsWith('https://identitytoolkit.googleapis.com/'));return fetch(url.replace('https://identitytoolkit.googleapis.com','http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com'),init);};
const emails=[],config={FIREBASE_PROJECT_ID:projeto,FIREBASE_API_KEY:'chave-de-teste',PAINEL_URL:'https://positivo.pages.dev/'};
const servico={db,env:config,authAdmin:authAdministrativa(projeto,'owner',fetchLocal),remetente:'teste@exemplo.com',transporte:{sendMail:async m=>{emails.push(m);return{accepted:[m.to.address]};}}};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined}),erros=[];
try{
 await ambiente.clearFirestore();
 const cfg=await fetchLocal(`https://identitytoolkit.googleapis.com/v2/projects/${projeto}/config?updateMask=signIn.email`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({signIn:{email:{enabled:true,passwordRequired:true}}})});assert.equal(cfg.ok,true);

 await db.doc('usuarios/admin@empresa.com').set({ativo:true,perfil:'administrador',principal:true});
 await db.doc('usuarios/senha.e2e@empresa.com').set({email:'senha.e2e@empresa.com',perfil:'usuario',ativo:true});
 await db.doc('seguranca/controle').set({versao:2});await db.doc('seguranca/portal').set({versao:2});
 const admin={uid:'admin',email:'admin@empresa.com',usuario:{emailVerified:true},perfil:{ativo:true,perfil:'administrador'},claims:{auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'google.com'}}};
 await gerarTemporaria(servico,admin,'senha.e2e@empresa.com','operacao-e2e-123456789012345');
 const ctx=await browser.newContext({viewport:{width:1360,height:900}});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.resolve(process.env.FIREBASE_SDK_DIR||'seguranca/node_modules/firebase',r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 await ctx.addInitScript(projeto=>{window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:projeto,authDomain:projeto+'.firebaseapp.com'};window.__CP_FIREBASE_EMULADOR__=true;},projeto);
 let liberarEnvio,simularFalha=false;const portaoEnvio=new Promise(resolve=>liberarEnvio=resolve);
 await ctx.route('https://positivo.leandromendes-positivo.workers.dev/contas/**',async route=>{
  const r=route.request();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type'}});
  if(r.url().endsWith('/contas/temporaria')){
   const dados=JSON.parse(r.postData()||'{}');
   if(dados.email==='cadastro.e2e@empresa.com'){
    if(simularFalha)return route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body:JSON.stringify({erro:'Confira o remetente de e-mail no Cloudflare.'})});
    await portaoEnvio;
   }
  }
  const res=await atenderContas(new Request(r.url(),{method:r.method(),headers:r.headers(),body:r.postData()}),config,async()=>servico,{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},undefined,fetchLocal);
  await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()});
 });
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));
 const base=process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html';await p.goto(base);await p.locator('#login-senha').waitFor();
 assert.equal(await p.locator('video,#entrar-microsoft').count(),0);
 for(const [width,height]of [[320,568],[390,844],[844,390],[1360,900]]){await p.setViewportSize({width,height});assert.equal(await p.locator('#acesso').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}
 await p.locator('#login-senha [name=email]').fill('senha.e2e@empresa.com');await p.locator('#login-senha [name=senha]').fill(emails[0].text.match(/Senha temporária: (.+)/)[1]);await p.locator('#login-senha [type=submit]').click();
 await p.locator('[data-nova-senha]').waitFor();assert.equal(await p.evaluate(()=>Acesso.perfil),null);
 assert.equal(await p.evaluate(async()=>{try{await Acesso.fs.doc('usuarios/senha.e2e@empresa.com').get({source:'server'});return true;}catch{return false;}}),false,'nem perfil pode ser lido antes da troca');
 const nova='Minha frase nova e segura 123!';await p.locator('[data-nova-senha] [name=senha]').fill(nova);await p.locator('[data-nova-senha] [name=confirmacao]').fill(nova);await p.locator('[data-nova-senha] [type=submit]').click();
 await p.waitForFunction(()=>E.status==='pronto');assert.equal(await p.evaluate(()=>Acesso.perfil.perfil),'usuario');
 await p.evaluate(async()=>{await Acesso.auth.signOut();});await p.reload();await p.locator('#login-senha').waitFor();
 await p.locator('[data-esqueci]').click();await p.locator('[data-voltar]').waitFor();await p.locator('.acesso-cartao section [name=email]').fill('senha.e2e@empresa.com');await p.locator('.acesso-cartao section [type=submit]').click();await p.getByText(/Se o endereço tiver acesso ativo/).waitFor();
 const link=emails.at(-1).text.match(/#redefinir-senha=([-\w]+)/)[0];await p.goto(base+link);await p.locator('[data-nova-senha]').waitFor();assert.equal(p.url().includes('redefinir-senha='),false);
 const ultima='Outra frase nova e segura 456!';await p.locator('[data-nova-senha] [name=senha]').fill(ultima);await p.locator('[data-nova-senha] [name=confirmacao]').fill(ultima);await p.locator('[data-nova-senha] [type=submit]').click();await p.locator('#login-senha').waitFor();
 await p.locator('#login-senha [name=email]').fill('senha.e2e@empresa.com');await p.locator('#login-senha [name=senha]').fill(ultima);await p.locator('#login-senha [type=submit]').click();await p.waitForFunction(()=>E.status==='pronto');
 // Cadastro fecha antes do provedor responder e mantém resultado na lista.
 const gestor=await ctx.newPage();gestor.on('pageerror',e=>erros.push(e.message));
 await p.evaluate(async()=>Acesso.auth.signOut());
 await gestor.addInitScript(()=>{window.__CP_LOGIN_TESTE__={sub:'admin-cadastro',email:'admin@empresa.com',email_verified:true};});
 await gestor.goto(base);await gestor.waitForFunction(()=>E.status==='pronto');await gestor.evaluate(()=>irPara('usuarios'));
 await gestor.locator('[data-acao="novo-usuario"]').click();await gestor.locator('.modal [name=nome]').fill('Maria Cadastro');await gestor.locator('.modal [name=email]').fill('cadastro.e2e@empresa.com');
 await gestor.locator('.modal [data-salvar]').click();await gestor.waitForFunction(()=>!document.querySelector('.modal-fundo'));
 await gestor.locator('.usuarios-envio.enviando').waitFor();assert.equal(emails.length,2,'janela fecha enquanto envio está em andamento');
 liberarEnvio();await gestor.locator('.usuarios-envio.enviado').waitFor();assert.match(emails.at(-1).text,/Maria Cadastro/);
 await gestor.locator('.modal [data-copiar]').waitFor();const camposAcesso=await gestor.locator('.modal input').evaluateAll(xs=>xs.map(x=>x.value));assert.equal(camposAcesso[1],'https://positivo.pages.dev/');assert.ok(camposAcesso[2].length>=24);await gestor.locator('.modal-rodape [data-fechar]').click();
 assert.equal((await db.doc('usuarios/cadastro.e2e@empresa.com').get()).data().nome,'Maria Cadastro');
 const quantidade=emails.length;
 await gestor.locator('[data-acao="editar-usuario"][data-email="cadastro.e2e@empresa.com"]').click();await gestor.locator('.modal [name=nome]').fill('Maria Nome Alterado');await gestor.locator('.modal [data-salvar]').click();await gestor.waitForFunction(()=>!document.querySelector('.modal-fundo'));
 assert.equal(emails.length,quantidade,'editar nome não redefine senha automaticamente');assert.equal((await db.doc('usuarios/cadastro.e2e@empresa.com').get()).data().nome,'Maria Nome Alterado');
 simularFalha=true;
 await gestor.locator('[data-acao="editar-usuario"][data-email="cadastro.e2e@empresa.com"]').click();await gestor.locator('.modal [name=gerarSenha]').check();await gestor.locator('.modal [data-salvar]').click();await gestor.waitForFunction(()=>!document.querySelector('.modal-fundo'));await gestor.locator('.usuarios-envio.erro').waitFor();assert.match(await gestor.locator('.usuarios-envio.erro').innerText(),/Confira o remetente/);
 assert.deepEqual(erros,[]);console.log('E-mail/senha E2E: nome, popup fecha antes do envio, falha explícita sem repetir cadastro, criação REST real, troca obrigatória antes dos dados, recuperação, login e responsividade passaram. Nenhum e-mail real enviado.');
}finally{await browser.close();await ambiente.cleanup();await deleteApp(app);}
