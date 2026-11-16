// Estoques fictícios, exclusivamente na versão em memória; nenhum dado de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`),{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const pasta='capturas/pdf-tecnico';fs.mkdirSync(pasta,{recursive:true});
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),erros=[];
 p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>{window.__CP_AGORA='2026-11-16T12:00:00-03:00';});
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.evaluate(()=>{
  E.cadastro={ANA:{nome:'Ana Carolina Exemplo',apelido:'AnaC',regiao:'PR'},RMDF:{nome:'Bruno Exemplo',regiao:'RS'},VAZIO:{nome:'Carla Exemplo',regiao:'PR'},SEM:{nome:'Davi Exemplo',regiao:'SC'}};
  for(let n=0;n<10;n++)E.cadastro['EXTRA'+n]={nome:'Técnico exemplo '+n,regiao:'PR'};
  E.config={...PADROES,tiposIgnorados:['EXTRA']};
  E.catalogo={N100:'Placa nova',N200:'Memória nova',U100:'Placa usada',U200:'Cabo usado',U300:'Data FT futura',R300:'Sem referência',OUTRA_UF:'Peça restrita ao estoque SC'};
  const u=(k,mat,qtd,dataFT,desde)=>({k,tid:'ANA',regiao:'PR',mat,qtd,dataFT,desde,nf:'NF-EXEMPLO',remessa:'REM-EXEMPLO',chamado:'CH-EXEMPLO'});
  E.usadas=[u('u1','U100',4,'2026-11-01','2026-11-10'),u('u2','U200',1,null,'2026-11-12'),u('u3','U300',2,'2026-11-20','2026-11-14')];
  E.novas=[{tid:'ANA',regiao:'PR',mat:'N100',tipoEnvio:'BACKUP',qtd:2,linhas:1,desde:'2026-10-01'},
   {tid:'ANA',regiao:'PR',mat:'N200',tipoEnvio:'EXTRA',qtd:3,linhas:1,desde:'2026-11-15'},
   {tid:'ANA',regiao:'SC',mat:'OUTRA_UF',tipoEnvio:'BACKUP',qtd:99,linhas:1,desde:'2026-11-11'}];
  E.rmdf=[u('r1','U100',4,'2026-11-01','2026-11-10'),u('r2','R300',6,null,''),{...u('r3','R300',5,'2026-11-10','2026-11-12'),tid:'RMDF',regiao:'RS'}];
  E.indice={arquivos:Object.fromEntries(['novas:PR','usadas:PR','rmdf:PR','rmdf:RS'].map(k=>[k,{em:'2026-11-16 09:30',arquivo:k+'.csv'}])),anterior:{}};
  mudou();irPara('relatorios');
 });
 await p.waitForFunction(()=>relatorioPronto());
 const dados=await p.evaluate(()=>dadosPdfTecnico('ANA','PR'));
 assert.equal(dados.nome,'Ana Carolina Exemplo','o documento mantém o nome completo mesmo quando há apelido no painel');
 assert.equal(dados.total,22);assert.deepEqual(dados.grupos.map(g=>g.quantidade),[5,7,10],'quantidades físicas incluem tipos ignorados no limite; RMDF integra o estoque como peça com defeito');
 assert.deepEqual(dados.grupos[0].linhas.map(i=>i.dias),[7,2]);assert.deepEqual(dados.grupos[1].linhas.map(i=>i.dias),[15,4,null]);
 assert.equal(dados.grupos[2].linhas.find(i=>i.mat==='R300').dias,null);assert.equal(dados.semData,2);
 assert.equal(dados.grupos[2].linhas[0].prazo,7);assert.equal(dados.grupos[2].linhas[0].atrasada,true);
 assert.equal(await p.evaluate(()=>opcoesPdfTecnico().filter(t=>t.tid==='ANA').length),2,'cada UF possui seu próprio PDF');
 assert.equal(await p.evaluate(()=>dadosPdfTecnico('RMDF','RS').grupos[2].quantidade),5,'técnico apenas na relação RMDF também é exportável');
 assert.equal(await p.evaluate(()=>dadosPdfTecnico('SEM','SC').total),null,'sem importação não significa saldo zero');
 assert.equal(await p.evaluate(()=>dadosPdfTecnico('VAZIO','PR').total),0,'saldo zero conhecido é preservado');
 assert.equal(await p.evaluate(()=>{try{dadosPdfTecnico('ANA','TO');return false;}catch{return true;}}),true);
 assert.equal(await p.locator('.rel-individual [value="TO"]').count(),0);
 await p.locator('[data-acao="pdf-tecnico-pagina"][data-delta="1"]').click();assert.equal(await p.evaluate(()=>UIpdfTecnico.pagina),2);
 await p.locator('[data-digitar="pdf-tecnico-busca"]').fill('Ana Carolina');await p.waitForFunction(()=>UIpdfTecnico.busca==='Ana Carolina');await p.waitForTimeout(300);
 assert.equal(await p.locator('.rel-tecnico-card').count(),2);
 await p.locator('[data-mudar="pdf-tecnico-uf"]').selectOption('PR');assert.equal(await p.locator('.rel-tecnico-card').count(),1);
 await p.evaluate(()=>{UIrelatorios.filtros.tipo='usadas';renderizar(true);});
 assert.deepEqual(await p.locator('.rel-tecnico-card dd').allTextContents(),['5','7','10'],'o PDF individual contém os três tipos, independentemente dos filtros gerenciais');
 const botao=()=>p.locator('[data-acao="pdf-tecnico-baixar"][data-tid="ANA"][data-uf="PR"]');
 await p.route('**/vendor/jspdf-autotable-5.0.9.min.js',route=>route.abort());
 await botao().click();await p.waitForFunction(()=>!UIpdfTecnico.gerando&&!!document.querySelector('.toast.erro'));
 assert.equal(await botao().isEnabled(),true,'falha de carregamento permite tentar novamente');await p.unroute('**/vendor/jspdf-autotable-5.0.9.min.js');
 const baixar=async(nome,acao=()=>botao().click())=>{
  const evento=p.waitForEvent('download');await acao();const d=await evento;await d.saveAs(`${pasta}/${nome}`);await p.waitForFunction(()=>!UIpdfTecnico.gerando);
  assert.equal(fs.readFileSync(`${pasta}/${nome}`).subarray(0,5).toString(),'%PDF-');return d.suggestedFilename();
 };
 assert.match(await baixar('individual-pr.pdf'),/^positivo-tecnico-ana-carolina-exemplo-PR-2026-11-16\.pdf$/);
 // Observa as células efetivamente desenhadas pelo plugin, inclusive páginas de continuação.
 await p.evaluate(()=>{
  window.__celulasPdf=[];window.__tamanhoPdf=null;
  const original=jspdf.jsPDF.API.autoTable;
  jspdf.jsPDF.API.autoTable=function(opcoes){const anterior=opcoes.didDrawCell;return original.call(this,{...opcoes,didDrawCell:d=>{
   if(d.section==='body')window.__celulasPdf.push({pagina:d.doc.getCurrentPageInfo().pageNumber,coluna:d.column.index,texto:[...d.cell.text],x:d.cell.x,y:d.cell.y,w:d.cell.width,h:d.cell.height});
   window.__tamanhoPdf=[d.doc.internal.pageSize.getWidth(),d.doc.internal.pageSize.getHeight()];anterior?.(d);
  }});};
  window.__pdfOriginal=gerarPdfTecnico;
  gerarPdfTecnico=async r=>{window.__capturaPdf=r;await new Promise(resolve=>window.__liberarPdf=resolve);return window.__pdfOriginal(r);};
 });
 const evento=p.waitForEvent('download');await botao().click();await p.waitForFunction(()=>!!window.__liberarPdf);
 await p.evaluate(()=>{E.novas.find(i=>i.mat==='N100').qtd=80;mudou();window.__liberarPdf();});
 const congelado=await evento;await congelado.saveAs(`${pasta}/congelado.pdf`);await p.waitForFunction(()=>!UIpdfTecnico.gerando);
 assert.equal(await p.evaluate(()=>window.__capturaPdf.total),22,'atualização durante a geração não mistura saldos');
 await p.evaluate(()=>{E.novas.find(i=>i.mat==='N100').qtd=2;gerarPdfTecnico=window.__pdfOriginal;mudou();});
 let downloads=0;p.on('download',()=>downloads++);
 const bloqueio=await p.evaluate(async()=>{
  const original=gerarPdfTecnico;gerarPdfTecnico=async()=>{Acesso.usuario={uid:'outra-sessao'};return new Blob(['proibido']);};
  try{await exportarPdfTecnico('ANA','PR');return '';}catch(e){return e.message;}finally{Acesso.usuario=null;gerarPdfTecnico=original;}
 });assert.match(bloqueio,/sessão mudou/);assert.equal(downloads,0,'a sessão deve continuar válida antes de baixar');
 await p.evaluate(()=>{
  for(let n=0;n<70;n++)E.usadas.push({k:'vol'+n,tid:'ANA',regiao:'PR',mat:'VOL-'+String(n).padStart(4,'0'),qtd:1,dataFT:'2026-10-01',desde:'2026-11-10',nf:'NF-'+n,remessa:'REM-'+n,chamado:'CH-'+n});
  E.catalogo['VOL-0000']=('Descrição completa com acentuação e muitas informações. ').repeat(100)+' FIM_DA_DESCRICAO';
  mudou();window.__celulasPdf=[];
 });
 await baixar('volume.pdf',()=>p.evaluate(()=>exportarPdfTecnico('ANA','PR')));
 const desenho=await p.evaluate(()=>({celulas:window.__celulasPdf,tamanho:window.__tamanhoPdf}));
 assert.ok(Math.abs(desenho.tamanho[0]-210)<.1&&Math.abs(desenho.tamanho[1]-297)<.1,'A4 em orientação retrato');
 const texto=desenho.celulas.filter(c=>c.coluna===0).flatMap(c=>c.texto).join(' ');
 for(let n=0;n<70;n++)assert.ok(texto.includes('VOL-'+String(n).padStart(4,'0')),'nenhuma peça deve ser cortada');
 assert.ok(texto.includes('FIM_DA_DESCRICAO'),'descrições longas continuam nas páginas seguintes');
 assert.ok(Math.max(...desenho.celulas.map(c=>c.pagina))>=4);
 for(const c of desenho.celulas){assert.ok(c.x>=13.9&&c.x+c.w<=196.1);assert.ok(c.y+c.h<=278.2,'tabelas respeitam o rodapé');if(c.pagina>1)assert.ok(c.y>=44.9,'continuações respeitam o cabeçalho');}
 assert.doesNotMatch(texto,/OUTRA_UF/,'o PDF de PR não expõe o estoque de SC');
 await p.evaluate(()=>document.getElementById('toasts').replaceChildren());
 for(const tema of ['light','dark'])for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:1000});await p.evaluate(tema=>{document.documentElement.dataset.theme=tema;irPara('relatorios');},tema);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${tema}/${width}: sem transbordamento`);
  if(width!==320)await p.locator('.rel-individual').screenshot({path:`${pasta}/${tema}-${width}.png`});
 }
 assert.deepEqual(erros,[]);console.log('PDF individual: três tipos, dias/bases, UF, RMDF no estoque, ausência de dados, filtros, falha/retry, snapshot, sessão, A4, paginação e responsividade passaram.');
}finally{await browser.close();}
