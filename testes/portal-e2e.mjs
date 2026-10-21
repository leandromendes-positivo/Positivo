// Fluxo completo em Auth/Firestore locais: cadastro, importação, painel, resposta, desfazer e revogar.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {chromium}=require('playwright');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
await prepararEmulador();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});const erros=[],diagnosticos=[];
async function abrir(email){
 const ctx=await browser.newContext({viewport:{width:1360,height:1000},locale:'pt-BR'});
 await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.resolve(process.env.FIREBASE_SDK_DIR||'seguranca/node_modules/firebase',r.request().url().split('/').at(-1)),contentType:'application/javascript'}));
 const p=await ctx.newPage();p.on('pageerror',e=>erros.push(e.message));p.on('console',m=>{if(m.type()==='error')diagnosticos.push(m.text());});
 await p.addInitScript(email=>{window.CP_FIREBASE={apiKey:'chave-de-teste',projectId:'demo-controle-pecas',authDomain:'demo-controle-pecas.firebaseapp.com'};window.__CP_FIREBASE_EMULADOR__=true;window.__CP_LOGIN_TESTE__={sub:'uid-'+email,email,email_verified:true};},email);
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>['pronto','erro'].includes(E.status));
 assert.equal(await p.evaluate(()=>E.status),'pronto',await p.locator('#conteudo').innerText());return p;
}
try{
 const admin=await abrir('teste@exemplo.com');
 await admin.evaluate(async()=>{
  const item=(regiao,tipo,mat,qtd)=>({tipo,regiao,nome:`${regiao}-${tipo}.csv`,hash:mat,linhasLidas:1,avisos:[],itens:[{tecNome:'ANA PORTAL',tecChave:'ANA PORTAL',mat,desc:`Peça ${mat}`,qtd,nf:'NF1',remessa:'REM1',chamado:'CH1',dataFT:'2026-10-19',qtdUso:qtd,tipoEnvio:'BACKUP'}]});
  await importarLote([item('PR','usadas','USADA-PR',2),item('PR','novas','NOVA-PR',5),item('SC','usadas','SEGREDO-SC',9)]);
  if(!opcoesVinculoTecnico().some(t=>t.id==='SC--ANA_PORTAL'))throw new Error('O estoque da segunda UF precisa estar disponível para vínculo explícito.');
  irPara('usuarios');
 });
 await admin.locator('[data-acao="novo-acesso-tecnico"]').click();await admin.locator('.modal [name="email"]').fill('ana@empresa.com');await admin.locator('.modal [name="gerarSenha"]').uncheck();await admin.locator('.modal [name="tecnicoId"]').selectOption('PR--ANA_PORTAL');await admin.locator('.modal [data-salvar]').click();
 await admin.waitForFunction(()=>E.usuarios.some(u=>u.email==='ana@empresa.com'&&u.perfil==='tecnico'));
 const duplicado=await admin.evaluate(async()=>{try{await salvarUsuario('duplicado@empresa.com','tecnico',true,'PR--ANA_PORTAL');return '';}catch(e){return e.message;}});assert.match(duplicado,/já está vinculado/);
 const tec=await abrir('ana@empresa.com');
 await tec.getByText('USADA-PR',{exact:true}).waitFor();
 assert.equal(await tec.evaluate(()=>UI.pagina),'meu-painel');assert.deepEqual(await tec.evaluate(()=>[E.usadas.length,E.novas.length,Object.keys(E.cadastro).length,E.usuarios.length,E.ferias.length]),[0,0,0,0,0]);
 assert.equal(await tec.locator('[data-nav="importar"]').count(),0);assert.match(await tec.locator('#conteudo').innerText(),/USADA-PR/);assert.doesNotMatch(await tec.locator('#conteudo').innerText(),/SEGREDO-SC/);
 const negados=await tec.evaluate(async()=>{
  const respostas=[];for(const p of ['dados/indice','cadastro/tecnicos','usuarios/teste@exemplo.com']){try{await Acesso.fs.doc(p).get({source:'server'});respostas.push(false);}catch(e){respostas.push(e.code==='permission-denied');}}
  try{await Acesso.fs.collection(`saldos_tecnicos/SC--ANA_PORTAL/geracoes/${PortalTecnico.controle.geracao}/pecas`).get({source:'server'});respostas.push(false);}catch(e){respostas.push(e.code==='permission-denied');}
  return respostas;
 });assert.deepEqual(negados,[true,true,true,true]);
 const nova=await tec.evaluate(()=>PortalTecnico.pecas.find(p=>p.tipo==='novas').id);await tec.locator(`[data-peca="${nova}"]`).click();
 await tec.locator('.modal [name="quantidadeDevolver"]').fill('2');await tec.evaluate(()=>document.querySelector('#portal-declaracao').elements.previsao.value='2026-10-25');
 await tec.locator('.modal [name="quantidadeRmdf"]').fill('1');await tec.locator('.modal [name="rmdf"]').selectOption('aplicado');await tec.locator('.modal [name="protocolo"]').fill('RMDF-123');await tec.locator('.modal [data-enviar]').click();
 await tec.waitForFunction(()=>PortalTecnico.declaracoes.some(d=>d.protocolo==='RMDF-123'));
 assert.equal(await tec.evaluate(()=>PortalTecnico.pecas.find(p=>p.tipo==='novas').quantidade),5,'declaração não altera saldo');
 await admin.evaluate(()=>irPara('respostas-tecnicos'));await admin.waitForFunction(()=>RespostasTecnicos.eventos.some(d=>d.protocolo==='RMDF-123'));await admin.locator('#conteudo .portal-historico').waitFor();assert.match(await admin.locator('#conteudo').innerText(),/ana@empresa.com/);
 await tec.locator('[data-acao="portal-historico"]').click();await tec.locator('.modal').waitFor();assert.match(await tec.locator('.modal').innerText(),/RMDF-123/);await tec.locator('.modal [data-fechar]').first().click();
 // Esvaziar uma UF elimina o saldo publicado dela, sem copiar o saldo de outra UF.
 await admin.evaluate(async()=>{window.__zerarPortal=await importarLote(['usadas','novas'].map(tipo=>({tipo,regiao:'PR',nome:`PR-${tipo}.csv`,hash:'vazio-'+tipo,linhasLidas:0,avisos:[],itens:[]})));});
 await tec.waitForFunction(()=>E.status==='pronto'&&PortalTecnico.pecas.length===0);assert.doesNotMatch(await tec.locator('#conteudo').innerText(),/SEGREDO-SC/);
 await admin.evaluate(async()=>desfazerImportacao(E.importacoes.find(i=>i.id===window.__zerarPortal.lote)));
 await tec.waitForFunction(()=>E.status==='pronto'&&PortalTecnico.pecas.length===2);await tec.getByText('Relatório anterior: confira novamente o saldo.',{exact:true}).first().waitFor();assert.match(await tec.locator('#conteudo').innerText(),/Relatório anterior/);
 await admin.evaluate(()=>salvarUsuario('ana@empresa.com','tecnico',false,'PR--ANA_PORTAL'));
 try {await tec.waitForFunction(()=>E.status==='erro'&&Acesso.perfil===null);} catch(e) {
  const estado=await tec.evaluate(()=>({status:E.status,perfil:Acesso.perfil,erro:E.erro,pecas:PortalTecnico.pecas.length}));
  const cadastro=await admin.evaluate(async()=>(await Acesso.fs.doc('usuarios/ana@empresa.com').get({source:'server'})).data().ativo);
  const propriaLeitura=await tec.evaluate(async()=>{try{return {email:identidadeAtual().email,perfil:(await Acesso.fs.doc(`usuarios/${identidadeAtual().email}`).get({source:'server'})).data()};}catch(e){return {code:e.code,message:e.message};}});
  throw new Error(`A sessão deve ser bloqueada após revogação. Estado fictício: ${JSON.stringify({estado,ativoNoBanco:cadastro,propriaLeitura,erros,diagnosticos:diagnosticos.slice(-8)})}`);
 }
 assert.equal(await tec.evaluate(()=>PortalTecnico.pecas.length),0);
 assert.deepEqual(erros,[]);console.log('Portal E2E: cadastro e vínculo exclusivo, login real no emulador, isolamento por UF, devolução/RMDF, histórico, importação vazia, desfazer e revogação passaram.');
}finally{await browser.close();await env.cleanup();}
