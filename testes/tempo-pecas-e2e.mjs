// Relatórios fictícios em memória; nunca conecta ao Firebase de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`),{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await browser.newPage({viewport:{width:1366,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),erros=[];
 p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>{window.__CP_AGORA='2026-11-01T12:00:00-03:00';});
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 const cab='Técnico;Nota Fiscal;Remessa;Material Enviado;Material Enviado Descrição;Chamado;TIPO;Qtd;\n';
 const a='ANA TEMPO;NF1;REM1;100001;Placa;CH1;BACKUP;2;',b='ANA TEMPO;NF2;REM2;200002;Memória;CH2;BACKUP;1;';
 const c='BRUNO TEMPO;NF3;REM3;100001;Placa;CH3;BACKUP;3;';
 const dia=async d=>p.evaluate(d=>{window.__CP_AGORA=d+'T12:00:00-03:00';},d);
 const importar=async(texto,nome='PR Novas.csv')=>{
  const antes=await p.evaluate(()=>E.importacoes.length);
  await p.locator('#entrada-topo').setInputFiles({name:nome,mimeType:'text/csv',buffer:Buffer.from(texto)});
  await p.waitForFunction(antes=>E.importacoes.length>antes&&!UI.im.processando,antes);
 };
 const tempos=()=>p.evaluate(()=>derivar().tecnicos.flatMap(t=>t.novasLinhas.map(n=>({mat:n.mat,nome:t.nome,desde:n.desde,inicio:n.contagemDesde,dias:n.dias,regiao:n.regiao}))));
 await importar(cab+a);await dia('2026-11-10');await importar(cab+a);
 assert.deepEqual((await tempos()).map(n=>[n.desde,n.inicio,n.dias]),[['2026-11-01','2026-11-10',1]],'novas já cadastradas começam o acompanhamento em 10/11');
 await importar(cab+a);assert.equal((await tempos())[0].dias,1);
 await p.evaluate(async()=>{E.novas=[];await carregarFotos();mudou();});assert.equal((await tempos())[0].dias,1,'a contagem é recuperada do estoque salvo');
 await dia('2026-11-11');await importar(cab+[a,b,c].join('\n'));
 assert.deepEqual((await tempos()).map(n=>n.dias).sort(),[1,1,2]);
 await importar(cab.replace('TIPO','Data FT')+'ANA TEMPO;NF4;REM4;400004;Cabo;CH4;07/11/2026 10:00;1;','PR Usadas.csv');
 assert.equal(await p.evaluate(()=>derivar().itens[0].dias),4,'usadas seguem o fechamento do chamado');
 await dia('2026-11-12');await importar(cab+[a.replace('BACKUP','PP'),b,c].join('\n'));
 assert.equal((await tempos()).find(n=>n.mat==='100001'&&n.nome.includes('Ana')).dias,3);
 assert.equal(await p.evaluate(()=>E.movimentos.length),0);
 await dia('2026-11-13');await importar(cab+[b,c].join('\n'));
 assert.equal(await p.evaluate(()=>E.movimentos.find(m=>m.mat==='100001').dias),4);
 await dia('2026-11-14');await importar(cab+[a,b,c].join('\n'));
 assert.equal((await tempos()).find(n=>n.mat==='100001'&&n.nome.includes('Ana')).dias,1);
 await dia('2026-11-18');await importar(cab+[a,b,c].join('\n'));
 assert.equal((await tempos()).find(n=>n.mat==='200002').dias,8);
 const tid=await p.evaluate(()=>E.novas.find(n=>n.mat==='200002').tid);
 const ranking=await p.evaluate(tid=>{
  const D=derivar(),r=calcularDesempenho({tipo:'novas',periodo:'intervalo',inicio:'2026-11-18',fim:'2026-11-18'},D);
  const t=r.lista.find(t=>t.tid===tid),c=novasParaCobranca(D.mapa.get(tid)).find(i=>i.mat==='200002');
  return {atrasadas:t.atrasadas,atraso:t.maiorAtraso,diasCobranca:c.dias,inicio:c.contagemDesde};
 },tid);assert.deepEqual(ranking,{atrasadas:1,atraso:1,diasCobranca:8,inicio:'2026-11-11'});
 await p.evaluate(()=>irPara('novas'));
 const linha=p.locator('.tabela-consulta tbody tr').filter({hasText:'200002'});
 assert.equal(await linha.locator('.tempo-peca').innerText(),'8 dias');assert.match(await linha.locator('.tempo-peca').getAttribute('title'),/11\/11\/2026/);
 await p.evaluate(()=>irPara('usadas'));
 assert.equal(await p.locator('.tempo-peca[data-tipo-peca="usadas"]').first().innerText(),'11 dias');
 const exportacao=await p.evaluate(async()=>{
  let arquivo;exportarExcel=async(nome,abas)=>{arquivo={nome,abas};};await exportarEstoque();
  const D=derivar(),r=calcularRelatorio({inicio:'2026-11-10',fim:'2026-11-18',tipo:'',regiao:'',tid:''},{devolucoes:E.devolucoes,movimentos:E.movimentos},D);
  return {arquivo,gerencial:abasRelatorio(r)[0]};
 });
 const material=exportacao.arquivo.abas[1].linhas.find(l=>l[2]==='200002');assert.equal(material[7],'2026-11-11');assert.equal(material[8],8);
 const rel=exportacao.gerencial.linhas.find(l=>l[4]==='200002');assert.equal(rel[8],8);assert.equal(rel[11],'2026-11-11');
 fs.mkdirSync('capturas/tempo-pecas',{recursive:true});
 await p.evaluate(()=>document.getElementById('toasts').replaceChildren());
 for(const tema of ['light','dark'])for(const width of [1366,390,320]){
  await p.setViewportSize({width,height:1000});await p.evaluate(tema=>{document.documentElement.dataset.theme=tema;irPara('novas');},tema);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${tema}/${width}: sem transbordar a página`);
  if(width!==320)await p.locator('#consulta-resultados').screenshot({path:`capturas/tempo-pecas/${tema}-${width}.png`});
 }
 await p.setViewportSize({width:1366,height:1000});
 await p.evaluate(tid=>{
  const s=montarSaldosTecnicos(E.usadas,E.novas,E.cadastro,E.catalogo).get('PR--'+tid);
  PortalTecnico.saldo=s;PortalTecnico.controle={geracao:'fixture',atualizadoEm:agoraISO()};PortalTecnico.pecas=[...s.pecas].map(([id,p])=>({id,...p}));
  Acesso.modo='firebase';Acesso.perfil={perfil:'tecnico',ativo:true,tecnicoId:'PR--'+tid};montarMoldura();irPara('meu-painel');
 },tid);
 assert.equal(await p.locator('.tempo-peca[data-tipo-peca="usadas"]').first().innerText(),'11 dias');
 assert.equal(await p.locator('tbody tr').filter({hasText:'200002'}).locator('.tempo-peca').innerText(),'8 dias');
 assert.deepEqual(erros,[]);console.log('Tempo das peças: relatórios diários, dia 1, persistência, reenvio, retorno, usadas por FT, prazos/ranking, destaques, exportações e portal passaram.');
}finally{await browser.close();}
