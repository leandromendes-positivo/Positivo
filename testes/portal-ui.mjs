import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1440,height:1000}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
try{
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 await p.evaluate(()=>{
  Acesso.modo='firebase';Acesso.usuario={uid:'ana',email:'ana@empresa.com',nome:'Ana'};Acesso.perfil={email:'ana@empresa.com',perfil:'tecnico',ativo:true,tecnicoId:'PR--ANA'};
  Object.assign(PortalTecnico,{controle:{geracao:'geracao-ui',versao:1,atualizadoEm:'2026-10-19T09:00:00'},saldo:{nome:'Ana Silva'},pecas:[{id:'u-1',tipo:'usadas',mat:'USADA-1',descricao:'Placa usada',quantidade:2,chamado:'CH-123',nf:'NF-1'},{id:'n-1',tipo:'novas',mat:'NOVA-1',descricao:'Placa nova',quantidade:5,tipoEnvio:'Reposição'}],declaracoes:[]});
  montarMoldura();irPara('meu-painel');
 });
 assert.deepEqual(await p.locator('[data-nav]').evaluateAll(es=>es.map(e=>e.dataset.nav)),['meu-painel','conta']);
 assert.match(await p.locator('#conteudo').innerText(),/Ana Silva/);assert.match(await p.locator('#conteudo').innerText(),/USADA-1/);
 for(const pagina of ['usuarios','ferias','importar','painel','estoque','respostas-tecnicos']){
  await p.evaluate(pagina=>irPara(pagina),pagina);assert.equal(await p.evaluate(()=>UI.pagina),'meu-painel');
 }
 await p.locator('[data-peca="u-1"]').click();assert.equal(await p.locator('.modal [name="rmdf"]').count(),0);
 await p.locator('.modal [name="quantidadeDevolver"]').fill('1');await p.locator('.modal [data-enviar]').click();assert.match(await p.locator('.modal [data-erro]').innerText(),/data prevista/);
 await p.locator('.modal [data-fechar]').first().click();await p.locator('[data-peca="n-1"]').click();
 await p.locator('.modal [name="quantidadeDevolver"]').fill('4');await p.locator('.modal [name="quantidadeRmdf"]').fill('3');await p.locator('.modal [data-enviar]').click();assert.match(await p.locator('.modal [data-erro]').innerText(),/saldo/);
 await p.locator('.modal [name="quantidadeDevolver"]').fill('0');await p.locator('.modal [name="quantidadeRmdf"]').fill('2');await p.locator('.modal [name="rmdf"]').selectOption('aplicado');await p.locator('.modal [data-enviar]').click();assert.match(await p.locator('.modal [data-erro]').innerText(),/protocolo/);
 await p.evaluate(()=>{window.__declaracaoEnviada=null;salvarDeclaracaoTecnico=async(p,v,versao)=>{window.__declaracaoEnviada={p,v,versao};};});
 await p.locator('.modal [name="protocolo"]').fill('RMDF-123');await p.locator('.modal [data-enviar]').click();await p.waitForFunction(()=>window.__declaracaoEnviada);
 assert.equal(await p.evaluate(()=>window.__declaracaoEnviada.v.quantidadeRmdf),2);assert.equal(await p.evaluate(()=>window.__declaracaoEnviada.v.rmdf),'aplicado');
 await p.locator('[data-nav="conta"]').click();assert.match(await p.locator('#conteudo').innerText(),/somente suas peças/);
 await p.evaluate(()=>irPara('meu-painel'));
 fs.mkdirSync('capturas/portal',{recursive:true});
 for(const tema of ['light','dark'])for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:1000});await p.evaluate(tema=>document.documentElement.dataset.theme=tema,tema);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tema}/${width}: sem rolagem horizontal na página`);
  await p.screenshot({path:`capturas/portal/${tema}-${width}.png`,fullPage:true});
 }
 // O cadastro técnico apresenta escolha explícita e não depende do e-mail de contato.
 await p.evaluate(()=>{Acesso.perfil={perfil:'administrador',ativo:true};E.cadastro={ANA:{nome:'Ana Silva',regiao:'PR'},BRUNO:{nome:'Bruno',regiao:'SC'}};E.usuarios=[];montarMoldura();irPara('usuarios');});
 await p.locator('[data-acao="novo-acesso-tecnico"]').click();assert.equal(await p.locator('.modal [name="perfil"]').inputValue(),'tecnico');assert.equal(await p.locator('.modal [name="tecnicoId"]').isVisible(),true);
 assert.match(await p.locator('.modal [name="tecnicoId"]').innerText(),/Ana Silva · PR/);
 await p.locator('.modal [name="perfil"]').selectOption('usuario');assert.equal(await p.locator('.modal [name="tecnicoId"]').isVisible(),false);
 await p.locator('.modal [name="perfil"]').selectOption('tecnico');assert.equal(await p.locator('.modal [name="tecnicoId"]').isVisible(),true);
 // Mesmo sem o aviso do listener do perfil, a negação do estoque limpa a tela e verifica o acesso.
 const revogacao=await p.evaluate(async()=>{
  document.querySelectorAll('.modal-fundo').forEach(m=>m.remove());
  Acesso.perfil={perfil:'tecnico',ativo:true,tecnicoId:'PR--ANA'};
  Acesso.fs={doc:caminho=>caminho==='portal/controle'?{onSnapshot:(_opcoes,_next,erro)=>{window.__erroPortalTeste=erro;return()=>{};}}:{get:async()=>({exists:true,data:()=>({perfil:'tecnico',ativo:false,tecnicoId:'PR--ANA'})})},collection:()=>({onSnapshot:()=>()=>{}})};
  lerPerfilPortalNoServidor=async()=>({perfil:'tecnico',ativo:false,tecnicoId:'PR--ANA'});
  await carregarTudo();PortalTecnico.pecas=[{id:'protegida',quantidade:2}];E.status='pronto';
  await window.__erroPortalTeste({code:'permission-denied'});
  return {status:E.status,perfil:Acesso.perfil,pecas:PortalTecnico.pecas.length};
 });
 assert.deepEqual(revogacao,{status:'erro',perfil:null,pecas:0});
 assert.deepEqual(erros,[]);console.log('Portal UI: navegação restrita, cadastro, formulário de devolução/RMDF e telas em dois temas/3 larguras passaram.');
}finally{await browser.close();}
