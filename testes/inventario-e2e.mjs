import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PW_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM});fs.mkdirSync('capturas/inventario',{recursive:true});
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>window.__CP_AGORA='2026-10-05T09:00:00');await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8002/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));await p.waitForFunction(()=>UI.im.resultado);
 const inicial=await p.evaluate(()=>{const t=derivar().tecnicos.find(t=>t.nome.startsWith('Ana'));return {tid:t.tid,qtd:t.nUsadas,novas:t.novasTodas};});
 const lote=await p.evaluate(async tid=>{
  window.__CP_AGORA='2026-10-13T09:00:00';mudou();
  const usada=E.usadas.find(i=>i.tid===tid&&i.qtd===2),nova=E.novas.find(i=>i.tid===tid&&i.qtd===9);
  const arquivos=[{tipo:'usadas',regiao:'PR',nome:'PR Usadas.csv',itens:E.usadas.filter(i=>i.regiao==='PR').map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome,qtd:i.k===usada.k?1:i.qtd})),hash:'parcial-u',avisos:[]},{tipo:'novas',regiao:'PR',nome:'PR Novas.csv',itens:E.novas.filter(i=>i.regiao==='PR').map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome,qtd:i===nova?6:i.qtd})),hash:'parcial-n',avisos:[]}];for(const a of arquivos)a.linhasLidas=a.itens.length;
  return (await importarLote(arquivos)).lote;
 },inicial.tid);
 await p.evaluate(tid=>{UIinventario.tid=tid;irPara('inventario');},inicial.tid);await p.waitForFunction(()=>!UIinventario.carregando&&UIinventario.chave!==null);
 let qtd=await p.evaluate(()=>{const l=filtrarInventario();return {abertas:somar(l.filter(i=>i.tipo==='usadas'&&i.estado==='em_estoque'),i=>i.qtd),devolvidas:somar(l.filter(i=>i.tipo==='usadas'&&i.estado==='devolvida'),i=>i.qtd),presumidas:somar(l.filter(i=>i.estado==='presumida'),i=>i.qtd)};});
 assert.deepEqual(qtd,{abertas:inicial.qtd-1,devolvidas:1,presumidas:3});
 await p.locator('[data-acao="consulta-classificar"]').click();await p.locator('#destino-saida').selectOption('uso');await p.locator('[data-salvar-destino]').click();await p.waitForFunction(()=>!UIinventario.carregando&&filtrarInventario().some(i=>i.estado==='uso'));
 // A ausência completa encerra o saldo, sem apagar as passagens anteriores.
 await p.evaluate(async tid=>{
  window.__CP_AGORA='2026-10-14T09:00:00';mudou();
  const arquivos=['usadas','novas'].map(tipo=>({tipo,regiao:'PR',nome:`PR ${tipo}.csv`,hash:`sumiu-${tipo}`,avisos:[],itens:E[tipo].filter(i=>i.regiao==='PR'&&i.tid!==tid).map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome}))}));for(const a of arquivos)a.linhasLidas=a.itens.length;
  await importarLote(arquivos);await carregarInventario();
 },inicial.tid);
 qtd=await p.evaluate(()=>{const l=filtrarInventario();return [somar(l.filter(i=>i.estado==='em_estoque'),i=>i.qtd),somar(l.filter(i=>i.tipo==='usadas'),i=>i.qtd),somar(l.filter(i=>i.tipo==='novas'),i=>i.qtd)];});
 assert.deepEqual(qtd,[0,inicial.qtd,inicial.novas]);
 // Registros de anos anteriores continuam disponíveis. Nada é fabricado fora do banco.
 await p.evaluate(async tid=>{
  await Armazem.gravar('devolucoes/legado-2024',{data:'2024-01-01',itens:[['antiga',tid,'99999','FT-HIST','2023-12-20',4,'2024-01-01 08:00',12,'PR','lote-legado',4,7,'2023-12-20','','']]});
  await Armazem.gravar('movimentos/legado-2024',{data:'2024-01-01',lote:'historico-novas',itens:[{k:'historico-nova',tid,mat:'88888',regiao:'PR',qtd:5,desde:'2023-12-20',em:'2024-01-01 08:00',dias:12,prazo:7,destino:'pendente'}]});
  await carregarTudo();await carregarInventario();irPara('inventario');
 },inicial.tid);
 assert.equal(await p.evaluate(()=>E.devolucoes.some(d=>d.k==='antiga')),false);
 assert.equal(await p.evaluate(()=>filtrarInventario().some(i=>i.k==='antiga'&&i.qtd===4)),true);
 await p.locator('[data-digitar="inventario-busca"]').fill('88888');await p.waitForFunction(()=>UIinventario.busca==='88888'&&!UIinventario.carregando&&document.querySelectorAll('.tabela-inventario tbody tr').length===1);await p.locator('[data-acao="consulta-classificar"]').click();await p.locator('#destino-saida').selectOption('devolucao');await p.locator('[data-salvar-destino]').click();await p.waitForFunction(()=>!UIinventario.carregando&&filtrarInventario()[0]?.estado==='devolvida');
 await p.evaluate(async()=>{exportarExcel=async(nome,abas)=>window.__exportacao=abas[0];await exportarInventario();});
 assert.deepEqual(await p.evaluate(()=>window.__exportacao.linhas.map(l=>[l[4],l[6],l[7]])),[['88888',5,'Devolvida']]);
 await p.evaluate(()=>{UIinventario.busca='';renderizar(true);});
 for(const tema of ['dark','light']){if(await p.evaluate(()=>document.documentElement.dataset.theme)!==tema)await p.locator('.acoes-topo [data-acao="tema"]').click();await p.waitForTimeout(100);await p.screenshot({path:`capturas/inventario/${tema}.png`,fullPage:true});for(const width of [390,320]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await p.setViewportSize({width:1440,height:1000});}
 // Desfazer a última foto volta ao saldo parcial e elimina somente as saídas dela.
 await p.evaluate(async()=>{await desfazerImportacao(E.importacoes.find(i=>!i.desfeito));await carregarInventario();});
 assert.equal(await p.evaluate(()=>somar(filtrarInventario().filter(i=>i.estado==='em_estoque'),i=>i.qtd)),inicial.qtd-1+inicial.novas-3);
 assert.equal(await p.evaluate(()=>filtrarInventario().some(i=>i.k==='antiga')),true);
 assert.deepEqual(erros,[]);console.log('PASSOU: estoque completo, saída integral/parcial, novas/usadas, histórico anterior a 120 dias, reclassificação antiga, exportação, desfazer e temas no celular.');
}finally{await browser.close();}
