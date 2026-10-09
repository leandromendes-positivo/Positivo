// Contas reais do SDK contra os emuladores locais; nunca altera o projeto publicado.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(`${process.env.PW_PATH || '/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {chromium}=require('playwright');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
await prepararEmulador();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM});
const erros=[],saida='capturas/minha-conta';fs.mkdirSync(saida,{recursive:true});
const emailNormal='maria.silva@empresa.com';
async function abrir(email='teste@exemplo.com') {
 const ctx=await browser.newContext({viewport:{width:1440,height:1050},locale:'pt-BR',timezoneId:'Asia/Tokyo',reducedMotion:'reduce'});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.join(process.env.FIREBASE_SDK_DIR,r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(email=>{
  window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:'demo-controle-pecas',authDomain:'demo-controle-pecas.firebaseapp.com'};
  window.__CP_FIREBASE_EMULADOR__=true;window.__CP_AGORA='2026-10-09T09:00:00';
  window.__CP_LOGIN_TESTE__={sub:'uid-'+email,email,email_verified:true};
 },email);
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8004/pagina-completa.html');
 await p.waitForFunction(()=>E.status==='pronto'||E.status==='erro');
 assert.equal(await p.evaluate(()=>E.status),'pronto');
 assert.equal(await p.evaluate(()=>Acesso.fs.app.options.projectId),'demo-controle-pecas');
 await p.locator('.conta-menu').click();
 return p;
}
async function conferirCadastro(p,esperado) {
 assert.equal(await p.locator('[data-conta-cadastro]').innerText(),esperado);
 assert.equal(await p.locator('#conta-email').getAttribute('readonly'),'');
 assert.deepEqual(await p.locator('.conta-grade input:not([readonly]):not([disabled])').evaluateAll(els=>els.map(el=>el.id)),['conta-nome']);
}
async function salvar(p,nome) {
 await p.locator('#conta-nome').fill(nome);
 await p.getByRole('button',{name:'Salvar nome',exact:true}).click();
 await p.locator('.conta-feedback.sucesso:visible').waitFor();
}
try {
 const admin=await abrir();
 await conferirCadastro(admin,'01/10/2026');
 await salvar(admin,'Leandro Mendes');
 assert.equal(await admin.locator('.conta-perfil h2').innerText(),'Leandro Mendes');
 await admin.evaluate(email=>salvarUsuario(email,'usuario',true),emailNormal);
 // Cadastro existente anterior ao login e próximo da meia-noite, respeitando Brasília.
 await env.withSecurityRulesDisabled(c=>c.firestore().doc(`usuarios/${emailNormal}`).update({criadoEm:new Date('2026-10-02T01:00:00Z')}));
 const normal=await abrir(emailNormal),outroDispositivo=await abrir(emailNormal);
 await conferirCadastro(normal,'01/10/2026');
 assert.equal(await normal.locator('#conta-nome').inputValue(),'Maria');
 assert.equal(await normal.locator('[data-nav="usuarios"]').count(),0);
 const antes=await normal.evaluate(()=>Acesso.perfil.criadoEm);
 await salvar(normal,'  Maria   Júlia D’Ávila  ');
 assert.equal(await normal.locator('#conta-nome').inputValue(),'Maria Júlia D’Ávila');
 assert.equal(await normal.locator('.conta-perfil h2').innerText(),'Maria Júlia D’Ávila');
 await outroDispositivo.waitForFunction(()=>document.querySelector('#conta-nome').value==='Maria Júlia D’Ávila');
 await normal.reload();await normal.waitForFunction(()=>E.status==='pronto');
 await normal.evaluate(()=>irPara('conta'));
 assert.equal(await normal.locator('#conta-nome').inputValue(),'Maria Júlia D’Ávila');
 assert.equal(await normal.evaluate(()=>Acesso.usuario.nome),'Maria');
 assert.equal(await normal.locator('#conta-email').inputValue(),emailNormal);
 assert.equal(await normal.evaluate(()=>Acesso.perfil.criadoEm),antes);
 // Um nome inválido não altera o perfil e pode ser corrigido sem perder o rascunho.
 for(const nome of ['   ','<img src=x>']) {
  await normal.locator('#conta-nome').fill(nome);
  await normal.getByRole('button',{name:'Salvar nome',exact:true}).click();
  await normal.locator('.conta-feedback.erro:visible').waitFor();
  assert.equal(await normal.locator('#conta-nome').inputValue(),nome);
  assert.equal(await normal.evaluate(()=>Acesso.perfil.nome),'Maria Júlia D’Ávila');
 }
 // Uma atualização externa não apaga um nome que está sendo digitado.
 await normal.locator('#conta-nome').fill('Mariana Alves');
 await salvar(outroDispositivo,'Maria Silva');
 await normal.waitForFunction(()=>Acesso.perfil.nome==='Maria Silva');
 await normal.evaluate(()=>renderizar(true));
 assert.equal(await normal.locator('#conta-nome').inputValue(),'Mariana Alves');
 await normal.getByRole('button',{name:'Salvar nome',exact:true}).click();
 await normal.locator('.conta-feedback.sucesso:visible').waitFor();
 assert.equal(await normal.evaluate(()=>Acesso.usuario.nome),'Mariana');
 assert.match(await normal.locator('#rail-conta').innerText(),/Mariana/);
 // Gerenciar o acesso preserva o nome e a data de cadastro; a sessão reflete o perfil.
 await admin.evaluate(email=>salvarUsuario(email,'administrador',true),emailNormal);
 await normal.waitForFunction(()=>Acesso.perfil.perfil==='administrador');
 await admin.evaluate(email=>salvarUsuario(email,'usuario',true),emailNormal);
 await normal.waitForFunction(()=>Acesso.perfil.perfil==='usuario');
 assert.equal(await normal.evaluate(()=>Acesso.perfil.nome),'Mariana Alves');
 assert.equal(await normal.evaluate(()=>Acesso.perfil.criadoEm),antes);
 await admin.evaluate(()=>irPara('usuarios'));
 await admin.locator('tr').filter({has:admin.locator(`[data-acao="editar-usuario"][data-email="${emailNormal}"]`)}).getByText('Mariana Alves',{exact:true}).waitFor();
 for(const tema of ['dark','light']) {
  if(await normal.evaluate(()=>document.documentElement.dataset.theme)!==tema)await normal.locator('.acoes-topo [data-acao="tema"]').click();
  for(const width of [1440,768,390,320]) {
   await normal.setViewportSize({width,height:1000});await normal.evaluate(()=>renderizar(true));
   await conferirCadastro(normal,'01/10/2026');
   assert.equal(await normal.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`sem rolagem lateral: ${tema}/${width}`);
   await normal.screenshot({path:`${saida}/conta-${tema}-${width}.png`,fullPage:true});
  }
 }
 await salvar(normal,'Alexandrina Maria Carolina de Albuquerque e Vasconcelos da Silva');
 assert.equal(await normal.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'nome longo cabe no celular');
 await normal.screenshot({path:`${saida}/conta-nome-longo.png`,fullPage:true});
 await admin.evaluate(email=>salvarUsuario(email,'usuario',false),emailNormal);
 await normal.waitForFunction(()=>E.status==='erro');
 assert.equal(await normal.locator('#conta-nome').count(),0,'sessão revogada não mantém o formulário');
 assert.deepEqual(erros,[]);
 console.log('PASSOU: nome editável, cadastro original em Brasília, e-mail protegido, persistência, sincronização entre sessões, rascunho, administração, revogação e responsividade nos dois temas.');
} finally {await browser.close();await env.cleanup();}
