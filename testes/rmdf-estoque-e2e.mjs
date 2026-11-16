// Categorias físicas, devoluções e relatórios em memória. Nenhum dado ou e-mail de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preencherData} from './calendario-ajudante.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await browser.newPage({viewport:{width:1366,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),erros=[];
 p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>window.__CP_AGORA='2026-11-16T12:00:00-03:00');
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.evaluate(async()=>{
  window.__linhaRmdfTeste=(mat,qtd,dataFT,tec='ANA EXEMPLO')=>({tecChave:tec,tecNome:tec,mat,desc:'Material fictício '+mat,qtd,nf:'NF-'+mat,remessa:'REM-'+mat,chamado:'CH-'+mat,dataFT,matSol:mat,tipoEnvio:'BACKUP'});
  window.__arquivoRmdfTeste=(tipo,itens)=>({tipo,regiao:'PR',nome:`PR ${tipo}.csv`,hash:crypto.randomUUID(),avisos:[],linhasLidas:itens.length,itens});
  const linha=window.__linhaRmdfTeste,arquivo=window.__arquivoRmdfTeste;
  await importarLote([arquivo('novas',[linha('001',5,null)]),arquivo('usadas',[linha('002',2,'2026-11-15 10:00')]),arquivo('rmdf',[linha('003',3,'2026-11-01 10:00'),linha('002',1,'2026-11-15 10:00'),linha('004',2,null,'BRUNO EXEMPLO')])]);
  window.__tidRmdfTeste=E.rmdf.find(i=>i.mat==='003').tid;
  await salvarTecnico(window.__tidRmdfTeste,{prazoUsadas:3,meta:2});
 });
 const estado=await p.evaluate(()=>{
  const d=derivar(),t=d.mapa.get(window.__tidRmdfTeste),r=dadosPdfTecnico(t.tid,'PR'),atrasada=t.rmdf.find(i=>i.mat==='003');
  return {k:{novas:d.kpi.novas,usadas:d.kpi.usadas,rmdf:d.kpi.rmdf,estoque:d.kpi.estoque,atrasadas:d.kpi.atrasadas},total:r.total,grupos:r.grupos.map(g=>g.quantidade),prazo:atrasada.prazo,dias:atrasada.dias,excesso:t.excessoNovas,retornos:pecasCobranca(t,'retornos').reduce((s,i)=>s+i.qtd,0),distintas:t.usadas.find(i=>i.mat==='002').k!==t.rmdf.find(i=>i.mat==='002').k,resumo:montarResumo().dias[d.hoje].totalPecas};
 });
 assert.deepEqual(estado,{k:{novas:5,usadas:2,rmdf:6,estoque:13,atrasadas:3},total:11,grupos:[5,2,4],prazo:3,dias:15,excesso:3,retornos:6,distintas:true,resumo:3});
 await p.evaluate(()=>irPara('rmdf'));
 assert.equal(await p.locator('[data-tipo-peca="rmdf"]').count(),3);
 assert.doesNotMatch(await p.locator('#conteudo').innerText(),/relação separada|não comprova|Somente consulta/i);
 await p.locator('[data-mudar="rmdf-status"]').selectOption('atrasadas');assert.equal(await p.locator('tbody tr').count(),1);
 await p.locator('[data-acao="rmdf-cobrar"]').click();
 assert.match(await p.locator('#cob-texto').inputValue(),/peças RMDF \(com defeito\)/);
 assert.doesNotMatch(await p.locator('#cob-email-corpo').inputValue(),/peças novas abaixo|peças usadas pendentes/);
 await p.locator('.modal [data-fechar]').first().click();
 await p.evaluate(async()=>{
  const t=derivar().mapa.get(window.__tidRmdfTeste),i=t.rmdf.find(i=>i.mat==='003');
  await registrarCobranca(t.tid,{tipo:'rmdf',canal:'email',itens:[i],obs:'Contato fictício registrado para o teste.'});
 });
 await p.locator('[data-acao="rmdf-previsao"]').click();
 await p.locator('#confirmacao-contato').selectOption({index:1});await preencherData(p.locator('#confirmacao-data'),'2026-11-20');
 await p.locator('#confirmacao-email').fill('Re: RMDF — mensagem fictícia de teste');
 const selecionada=p.locator('.confirmacao-peca').filter({has:p.locator('[data-incluir]:checked')});
 assert.equal(await selecionada.count(),1);await selecionada.locator('[data-quantidade]').fill('2');
 assert.equal(await selecionada.locator('[data-condicao]').count(),0,'RMDF já é a condição da peça; não é uma nova a reclassificar');
 await p.locator('#confirmacao-ateste').check();await p.locator('[data-salvar-confirmacao]').click();await p.waitForFunction(()=>!document.querySelector('.modal'));
 const agenda=await p.evaluate(()=>{
  const d=derivar(),t=d.mapa.get(window.__tidRmdfTeste),i=t.rmdf.find(i=>i.mat==='003');
  return {tipo:E.agendamentos[0].confirmacao.tipo,qtd:i.qtdPrevista,cobrar:selecionarAbaCobranca(t.rmdf,'cobrar',d.hoje).reduce((s,i)=>s+i.qtd,0),usadaAgendada:t.usadas[0].qtdPrevista,total:itensAgendaCompleta(d).reduce((s,i)=>s+i.qtd,0)};
 });assert.deepEqual(agenda,{tipo:'rmdf',qtd:2,cobrar:1,usadaAgendada:0,total:2});
 // A redução parcial gera devolução RMDF, preserva o prazo da saída e reduz a previsão.
 await p.evaluate(async()=>{
  window.__CP_AGORA='2026-11-17T12:00:00-03:00';
  const linha=window.__linhaRmdfTeste,arquivo=window.__arquivoRmdfTeste;
  await importarLote([arquivo('rmdf',[linha('003',1,'2026-11-01 10:00'),linha('002',1,'2026-11-15 10:00'),linha('004',2,null,'BRUNO EXEMPLO')])]);
 });
 const parcial=await p.evaluate(()=>({dev:E.devolucoes.map(i=>({tipo:i.tipo,qtd:i.qtd,prazo:i.prazo,dias:i.dias})),prev:derivar().rmdf.find(i=>i.mat==='003').qtdPrevista,usadas:E.usadas[0].qtd,estoque:derivar().kpi.estoque}));
 assert.deepEqual(parcial,{dev:[{tipo:'rmdf',qtd:2,prazo:3,dias:16}],prev:0,usadas:2,estoque:11});
 // Reclassificação de nova em RMDF no mesmo lote, independente da ordem dos arquivos.
 await p.evaluate(async()=>{
  const linha=window.__linhaRmdfTeste,arquivo=window.__arquivoRmdfTeste;
  await importarLote([arquivo('rmdf',[linha('003',1,'2026-11-01 10:00'),linha('002',1,'2026-11-15 10:00'),linha('004',2,null,'BRUNO EXEMPLO'),linha('001',2,'2026-11-17 10:00')]),arquivo('novas',[linha('001',3,null)])]);
 });
 const transicao=await p.evaluate(()=>({estoque:derivar().kpi.estoque,mov:E.movimentos.map(m=>({qtd:m.qtd,destino:m.destino})),devolvidas:E.devolucoes.reduce((s,i)=>s+i.qtd,0),metas:derivar().mapa.get(window.__tidRmdfTeste).novasQtd,consulta:filtrarConsulta(linhasConsulta(),{tipo:'rmdf',origem:'atual'}).reduce((s,i)=>s+i.qtd,0)}));
 assert.deepEqual(transicao,{estoque:11,mov:[{qtd:2,destino:'rmdf'}],devolvidas:2,metas:3,consulta:6});
 const trocaSimultanea=await p.evaluate(()=>{
  const fotos=new Map([['rmdf:PR',{linhas:[{k:'nova-referencia',tid:'T',mat:'M',qtd:2}]}],['novas:PR',{movimentos:[{k:'saida-teste',tid:'T',mat:'M',qtd:2,destino:'pendente'}]}]]);
  reconciliarRmdfNoLote(fotos,{rmdf:[{k:'referencia-devolvida',tid:'T',regiao:'PR',mat:'M',qtd:2}]});
  return fotos.get('novas:PR').movimentos.map(i=>[i.qtd,i.destino]);
 });assert.deepEqual(trocaSimultanea,[[2,'rmdf']],'a devolução de outra peça RMDF do mesmo material não apaga a nova entrada');
 const relatorio=await p.evaluate(()=>{
  const d=derivar(),h={devolucoes:E.devolucoes,movimentos:E.movimentos},f={inicio:'2026-11-01',fim:d.hoje,tipo:'rmdf',regiao:'PR',tid:''},r=calcularRelatorio(f,h,d);
  const r2=calcularRelatorio({...f,tipo:''},h,d),abas=abasRelatorio(r);
  return {estoque:r.k.estoque,rmdf:r.k.rmdf,novas:r.k.novas,devolvidas:r.k.devolvidas,uso:r.k.uso,reclassificadas:r2.k.reclassificadas,total:r2.k.estoque,linhas:abas[0].linhas.map(l=>l[3]),frescor:r.frescor.map(f=>f.tipo),fluxo:r.fluxo.reduce((s,i)=>s+i.rmdf,0),rank:calcularDesempenho({tipo:'rmdf',periodo:'intervalo',inicio:'2026-11-01',fim:d.hoje}).lista.reduce((s,t)=>s+t.devolvidas,0),usadasHistorico:filtrarDevolvidas().length};
 });
 assert.equal(relatorio.estoque,6);assert.equal(relatorio.rmdf,6);assert.equal(relatorio.novas,0);assert.equal(relatorio.devolvidas,2);assert.equal(relatorio.uso,null);assert.equal(relatorio.reclassificadas,2);assert.equal(relatorio.total,11);assert.ok(relatorio.linhas.every(t=>t==='RMDF'));assert.deepEqual(relatorio.frescor,['rmdf']);assert.equal(relatorio.fluxo,2);assert.equal(relatorio.rank,2);assert.equal(relatorio.usadasHistorico,0);
 // Devolver RMDF e desfazer a importação afetam apenas esta categoria e suas saídas.
 await p.evaluate(async()=>{await importarLote([window.__arquivoRmdfTeste('rmdf',[])]);});
 assert.equal(await p.evaluate(()=>derivar().kpi.rmdf),0);assert.equal(await p.evaluate(()=>E.devolucoes.reduce((s,i)=>s+i.qtd,0)),8);
 await p.evaluate(async()=>desfazerImportacao(E.importacoes[0]));
 assert.equal(await p.evaluate(()=>derivar().kpi.rmdf),6);assert.equal(await p.evaluate(()=>E.devolucoes.reduce((s,i)=>s+i.qtd,0)),2);
 await p.evaluate(async()=>salvarTecnico(window.__tidRmdfTeste,{prazoUsadas:1}));
 assert.equal(await p.evaluate(()=>E.devolucoes[0].prazo),3,'a mudança de regra não altera uma devolução encerrada');
 await p.evaluate(()=>{irPara('relatorios');});await p.waitForFunction(()=>relatorioPronto());
 fs.mkdirSync('capturas/rmdf-estoque',{recursive:true});
 const evento=p.waitForEvent('download');await p.evaluate(()=>exportarPdfTecnico(window.__tidRmdfTeste,'PR'));
 const download=await evento;await download.saveAs('capturas/rmdf-estoque/individual.pdf');
 assert.equal(fs.readFileSync('capturas/rmdf-estoque/individual.pdf').subarray(0,5).toString(),'%PDF-');
 for(const tema of ['light','dark'])for(const width of [1366,390,320]){
  await p.setViewportSize({width,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);
  for(const pagina of ['rmdf','painel','consulta','inventario','tecnicos','relatorios']){
   await p.evaluate(pagina=>{UIrmdf.status='todas';irPara(pagina);},pagina);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${pagina}/${tema}/${width}: a tabela rola sem transbordar a página`);
  }
  if(width!==320){await p.evaluate(()=>irPara('rmdf'));await p.screenshot({path:`capturas/rmdf-estoque/${tema}-${width}.png`,fullPage:true});}
 }
 assert.deepEqual(erros,[]);console.log('RMDF como estoque: totais, dias, prazo pessoal, limite de novas, identidade, cobrança, previsão parcial, devolução, reclassificação, desfazer, relatórios, ranking, PDF e seis telas responsivas passaram.');
}finally{await browser.close();}
