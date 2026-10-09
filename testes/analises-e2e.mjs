// Consulta, cálculos auditáveis e saídas de estoque; somente banco em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const saida = process.argv[2] || 'capturas/analises'; fs.mkdirSync(saida,{recursive:true});
const url = process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html';
const erros = [];
async function abrir() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, locale:'pt-BR', colorScheme:'dark', timezoneId:'America/Sao_Paulo' });
  page.on('pageerror',e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(url); await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo),'memoria'); return page;
}
try {
  const modelo = await abrir();
  const calculos = await modelo.evaluate(() => {
    window.__CP_AGORA = '2026-10-18T09:00:00';
    E.cadastro = { a:{nome:'ANA',tipo:'tecnico'},b:{nome:'BIA',tipo:'tecnico'},base:{nome:'BASE',tipo:'base'},x:{nome:'EXCLUÍDO',tipo:'ignorar'} };
    E.catalogo = { M1:'MEMÓRIA 8GB DDR4',M2:'SSD 256GB',M3:'BATERIA' };
    E.usadas = [
      { k:'a1',tid:'a',regiao:'PR',mat:'M1',qtd:3,qtdUso:5,dataFT:'2026-10-01',desde:'2026-10-01' },
      { k:'b1',tid:'b',regiao:'SC',mat:'M2',qtd:2,dataFT:'2026-10-14',desde:'2026-10-14' },
      { k:'base',tid:'base',regiao:'PR',mat:'M1',qtd:100,dataFT:'2026-10-01',desde:'2026-10-01' },
      { k:'sem',tid:'a',regiao:'PR',mat:'M3',qtd:1,dataFT:null,desde:'2026-10-17' },
    ];
    E.devolucoes = [
      { k:'a1',tid:'a',regiao:'PR',mat:'M1',qtd:2,qtdUso:5,dataFT:'2026-10-01',desde:'2026-10-01',em:'2026-10-15',dias:14,prazo:7 },
      { k:'b0',tid:'b',regiao:'SC',mat:'M2',qtd:3,dataFT:'2026-10-11',em:'2026-10-16',dias:5,prazo:7 },
      { k:'set',tid:'a',regiao:'PR',mat:'M1',qtd:20,dataFT:'2026-09-02',em:'2026-09-15',dias:13,prazo:7 },
    ];
    E.novas = [{tid:'a',regiao:'PR',mat:'M1',qtd:4,desde:'2026-10-01',tipoEnvio:'BACKUP'}];
    E.movimentos = [
      { k:'m1',tid:'a',regiao:'PR',mat:'M1',qtd:3,desde:'2026-10-01',em:'2026-10-14',dias:13,prazo:7,destino:'devolucao' },
      { k:'m2',tid:'b',regiao:'SC',mat:'M2',qtd:5,desde:'2026-10-10',em:'2026-10-12',dias:2,prazo:7,destino:'uso' },
      { k:'m3',tid:'a',regiao:'PR',mat:'M3',qtd:7,desde:'2026-10-10',em:'2026-10-15',dias:5,prazo:7,destino:'pendente' },
      { k:'m4',tid:'b',regiao:'SC',mat:'M2',qtd:2,desde:'2026-10-10',em:'2026-10-14',dias:4,prazo:7,destino:'devolucao' },
    ];
    mudou();
    const w=calcularDesempenho({periodo:'semana'}),m=calcularDesempenho({periodo:'mes'}),n=calcularDesempenho({tipo:'novas'});
    const filtro=(f) => filtrarConsulta(linhasConsulta(),{...FILTROS_CONSULTA,...f}).map(i=>[i.mat,i.qtd]);
    return { semana:[w.inicio,w.fim], mes:[m.inicio,m.fim], atraso:w.atraso.map(t=>[t.tid,t.atrasadas,t.abertas,t.encerradas,t.maiorAtraso]), pontualidade:w.pontualidade.map(t=>[t.tid,t.noPrazo,t.taxa]), usoSemana:w.uso.map(t=>[t.tid,t.uso]), usoMes:m.uso.map(t=>[t.tid,t.uso]), novasAtraso:n.atraso.map(t=>[t.tid,t.atrasadas]), novasUso:n.uso.map(t=>[t.tid,t.uso]), novasPontualidade:n.pontualidade.map(t=>[t.tid,t.noPrazo]), semData:w.semData, filtro:filtro({busca:'memoria 8gb',tipo:'usadas'}), filtroOr:filtro({busca:'M1;M2',correspondencia:'codigo',tipo:'usadas',regiao:'SC'}), vencimento:statusUsada(7,'',{prazo:7,alerta:5},'2026-10-18'), fronteira:periodoDesempenho('semana','2026-10-05').inicio, ano:periodoDesempenho('semana','2026-01-01').inicio };
  });
  assert.deepEqual(calculos.semana,['2026-10-12','2026-10-18']);
  assert.deepEqual(calculos.mes,['2026-10-01','2026-10-18']);
  assert.deepEqual(calculos.atraso,[['a',5,3,2,10]]);
  assert.deepEqual(calculos.pontualidade,[['b',3,1]]);
  assert.deepEqual(calculos.usoSemana,[['b',2]]);
  assert.deepEqual(calculos.usoMes,[['a',5],['b',5]]);
  assert.deepEqual(calculos.novasAtraso,[['a',7]]);
  assert.deepEqual(calculos.novasUso,[['b',5]]);
  assert.deepEqual(calculos.novasPontualidade,[['b',2]]);
  assert.equal(calculos.semData,1); assert.deepEqual(calculos.filtro,[['M1',3]]);
  assert.deepEqual(calculos.filtroOr,[['M2',2]]);
  assert.equal(calculos.vencimento,'vencendo'); assert.equal(calculos.fronteira,'2026-10-05'); assert.equal(calculos.ano,'2025-12-29');
  await modelo.evaluate(() => irPara('painel'));
  for(const tema of ['dark','light']) {
    if(await modelo.evaluate(()=>document.documentElement.dataset.theme)!==tema) await modelo.locator('.acoes-topo [data-acao="tema"]').click();
    await modelo.locator('[data-acao="ranking-filtro"][data-valor="mes"]').click();
    await modelo.locator('.desempenho').scrollIntoViewIfNeeded();
    await modelo.locator('.desempenho').screenshot({path:`${saida}/rankings-${tema}.png`,animations:'disabled'});
    await modelo.locator('.ranking-uso .rank-item').first().click();
    assert.match(await modelo.locator('.modal-corpo').innerText(),/MEMÓRIA/);
    await modelo.locator('.modal').screenshot({path:`${saida}/detalhe-${tema}.png`,animations:'disabled'});
    await modelo.keyboard.press('Escape');
    for(const width of [390,320]) {
      await modelo.setViewportSize({width,height:844});
      assert.equal(await modelo.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`ranking ${width}/${tema} sem overflow`);
      await modelo.locator('.desempenho').screenshot({path:`${saida}/rankings-${tema}-${width}.png`,animations:'disabled'});
    }
    await modelo.setViewportSize({width:1440,height:1050});
  }
  await modelo.emulateMedia({reducedMotion:'reduce'});
  await modelo.locator('[data-acao="ranking-filtro"][data-valor="semana"]').click();
  assert.equal(await modelo.locator('.rank-trilho i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await modelo.evaluate(() => {
    for (let n=0;n<60;n++) {
      const tid='extra'+n; E.cadastro[tid]={nome:'Técnico '+n,tipo:'tecnico'};
      E.usadas.push({k:tid,tid,regiao:'PR',mat:'M1',qtd:1,qtdUso:1,dataFT:'2026-10-01',desde:'2026-10-01'});
    }
    mudou(); renderizar(true);
  });
  await modelo.locator('.ranking-atraso [data-acao="ranking-completo"]').click();
  assert.equal(await modelo.locator('.modal .rank-item').count(),61);
  await modelo.locator('.modal .rank-item').first().click();
  assert.equal(await modelo.locator('.modal').count(),2);
  await modelo.keyboard.press('Escape'); await modelo.keyboard.press('Escape');
  await modelo.locator('[data-nav="consulta"]').click();
  assert.equal(await modelo.locator('.tabela-consulta tbody tr').count(),50);
  await modelo.locator('[data-acao="pagina"][data-p="2"]').click();
  assert.equal(await modelo.locator('.tabela-consulta tbody tr').count(),14);
  await modelo.evaluate(()=>{exportarExcel=async(nome,abas)=>{window.__linhasExportadas=abas[0].linhas.length;};});
  await modelo.locator('[data-acao="consulta-exportar"]').click();
  assert.equal(await modelo.evaluate(()=>window.__linhasExportadas),64);
  await modelo.close();

  const page = await abrir();
  await page.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));
  await page.waitForFunction(()=>!!UI.im.resultado);
  await page.locator('[data-nav="consulta"]').click();
  const form = page.locator('[data-form="consulta"]');
  await form.locator('[name="busca"]').fill('000000000011144611');
  await form.locator('[name="correspondencia"]').selectOption('codigo');
  await form.locator('[type="submit"]').first().click();
  assert.equal(await page.locator('.consulta-metricas dd').first().innerText(),'12');
  assert.equal(await page.locator('.tabela-consulta tbody tr').count(),3);
  await page.locator('[data-acao="consulta-visao"][data-valor="tecnicos"]').click();
  assert.equal(await page.locator('#consulta-resultados tbody tr').count(),2);
  await page.locator('[data-acao="consulta-responsavel"]').first().click();
  assert.equal(await page.locator('.tabela-consulta tbody tr').count(),1);
  await page.locator('[data-acao="consulta-limpar"]').first().click();
  await form.locator('[name="tecnico"]').fill('jose');
  await form.locator('[name="tipo"]').selectOption('usadas');
  await form.locator('summary').click();
  await form.locator('[name="diasMin"]').fill('10');
  await form.locator('[name="regiao"]').selectOption('PR');
  await form.locator('[type="submit"]').last().click();
  assert.equal(await page.locator('.tabela-consulta tbody tr').count(),2);
  // A exportação usa todas as linhas filtradas, não apenas a página visível.
  await page.evaluate(()=>{ window.__exportacao=null; exportarExcel=async (nome,abas)=>{window.__exportacao={nome,abas};}; });
  await page.locator('[data-acao="consulta-exportar"]').click();
  assert.equal(await page.evaluate(()=>window.__exportacao.abas[0].linhas.length),2);
  for(const tema of ['dark','light']) {
    if(await page.evaluate(()=>document.documentElement.dataset.theme)!==tema) await page.locator('.acoes-topo [data-acao="tema"]').click();
    await page.screenshot({path:`${saida}/consulta-${tema}.png`,fullPage:true,animations:'disabled'});
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`consulta ${width}/${tema} sem overflow`);
      await page.screenshot({path:`${saida}/consulta-${tema}-${width}.png`,fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({width:1440,height:1050});
  }
  // Comparação de fotos e persistência: queda parcial, troca de tipo e reimportação.
  const movimento = await page.evaluate(async () => {
    window.__CP_AGORA='2026-10-13T09:00:00';
    const linha = E.novas.find(i=>i.mat==='11144311') || E.novas.find(i=>i.qtd===9);
    const tid=linha.tid, cad=E.cadastro[tid];
    const itens = E.novas.filter(n=>n.regiao==='PR').map(n=>({tecChave:E.cadastro[n.tid].chave,tecNome:E.cadastro[n.tid].nome,mat:n.mat,desc:E.catalogo[n.mat],tipoEnvio:n.tipoEnvio,qtd:n.qtd-(n===linha?3:0)}));
    const lido={tipo:'novas',regiao:'PR',nome:'PR Novas.csv',itens,linhasLidas:itens.length,avisos:[],hash:'dia2'};
    const r=await importarLote([lido]);
    await carregarTudo();
    const m=E.movimentos.find(m=>m.tid===tid);
    const repetido=compararFoto(lido,hojeISO(),agoraISO(),'repetido').movimentos;
    const tipoNovo={...lido,itens:lido.itens.map(i=>({...i,tipoEnvio:i.tipoEnvio==='BACKUP'?'PP':'BACKUP'}))};
    const trocado=compararFoto(tipoNovo,hojeISO(),agoraISO(),'tipo');
    return {k:m.k,qtd:m.qtd,dias:m.dias,destino:m.destino,lote:r.lote,tid,mat:m.mat,repetido:repetido.length,troca:trocado.movimentos.length,desde:trocado.linhas.find(n=>n.tid===tid&&n.mat===m.mat).desde};
  });
  assert.equal(movimento.qtd,3); assert.equal(movimento.dias,8); assert.equal(movimento.destino,'pendente');
  assert.equal(movimento.repetido,0); assert.equal(movimento.troca,0); assert.equal(movimento.desde,'2026-10-05');
  await page.evaluate(()=>{UIconsulta.filtros={...FILTROS_CONSULTA,tipo:'novas',origem:'saida'};irPara('consulta');});
  await page.locator('[data-acao="consulta-classificar"]').click();
  await page.selectOption('#destino-saida','uso');
  await page.locator('[data-salvar-destino]').click();
  await page.waitForFunction(()=>!document.querySelector('.modal'));
  assert.equal(await page.evaluate(()=>calcularDesempenho({tipo:'novas'}).uso[0].uso),3);
  await page.evaluate(()=>carregarTudo());
  assert.equal(await page.evaluate(()=>E.movimentos[0].destino),'uso');
  await page.evaluate(async (k)=>{await classificarSaida(k,'devolucao',null,{condicao:'nova'});},movimento.k);
  assert.equal(await page.evaluate(()=>calcularDesempenho({tipo:'novas'}).uso.length),0,'reclassificar remove consumo');
  await page.evaluate(async (k)=>{await classificarSaida(k,'uso',2); await carregarTudo();},movimento.k);
  assert.deepEqual(await page.evaluate(()=>[somar(E.movimentos,m=>m.qtd),calcularDesempenho({tipo:'novas'}).uso[0].uso,E.movimentos.filter(m=>m.destino==='devolucao')[0].qtd]),[3,2,1],'classificação parcial conserva o total e separa os destinos');
  const parcial = await page.evaluate(async()=>{
    window.__CP_AGORA='2026-10-13T10:00:00';
    const itens=E.usadas.filter(u=>u.regiao==='PR').map(u=>({...u,tecChave:E.cadastro[u.tid].chave,tecNome:E.cadastro[u.tid].nome,qtd:u.qtd===2?1:u.qtd}));
    const r=await importarLote([{tipo:'usadas',regiao:'PR',nome:'PR Usadas.csv',itens,linhasLidas:itens.length,avisos:[],hash:'parcial'}]);
    await carregarTudo();
    const devolucao=E.devolucoes.find(d=>d.lote===r.lote);
    return {qtd:devolucao.qtd,qtdUso:devolucao.qtdUso,k:devolucao.k,repeticao:compararFoto({tipo:'usadas',regiao:'PR',itens},hojeISO(),agoraISO(),'repetida').devolvidas.length};
  });
  assert.equal(parcial.qtd,1); assert.equal(parcial.qtdUso,2); assert.equal(parcial.repeticao,0);
  await page.evaluate(async(lote)=>{await desfazerImportacao(E.importacoes.find(i=>i.id===lote));},movimento.lote);
  assert.equal(await page.evaluate(()=>E.movimentos.length),0,'desfazer remove saídas e classificação');
  assert.deepEqual(erros,[]);
  console.log('PASSOU: filtros combinados, código com zeros, agrupamento, exportação, períodos, ranking por quantidade, pontualidade, consumo sem duplicação, saídas classificadas, baixa parcial, persistência, desfazer, temas, celular e movimento reduzido.');
} finally { await browser.close(); }
