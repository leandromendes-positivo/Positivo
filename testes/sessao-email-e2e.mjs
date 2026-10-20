// Sessão real do Firebase no emulador: a segunda aba nunca usa login automático de teste.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {chromium}=require('playwright'),{initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
await prepararEmulador();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined}),erros=[];
const link=new URL(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');link.hash='ferias';
async function contexto(){
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.resolve(process.env.FIREBASE_SDK_DIR||'seguranca/node_modules/firebase',r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 await ctx.addInitScript(()=>{window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:'demo-controle-pecas',authDomain:'demo-controle-pecas.firebaseapp.com'};window.__CP_FIREBASE_EMULADOR__=true;});return ctx;
}
async function pagina(ctx,email,fragmento='ferias'){
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));
 if(email)await p.addInitScript(email=>{window.__CP_LOGIN_TESTE__={sub:'sessao-'+email,email,email_verified:true};},email);
 const destino=new URL(link.href);destino.hash=fragmento;await p.goto(destino.href);return p;
}
const pronto=p=>p.waitForFunction(()=>typeof E!=='undefined'&&E.status==='pronto');
const bloqueado=p=>p.waitForFunction(()=>typeof E!=='undefined'&&E.erroCodigo==='sem_permissao');
try{
 // Reproduz uma aba ainda carregada com a persistência SESSION da versão antiga.
 // A fixture só autentica uma vez; recarregar testa migração real, sem novo login.
 const legadoCtx=await contexto(),legado=await legadoCtx.newPage();
 legado.on('pageerror',e=>erros.push(e.message));
 const htmlLegado=fs.readFileSync('dist/pagina-completa.html','utf8').replace(
  'await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);',
  'await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);');
 assert.ok(htmlLegado.includes('await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);'));
 await legado.route(link.href.split('#')[0],r=>r.fulfill({body:htmlLegado,contentType:'text/html'}),{times:1});
 await legado.addInitScript(()=>{
  if(!sessionStorage.getItem('fixture-legado-usada')){
   sessionStorage.setItem('fixture-legado-usada','1');
   window.__CP_LOGIN_TESTE__={sub:'sessao-teste@exemplo.com',email:'teste@exemplo.com',email_verified:true};
  }
 });
 await legado.goto(link.href);
 try { await pronto(legado); } catch(e) {
  console.error('Diagnóstico legado',await legado.evaluate(()=>({status:typeof E==='undefined'?'ausente':E.status,codigo:typeof E==='undefined'?'':E.erroCodigo,fixture:!!window.__CP_LOGIN_TESTE__,sdk:!!window.firebase,login:!!document.querySelector('#entrar-google'),erros:document.body.innerText.slice(-1000)})),erros);
  throw e;
 }
 const legadoUid=await legado.evaluate(()=>Acesso.usuario.uid);
 const linkLegado=await pagina(legadoCtx);await linkLegado.locator('#entrar-google').waitFor();
 assert.equal(await linkLegado.evaluate(()=>Acesso.auth.currentUser),null,'sessão antiga é isolada por aba');
 await legado.reload();await pronto(legado);
 assert.equal(await legado.evaluate(()=>window.__CP_LOGIN_TESTE__),undefined,'atualização não pode autenticar pela fixture');
 assert.equal(await legado.evaluate(()=>Acesso.usuario.uid),legadoUid);
 await pronto(linkLegado);
 assert.equal(await linkLegado.evaluate(()=>Acesso.usuario.uid),legadoUid);
 assert.equal(await linkLegado.evaluate(()=>UI.pagina),'ferias');
 await legadoCtx.close();
 const ctx=await contexto(),original=await pagina(ctx,'teste@exemplo.com');await pronto(original);
 assert.equal(await original.evaluate(()=>UI.pagina),'ferias');const uid=await original.evaluate(()=>Acesso.usuario.uid);
 const nova=await pagina(ctx);await pronto(nova);
 assert.equal(await nova.evaluate(()=>window.__CP_LOGIN_TESTE__),undefined,'segunda aba não deve autenticar por fixture');
 assert.equal(await nova.evaluate(()=>Acesso.usuario.uid),uid);assert.equal(await nova.evaluate(()=>UI.pagina),'ferias');
 assert.equal(await nova.locator('#acesso').isVisible(),false);assert.equal(new URL(nova.url()).search,'');
 const invalida=await pagina(ctx,undefined,'__proto__');await pronto(invalida);assert.equal(await invalida.evaluate(()=>UI.pagina),'painel');await invalida.close();
 // A persistência não concede acesso: revogação deve limpar as duas abas e impedir outra abertura.
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('usuarios/teste@exemplo.com').update({ativo:false}));
 await Promise.all([bloqueado(original),bloqueado(nova)]);
 for(const p of [original,nova])assert.deepEqual(await p.evaluate(()=>[E.ferias.length,E.usadas.length,E.novas.length]),[0,0,0]);
 const revogada=await pagina(ctx);await bloqueado(revogada);assert.equal(await revogada.locator('.ferias').count(),0);
 await Promise.all([original.close(),nova.close(),revogada.close()]);
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('usuarios/teste@exemplo.com').update({ativo:true}));
 const restaurada=await pagina(ctx);await pronto(restaurada);assert.equal(await restaurada.evaluate(()=>UI.pagina),'ferias');
 const compartilhada=await pagina(ctx);await pronto(compartilhada);
 await restaurada.evaluate(()=>Acesso.auth.signOut());await Promise.all([bloqueado(restaurada),bloqueado(compartilhada)]);
 const depoisSair=await pagina(ctx);await depoisSair.locator('#entrar-google').waitFor();assert.equal(await depoisSair.evaluate(()=>Acesso.auth.currentUser),null);assert.equal(await depoisSair.locator('.ferias').count(),0);
 // Técnico conserva a própria sessão, mas o link de férias não amplia sua permissão.
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();await db.doc('usuarios/tecnico@teste.com').set({email:'tecnico@teste.com',perfil:'tecnico',ativo:true,tecnicoId:'PR--TEC'});
  await db.doc('vinculos_tecnicos/PR--TEC').set({email:'tecnico@teste.com',tid:'TEC',regiao:'PR'});
  await db.doc('dados/indice').set({versao:0,arquivos:{}});
  await db.doc('portal/controle').set({geracao:'geracao-vazia-segura-1234567890',versao:0});
 });
 const ctxTec=await contexto(),tec=await pagina(ctxTec,'tecnico@teste.com');await pronto(tec);
 const outraTec=await pagina(ctxTec);await pronto(outraTec);
 for(const p of [tec,outraTec]){
  assert.equal(await p.evaluate(()=>UI.pagina),'meu-painel');assert.equal(await p.evaluate(()=>E.ferias.length),0);
  assert.equal(await p.evaluate(async()=>{try{await Acesso.fs.collection('ferias').get({source:'server'});return false;}catch(e){return e.code==='permission-denied';}}),true);
 }
 assert.deepEqual(erros,[]);
 console.log('Link do e-mail: sessão entre abas sem tokens no URL, destino férias, revogação em todas as abas, nova abertura revogada, logout compartilhado e isolamento do técnico passaram.');
}finally{await browser.close();await env.cleanup();}
