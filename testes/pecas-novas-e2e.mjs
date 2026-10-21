// Menu de peças novas em memória, sem conexão ao projeto de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`),{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await browser.newPage({viewport:{width:1366,height:900}}),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 await p.locator('#entrada-topo').setInputFiles(fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));
 await p.waitForFunction(()=>UI.im.resultado&&!UI.im.processando);
 await p.locator('[data-nav="novas"]').click();assert.equal(await p.locator('#titulo').innerText(),'Peças novas');
 assert.equal(await p.locator('.consulta-form select[name="tipo"]').count(),0);assert.equal(await p.locator('.consulta-form input[name="tipo"]').inputValue(),'novas');
 assert.equal(await p.evaluate(()=>consultaOrdenada().length>0&&consultaOrdenada().every(i=>i.tipo==='novas')),true);
 await p.evaluate(()=>{UIconsulta.filtros.tipo='usadas';UIconsulta.filtros.tecnico='Ana';UIconsultaNovas.filtros.tecnico='sem resultado';renderizar(true);});
 await p.locator('[data-acao="consulta-limpar"]').first().click();assert.equal(await p.evaluate(()=>UIconsultaNovas.filtros.tipo),'novas');
 assert.equal(await p.evaluate(()=>UIconsulta.filtros.tecnico),'Ana','filtros da consulta geral permanecem separados');
 await p.locator('[data-acao="consulta-visao"][data-valor="tecnicos"]').click();assert.equal(await p.locator('#consulta-resultados th').filter({hasText:/^Usadas$/}).count(),0);
 await p.evaluate(()=>{window.__exportacaoNovas=null;exportarExcel=async(nome,abas)=>{window.__exportacaoNovas={nome,abas};};});
 await p.locator('[data-acao="consulta-exportar"]').click();await p.waitForFunction(()=>window.__exportacaoNovas);
 assert.match(await p.evaluate(()=>window.__exportacaoNovas.nome),/^pecas-novas-/);assert.equal(await p.evaluate(()=>window.__exportacaoNovas.abas[0].linhas.every(l=>l[5]==='novas')),true);
 await p.locator('[data-nav="consulta"]').click();assert.equal(await p.locator('[name="tipo"]').inputValue(),'usadas');assert.equal(await p.locator('[name="tecnico"]').inputValue(),'Ana');
 assert.equal(await p.evaluate(()=>consultaOrdenada().every(i=>i.tipo==='usadas')),true);
 await p.locator('[data-nav="novas"]').click();assert.equal(await p.evaluate(()=>UIconsultaNovas.visao),'tecnicos');
 for(const width of [1366,390,320]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await p.evaluate(()=>{Acesso.modo='firebase';Acesso.perfil={perfil:'tecnico',ativo:true,tecnicoId:'PR--ANA'};montarMoldura();irPara('novas');});
 assert.equal(await p.evaluate(()=>UI.pagina),'meu-painel');assert.equal(await p.locator('[data-nav="novas"]').count(),0);
 assert.deepEqual(erros,[]);console.log('Peças novas: menu, consulta exclusiva, filtros independentes, agrupamento, exportação, responsividade e bloqueio do perfil técnico passaram.');
}finally{await browser.close();}
