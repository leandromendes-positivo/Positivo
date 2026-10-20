import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {chromium}=require('playwright'),{initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
await prepararEmulador();await env.withSecurityRulesDisabled(c=>c.firestore().doc('servicos/lembretes-ferias').set({habilitado:true}));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined}),erros=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.resolve(process.env.FIREBASE_SDK_DIR||'seguranca/node_modules/firebase',r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>{window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:'demo-controle-pecas',authDomain:'demo-controle-pecas.firebaseapp.com'};window.__CP_FIREBASE_EMULADOR__=true;window.__CP_LOGIN_TESTE__={sub:'lembretes-teste',email:'teste@exemplo.com',email_verified:true};});
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');await p.evaluate(()=>irPara('ferias'));
 await p.locator('.ferias-abertura [data-ferias="lembretes"]').click();await p.locator('#lembretes-ferias-form').waitFor();assert.equal(await p.locator('#lembretes-ferias-form [name="email"]').inputValue(),'teste@exemplo.com');
 await p.locator('#lembretes-ferias-form [name="email"]').fill('equipe@exemplo.com');await p.locator('[name=horario]').fill('16:45');await p.locator('[name=antecedencia]').fill('15');await p.locator('[data-lembretes-salvar]').click();await p.locator('#lembretes-ferias-form').waitFor({state:'detached'});
 await p.locator('[data-ferias="lembretes"]').click();await p.locator('#lembretes-ferias-form').waitFor();assert.equal(await p.locator('#lembretes-ferias-form [name="email"]').inputValue(),'equipe@exemplo.com');assert.match(await p.locator('#lembretes-ferias-form').innerText(),/inscrição está ativa/);
 assert.equal(await p.locator('[name=horario]').inputValue(),'16:45');assert.equal(await p.locator('[name=antecedencia]').inputValue(),'15');
 await p.locator('[data-lembretes-testar]').click();await p.locator('[data-lembretes-teste]').filter({hasText:'Teste solicitado'}).waitFor();
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();const docs=await db.collection('testes_lembretes_ferias').get();for(const d of docs.docs)await d.ref.update({estado:'enviado',atualizadoEm:new Date().toISOString()});});
 await p.locator('[data-lembretes-teste]').filter({hasText:'aceito pelo servidor'}).waitFor();
 await p.locator('[data-lembretes-parar]').click();await p.locator('#lembretes-ferias-form').waitFor({state:'detached'});
 await p.locator('[data-ferias="lembretes"]').click();await p.locator('#lembretes-ferias-form').waitFor();assert.equal(await p.locator('#lembretes-ferias-form [name="ativo"]').isChecked(),false);await p.locator('.modal [data-fechar]').first().click();
 // Inscrição não depende de permissão administrativa; cada usuário gerencia somente a própria.
 await env.withSecurityRulesDisabled(async c=>{
  await c.firestore().doc('usuarios/teste@exemplo.com').update({perfil:'usuario',principal:false});
  await c.firestore().doc('servicos/lembretes-ferias').set({habilitado:false});
 });
 await p.waitForFunction(()=>E.status==='pronto'&&Acesso.perfil?.perfil==='usuario');await p.evaluate(()=>irPara('ferias'));await p.locator('[data-ferias="lembretes"]').click();await p.locator('#lembretes-ferias-form').waitFor();assert.match(await p.locator('#lembretes-ferias-form').innerText(),/aguarda configuração/);await p.locator('.modal [data-fechar]').first().click();
 fs.mkdirSync('capturas/lembretes-ferias',{recursive:true});
 for(const tema of ['light','dark'])for(const largura of [1440,390,320]){
  await p.setViewportSize({width:largura,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);await p.locator('[data-ferias="lembretes"]').click();await p.locator('#lembretes-ferias-form').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`capturas/lembretes-ferias/${tema}-${largura}.png`});await p.locator('.modal [data-fechar]').first().click();
 }
 assert.deepEqual(erros,[]);console.log('Lembretes UI: botão no cabeçalho, cadastrar, persistir, desativar, perfil comum, serviço indisponível e dois temas/3 larguras passaram.');
}finally{await browser.close();await env.cleanup();}
