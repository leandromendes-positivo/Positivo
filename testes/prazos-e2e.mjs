// Prazos pessoais: fronteiras, herança, histórico, mensagens e persistência em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { montarAviso } from '../aviso/enviar-aviso.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const saida = process.argv[2] || 'capturas/prazos'; fs.mkdirSync(saida,{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1050},colorScheme:'dark',locale:'pt-BR',reducedMotion:'reduce'});
  const erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.addInitScript(()=>{window.__CP_AGORA='2026-10-05T09:00:00';});
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(()=>E.status==='pronto');
  assert.equal(await page.evaluate(()=>Acesso.modo),'memoria');
  await page.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));
  await page.waitForFunction(()=>!!UI.im.resultado);
  const ids=await page.evaluate(()=>Object.fromEntries(['Ana','Maria','José'].map(nome=>[nome,derivar().tecnicos.find(t=>t.nome.startsWith(nome)).tid])));
  await page.locator('[data-nav="tecnicos"]').click();
  const editar=page.locator(`[data-acao="editar-prazos"][data-tid="${ids.Ana}"]`);
  await editar.click();
  await page.waitForFunction(()=>document.activeElement.name==='prazoUsadas');
  const usadas=page.locator('[name="prazoUsadas"]'),novas=page.locator('[name="prazoNovas"]');
  assert.equal(await usadas.inputValue(),'');assert.match(await usadas.getAttribute('placeholder'),/7 dias/);
  await usadas.fill('0');await page.locator('.modal [data-salvar]').click();
  assert.equal(await page.locator('.modal').count(),1,'prazo zero não salva');
  assert.equal(await usadas.evaluate(e=>e.checkValidity()),false);
  await usadas.fill('14');await novas.fill('15');
  await page.locator('.modal [data-salvar]').click();
  await page.waitForFunction(()=>!document.querySelector('.modal'));
  await page.waitForFunction(tid=>derivar().mapa.get(tid).prazo===14,ids.Ana);
  await page.waitForFunction(tid=>document.querySelector(`[data-acao="editar-prazos"][data-tid="${tid}"]`)?.textContent.includes('14 dias'),ids.Ana);
  assert.match(await editar.innerText(),/14 dias/); assert.match(await editar.innerText(),/15 dias/);
  const antes=await page.evaluate(async(ids)=>{
    await salvarTecnico(ids.Maria,{prazoUsadas:3,prazoNovas:3});
    const D=derivar(),a=D.mapa.get(ids.Ana),m=D.mapa.get(ids.Maria),j=D.mapa.get(ids.José);
    const resumo=montarResumo();
    return { ana:[a.prazo,a.alerta,a.nAtrasadas],maria:[m.prazo,m.alerta,m.nAtrasadas],jose:j.prazo,
      anaDia14:resumo.dias['2026-10-09'].cobrar.some(t=>t.nome===a.nome),anaDia15:resumo.dias['2026-10-10'].cobrar.find(t=>t.nome===a.nome)?.prazo,
      mensagem:montarMensagem(a,a.usadas,E.config.msgCobranca),resumo,
      regrasCurtas:statusUsada(3,'',regrasDoTecnico(ids.Maria),D.hoje),
      ranking:calcularDesempenho({periodo:'mes'}).atraso.map(t=>t.tid),
      consulta:filtrarConsulta(linhasConsulta(),{...FILTROS_CONSULTA,tid:ids.Ana,tipo:'usadas',situacao:'atrasada'}).length,
      regraDia1:regrasDoTecnico(ids.Maria).alerta };
  },ids);
  assert.deepEqual(antes.ana,[14,12,0]);assert.deepEqual(antes.maria,[3,1,1]);assert.equal(antes.jose,7);
  assert.equal(antes.anaDia14,false);assert.equal(antes.anaDia15,14);assert.equal(antes.regrasCurtas,'vencendo');
  assert.match(antes.mensagem,/prazo para devolver é de 14 dias/);assert.equal(antes.consulta,0);
  assert.equal(antes.ranking.includes(ids.Ana),false);assert.equal(antes.ranking.includes(ids.Maria),true);
  const aviso=montarAviso(antes.resumo,'2026-10-05');
  assert.match(aviso.texto,/prazo de 3 dias/);assert.doesNotMatch(aviso.texto,/com mais de 7 dias/);
  // Previsões já combinadas continuam prevalecendo para a fila de contato.
  const promessa=await page.evaluate(async(tid)=>{
    const i=derivar().mapa.get(tid).usadas[0];await definirPrevisao([i],'2026-10-04');
    const d=derivar().itens.find(x=>x.k===i.k);return [d.prazo,d.status,d.cobrar,d.atrasada];
  },ids.Ana);
  assert.deepEqual(promessa,[14,'previsao_vencida',true,false]);
  await page.evaluate(async(tid)=>{await definirPrevisao(derivar().mapa.get(tid).usadas,'');await carregarTudo();},ids.Ana);
  assert.deepEqual(await page.evaluate(tid=>[E.cadastro[tid].prazoUsadas,E.cadastro[tid].prazoNovas],ids.Ana),[14,15]);

  for(const tema of ['dark','light']) {
    if(await page.evaluate(()=>document.documentElement.dataset.theme)!==tema)await page.locator('.acoes-topo [data-acao="tema"]').click();
    await page.evaluate(tid=>irPara('tecnicos',{tid}),ids.Ana);
    await page.waitForTimeout(100); // aguarda a atualização debounced após recarregar o cadastro
    await page.locator('.ficha-prazos').screenshot({path:`${saida}/ficha-${tema}.png`});
    await page.locator('.ficha-prazos [data-acao="editar-prazos"]').click();
    await page.locator('.modal-corpo').evaluate(e=>e.scrollTop=0);
    await page.locator('.modal').screenshot({path:`${saida}/cadastro-${tema}.png`});
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('.modal-corpo').evaluate(e=>e.scrollWidth>e.clientWidth),false);
      await page.locator('.prazos-personalizados').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${saida}/cadastro-${tema}-${width}.png`});
    }
    await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1050});
  }
  // Importar a devolução conserva o prazo vigente, mesmo se o cadastro mudar depois.
  const historico=await page.evaluate(async(ids)=>{
    window.__CP_AGORA='2026-10-13T10:00:00';mudou();
    const nova=E.novas.find(n=>n.tid===ids.Ana&&n.qtd===9);
    const arquivos=[{tipo:'usadas',regiao:'PR',nome:'PR Usadas.csv',avisos:[],hash:'prazo-u',itens:E.usadas.filter(u=>u.regiao==='PR').map(u=>({...u,tecChave:E.cadastro[u.tid].chave,tecNome:E.cadastro[u.tid].nome,qtd:u.tid===ids.Ana&&u.qtd===2?1:u.qtd}))},
      {tipo:'novas',regiao:'PR',nome:'PR Novas.csv',avisos:[],hash:'prazo-n',itens:E.novas.filter(n=>n.regiao==='PR').map(n=>({...n,tecChave:E.cadastro[n.tid].chave,tecNome:E.cadastro[n.tid].nome,qtd:n===nova?n.qtd-3:n.qtd}))}];
    for(const a of arquivos)a.linhasLidas=a.itens.length;
    await importarLote(arquivos);await carregarTudo();
    await classificarSaida(E.movimentos[0].k,'devolucao',null,{condicao:'nova'});
    const antes={prazoUsadas:E.devolucoes[0].prazo,prazoNovas:E.movimentos[0].prazo};
    await salvarTecnico(ids.Ana,{prazoUsadas:30,prazoNovas:3});
    const D=derivar(),r=calcularDesempenho({tipo:'novas',periodo:'mes'}),u=calcularDesempenho({tipo:'usadas',periodo:'mes'});
    return {...antes, abertas:D.mapa.get(ids.Ana).nAtrasadas,atrasoHistorico:u.atraso.find(t=>t.tid===ids.Ana)?.atrasadas,devEmDia:r.pontualidade.find(t=>t.tid===ids.Ana)?.noPrazo,
      diasNovas:linhasConsulta().find(i=>i.tid===ids.Ana&&i.origem==='atual'&&i.tipo==='novas').atrasada,
      historicoConsulta:linhasConsulta().filter(i=>i.tid===ids.Ana&&i.origem!=='atual').map(i=>[i.tipo,i.prazo,i.atrasada]),prazoLegado:prazoDaDevolucao({tid:ids.Ana,dias:10})};
  },ids);
  assert.equal(historico.prazoUsadas,14);assert.equal(historico.prazoNovas,15);assert.equal(historico.abertas,0);
  assert.equal(historico.atrasoHistorico,1);assert.equal(historico.devEmDia,3);assert.equal(historico.diasNovas,true);
  assert.deepEqual(historico.historicoConsulta,[['usadas',14,true],['novas',15,false]]);assert.equal(historico.prazoLegado,7);
  // Os campos do modelo também rejeitam entradas inválidas, sem alterar o cadastro.
  const invalidos=await page.evaluate(async(tid)=>{
    const rejeitados=[];for(const prazo of [0,-1,91,2.5,'abc']){try{await salvarTecnico(tid,{prazoUsadas:prazo});rejeitados.push(false);}catch{rejeitados.push(true);}}
    const salvar=Armazem.mesclar;Armazem.mesclar=async()=>{throw new Error('falha simulada');};
    try{await salvarTecnico(tid,{prazoUsadas:25});}catch{}finally{Armazem.mesclar=salvar;}
    return [rejeitados,E.cadastro[tid].prazoUsadas];
  },ids.Ana);
  assert.deepEqual(invalidos,[[true,true,true,true,true],30]);
  await page.evaluate(async(tid)=>{await salvarConfig({prazo:9,prazoNovas:11});irPara('tecnicos',{tid});},ids.Ana);
  assert.deepEqual(await page.evaluate(tid=>[prazoDoTecnico(tid),prazoDoTecnico(tid,'novas')],ids.Ana),[30,3]);
  await page.locator('.ficha-prazos [data-acao="editar-prazos"]').click();
  await page.locator('[data-prazos-gerais]').click();
  assert.equal(await usadas.inputValue(),'');assert.equal(await novas.inputValue(),'');
  await page.locator('.modal [data-salvar]').click();await page.waitForFunction(()=>!document.querySelector('.modal'));
  await page.evaluate(()=>carregarTudo());
  assert.deepEqual(await page.evaluate(tid=>[E.cadastro[tid].prazoUsadas,E.cadastro[tid].prazoNovas,prazoDoTecnico(tid),prazoDoTecnico(tid,'novas')],ids.Ana),[null,null,9,11]);
  // Exportação inclui a regra efetivamente usada por cada técnico.
  await page.evaluate(async()=>{exportarExcel=async(nome,abas)=>{window.__exportacao=abas[0];};await exportarTecnicos();});
  const exportado=await page.evaluate(tid=>{const a=window.__exportacao;return [a.colunas.length,a.linhas.find(l=>l[0]===nomeTecnico(tid))];},ids.Ana);
  assert.equal(exportado[0],exportado[1].length);assert.deepEqual(exportado[1].slice(-5),[9,'Geral',11,'Geral','Não informado']);
  assert.deepEqual(erros,[]);
  console.log('PASSOU: prazos individuais por tipo, limites, herança, alertas, mensagens, resumo diário, histórico preservado, rankings, exportação, falha de gravação, persistência e dois temas no celular.');
} finally {await browser.close();}
