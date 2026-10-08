import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
import {recalcularResumo} from '../aviso/recalcular-resumo.mjs';
const require=createRequire(`${process.env.PW_PATH || '/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {chromium}=require('playwright');
await prepararEmulador();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM});
const erros=[];const saida='capturas/usuarios';fs.mkdirSync(saida,{recursive:true});
async function abrir(email='teste@exemplo.com') {
 const ctx=await browser.newContext({viewport:{width:1440,height:1050},locale:'pt-BR',reducedMotion:'reduce'});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.join(process.env.FIREBASE_SDK_DIR,r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(email=>{window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:'demo-controle-pecas',authDomain:'demo-controle-pecas.firebaseapp.com'};window.__CP_FIREBASE_EMULADOR__=true;window.__CP_AGORA='2026-10-06T09:00:00';if(email)window.__CP_LOGIN_TESTE__={sub:'uid-'+email,email,email_verified:true};},email);
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8002/pagina-completa.html');
 if(email)await p.waitForFunction(()=>E.status==='pronto'||E.status==='erro');
 else await p.locator('#entrar-microsoft').waitFor();
 return p;
}
try {
 const admin=await abrir();assert.equal(await admin.evaluate(()=>Acesso.perfil?.perfil),'administrador');
 await admin.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(n=>n.endsWith('.csv')).map(n=>path.resolve('exemplos',n)));
 await admin.waitForFunction(()=>UI.im.resultado);
 const tid=await admin.evaluate(()=>derivar().tecnicos.find(t=>t.nome.startsWith('Ana')).tid);
 await admin.evaluate(tid=>irPara('tecnicos',{tid}),tid);
 await admin.locator('.ficha-acoes [data-acao="editar-tecnico"]').click();
 await admin.locator('[name="localidade"]').selectOption('interior');await admin.locator('.modal [data-salvar]').click();
 await admin.waitForFunction(tid=>E.cadastro[tid].localidade==='interior',tid);
 await admin.evaluate(()=>irPara('tecnicos'));
 assert.match(await admin.locator('tr').filter({has:admin.locator(`[data-acao="tecnico"][data-tid="${tid}"]`)}).innerText(),/Interior/);
 await admin.reload();await admin.waitForFunction(()=>E.status==='pronto');
 assert.equal(await admin.evaluate(tid=>E.cadastro[tid].localidade,tid),'interior');
 await admin.locator('[data-nav="usuarios"]').click();await admin.locator('[data-acao="novo-usuario"]').click();
 await admin.locator('.modal [name="email"]').fill('Maria.Silva@empresa.com');await admin.locator('.modal [data-salvar]').click();
 await admin.waitForFunction(()=>E.usuarios.some(u=>u.email==='maria.silva@empresa.com'&&u.perfil==='usuario'));
 const normal=await abrir('maria.silva@empresa.com');
 assert.equal(await normal.evaluate(()=>E.status),'pronto');
 assert.equal(await normal.locator('[data-nav="usuarios"]').count(),0);assert.equal(await normal.locator('[data-nav="config"]').count(),0);
 assert.match(await normal.locator('#rail-conta').innerText(),/Maria/);
 await normal.locator('.conta-menu').click();assert.match(await normal.locator('.conta-perfil').innerText(),/Maria/);
 await normal.evaluate(()=>irPara('usuarios'));assert.equal(await normal.evaluate(()=>UI.pagina),'painel');
 // Mais de um lote: cada peça guarda evento e autor conferidos pelas regras.
 await normal.evaluate(()=>definirPrevisao(derivar().itens,'2026-10-09'));
 await admin.waitForFunction(()=>derivar().itens.every(i=>i.previsao==='2026-10-09'&&i.agendadoPor?.email==='maria.silva@empresa.com'));
 // Uma falha depois do primeiro lote informa exatamente o que ficou salvo, sem contato integral fictício.
 const parcial=await normal.evaluate(async()=>{
  const itens=derivar().itens,antes=(await Armazem.consultar('contatos')).length;
  const transacao=Acesso.fs.runTransaction.bind(Acesso.fs);let chamadas=0,mensagem='';
  Acesso.fs.runTransaction=fn=>++chamadas===2?Promise.reject({code:'unavailable'}):transacao(fn);
  try {await gravarAgendamentos(itens,'2026-10-11',{tid:itens[0].tid,canal:'ligacao',previsao:'2026-10-11',obs:'',pecas:somar(itens,i=>i.qtd),itens:itens.map(i=>i.k)});}
  catch(e){mensagem=e.message;}finally{Acesso.fs.runTransaction=transacao;}
  return {mensagem,contatos:(await Armazem.consultar('contatos')).length-antes,atualizados:derivar().itens.filter(i=>i.previsao==='2026-10-11').length};
 });
 assert.match(parcial.mensagem,/8 de 9 registros/);assert.equal(parcial.atualizados,8);assert.equal(parcial.contatos,0);
 await normal.evaluate(()=>definirPrevisao(derivar().itens,'2026-10-09'));
 assert.equal(await normal.evaluate(()=>autorPrevisao(derivar().itens[0])),'Maria');
 await normal.evaluate(tid=>irPara('tecnicos',{tid}),tid);await normal.locator('[data-acao="historico-agenda"]').click();
 await normal.locator('.modal').waitFor();assert.match(await normal.locator('.modal').innerText(),/Maria/);assert.match(await normal.locator('.modal').innerText(),/maria.silva@empresa.com/);await normal.keyboard.press('Escape');
 await normal.evaluate(tid=>registrarCobranca(tid,{canal:'ligacao',previsao:'2026-10-10',obs:'Agendamento confirmado',itens:derivar().mapa.get(tid).usadas}),tid);
 await admin.waitForFunction(tid=>derivar().mapa.get(tid).usadas.every(i=>i.previsao==='2026-10-10'),tid);
 // O aviso é calculado de dados atuais no servidor, sem dar escrita de resumos ao usuário comum.
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';const fbAdmin=require('firebase-admin');fbAdmin.initializeApp({projectId:'demo-controle-pecas'});
 const resumo=await recalcularResumo(fbAdmin.firestore(),'2026-10-06');
 assert.equal(resumo.dias['2026-10-06'].totalTecnicos,0);await fbAdmin.app().delete();
 for(const tema of ['dark','light']) {
  if(await admin.evaluate(()=>document.documentElement.dataset.theme)!==tema)await admin.locator('.acoes-topo [data-acao="tema"]').click();
  await admin.evaluate(()=>irPara('usuarios'));await admin.waitForTimeout(100);await admin.screenshot({path:`${saida}/usuarios-${tema}.png`,fullPage:true});
  await admin.locator('[data-acao="novo-usuario"]').click();await admin.locator('.modal').screenshot({path:`${saida}/cadastro-${tema}.png`});await admin.keyboard.press('Escape');
  await normal.evaluate(()=>irPara('conta'));await normal.setViewportSize({width:390,height:844});assert.equal(await normal.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await admin.evaluate(()=>salvarUsuario('maria.silva@empresa.com','administrador',true));
 await normal.waitForFunction(()=>Acesso.perfil?.perfil==='administrador');await normal.locator('[data-nav="usuarios"]').waitFor({state:'attached'});
 await admin.evaluate(()=>salvarUsuario('maria.silva@empresa.com','usuario',true));await normal.waitForFunction(()=>Acesso.perfil?.perfil==='usuario');
 assert.equal(await normal.locator('[data-nav="usuarios"]').count(),0);
 await admin.evaluate(()=>salvarUsuario('maria.silva@empresa.com','usuario',false));await normal.waitForFunction(()=>E.status==='erro');
 assert.equal(await normal.evaluate(()=>E.usadas.length),0);assert.match(await normal.locator('#conteudo').innerText(),/desativado/);
 const login=await abrir('');
 for(const tema of ['dark','light']) {
  if(await login.evaluate(()=>document.documentElement.dataset.theme)!==tema)await login.locator('.acesso-tema [data-acao="tema"]').click();
  for(const width of [1440,390,320]) {await login.setViewportSize({width,height:900});await login.screenshot({path:`${saida}/login-${tema}-${width}.png`});assert.equal(await login.evaluate(()=>document.querySelector('#acesso').scrollWidth>innerWidth),false);}
 }
 // Vídeo real: inicia sem clique, continua nos dois temas e retorna ao início em loop.
 await login.waitForFunction(()=>{const v=document.querySelector('.login-video');return v.readyState>=2&&!v.paused&&v.currentTime>0;});
 assert.deepEqual(await login.locator('.login-video').evaluate(v=>({loop:v.loop,muted:v.muted,controls:v.controls,inline:v.playsInline})),{loop:true,muted:true,controls:false,inline:true});
 assert.equal(await login.getByRole('button',{name:/pausar/i}).count(),0);
 await login.locator('.login-video').evaluate(v=>v.currentTime=v.duration-.3);
 await login.waitForFunction(()=>document.querySelector('.login-video').currentTime<2);
 const tempo=await login.locator('.login-video').evaluate(v=>v.currentTime);
 await login.waitForFunction(t=>document.querySelector('.login-video').currentTime>t+.25,tempo);
 await login.locator('.login-video').evaluate(async v=>{v.src=v.querySelector('source[type="video/mp4"]').src;v.load();await v.play();});
 await login.waitForFunction(()=>document.querySelector('.login-video').currentTime>.25);
 // Confere os dois provedores e o tenant comum sem abrir login externo nos testes.
 await login.evaluate(()=>{window.__provedores=[];Acesso.auth.signInWithPopup=async p=>{window.__provedores.push([p.providerId,p.customParameters]);throw {code:'auth/popup-closed-by-user'};};});
 await login.locator('#entrar-google').click();await login.locator('#entrar-microsoft').click();
 assert.deepEqual(await login.evaluate(()=>window.__provedores.map(p=>p[0])),['google.com','microsoft.com']);
 assert.equal(await login.evaluate(()=>window.__provedores[1][1].tenant),'common');
 assert.deepEqual(erros,[]);console.log('PASSOU: cadastro de usuários, papéis, sessão revogada, capital/interior, autoria e auditoria, sincronização, resumo diário, dois provedores, temas e celular.');
} finally {await browser.close();}
