// Técnicos e peças fictícios na página offline; nunca conecta à produção.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`),{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const pasta='capturas/relatorios-situacao';fs.mkdirSync(pasta,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),erros=[];
 p.on('pageerror',e=>erros.push(e.message));await p.addInitScript(()=>window.__CP_AGORA='2026-11-17T10:00:00-03:00');
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.evaluate(async()=>{
  E.cadastro={ANA:{nome:'Ana Atual',regiao:'PR'},BRUNO:{nome:'Bruno Atual',regiao:'SC'},ZERO:{nome:'Carla Sem Pecas',regiao:'PR'},SAIDA:{nome:'Denis Desligado',regiao:'PR',excluido:true},SAIDA_ZERO:{nome:'Elisa Desligada',regiao:'PR',excluido:true}};
  E.catalogo={N:'Nova de teste',U:'Usada de teste',R:'RMDF de teste'};
  E.indice={arquivos:Object.fromEntries(['novas:PR','usadas:PR','rmdf:PR','novas:SC'].map(chave=>[chave,{em:'2026-11-17 09:00',arquivo:chave+'.csv'}])),anterior:{}};
  const n=(tid,qtd,regiao='PR')=>({tid,qtd,regiao,mat:'N',tipoEnvio:'BACKUP',desde:'2026-11-10',linhas:1});
  const u=(tid,qtd,mat)=>({tid,qtd,regiao:'PR',mat,k:tid+mat,dataFT:'2026-11-01',desde:'2026-11-10',chamado:'CH-'+tid});
  E.novas=[n('ANA',3),n('BRUNO',4,'SC'),n('SAIDA',7)];E.usadas=[u('ANA',2,'U'),u('SAIDA',5,'U')];E.rmdf=[u('ANA',1,'R'),u('SAIDA',2,'R')];
  const d=(tid,qtd,em='2026-11-15')=>['DEV-'+tid,tid,'U','CH','2026-11-01',qtd,em,5,'PR','lote-anterior',qtd,7];
  await Armazem.gravar('devolucoes/teste-situacao',{data:'2026-11-16',itens:[d('ANA',2),d('SAIDA',4),d('SAIDA_ZERO',3),d('SAIDA',100,'2025-01-01')]});
  await Armazem.gravar('movimentos/teste-situacao',{data:'2026-11-16',itens:[{tid:'ANA',regiao:'PR',mat:'N',qtd:1,em:'2026-11-16',destino:'uso'},{tid:'SAIDA',regiao:'PR',mat:'N',qtd:2,em:'2026-11-16',destino:'uso'}]});
  mudou();irPara('relatorios');
 });await p.waitForFunction(()=>relatorioPronto());
 const seletor=p.locator('[data-mudar="relatorios-situacao"]');
 const resumo=()=>p.evaluate(()=>{const r=calcularRelatorio();return {ids:r.tecnicos.map(t=>t.tid).sort(),estoque:r.k.estoque,devolvidas:r.k.devolvidas,uso:r.k.uso,fluxo:r.fluxo.reduce((s,d)=>s+d.usadas+d.novas+d.rmdf,0),codigos:r.porPeca.map(i=>i.valor).sort((a,b)=>a-b),filtros:r.filtrosTexto};});
 const baixar=async(nome,acao)=>{const evento=p.waitForEvent('download');await acao();const d=await evento;await d.saveAs(`${pasta}/${nome}`);return `${pasta}/${nome}`;};
 const lerExcel=caminho=>JSON.parse(execFileSync('python3',['-c',[
  'import sys,json,zipfile,xml.etree.ElementTree as ET',
  'z=zipfile.ZipFile(sys.argv[1]); ns={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}',
  'strings=["".join(i.itertext()) for i in ET.fromstring(z.read("xl/sharedStrings.xml"))]',
  'def celula(c):',
  ' v=c.find("m:v",ns); return strings[int(v.text)] if c.get("t")=="s" else (v.text if v is not None else "")',
  'def linhas(n): return [[celula(c) for c in r] for r in ET.fromstring(z.read("xl/worksheets/sheet%d.xml"%n)).findall("m:sheetData/m:row",ns)]',
  'print(json.dumps({"inventario":sorted(set(r[0] for r in linhas(1)[1:])),"saidas":sorted(set(r[1] for r in linhas(2)[1:])),"filtros":next(r[1] for r in linhas(3) if r[0]=="Filtros")}))'
 ].join('\n'),caminho],{encoding:'utf8'}));
 assert.equal(await seletor.inputValue(),'ativos');
 let r=await resumo();assert.deepEqual({...r,filtros:''},{ids:['ANA','BRUNO','ZERO'],estoque:10,devolvidas:2,uso:1,fluxo:2,codigos:[1,2,7],filtros:''});assert.match(r.filtros,/Somente ativos/);
 assert.equal(await p.locator('[data-acao="pdf-tecnico-baixar"][data-tid="SAIDA"]').count(),0);
 assert.equal(await p.locator('[name="tid"] option[value="SAIDA"]').count(),0);assert.match(await p.locator('.rel-pendencias-excluidos').innerText(),/14 peças pendentes/);
 const ativos=lerExcel(await baixar('ativos.xlsx',()=>p.locator('[data-formato="simples"]').click()));
 assert.deepEqual(ativos.inventario,['Ana Atual','Bruno Atual']);assert.deepEqual(ativos.saidas,['Ana Atual']);assert.match(ativos.filtros,/Somente ativos/);
 await seletor.selectOption('excluidos');r=await resumo();
 assert.deepEqual({...r,filtros:''},{ids:['SAIDA','SAIDA_ZERO'],estoque:14,devolvidas:7,uso:2,fluxo:7,codigos:[2,5,7],filtros:''});assert.match(r.filtros,/Excluídos da relação/);
 assert.equal(await p.locator('.rel-tecnico-excluido').count(),2);assert.equal(await p.locator('[data-acao="pdf-tecnico-baixar"][data-tid="SAIDA_ZERO"]').count(),1,'sem peças continua disponível na consulta explícita de excluídos');
 assert.equal(await p.locator('[name="tid"] option[value="ANA"]').count(),0);
 const excluidos=lerExcel(await baixar('excluidos.xlsx',()=>p.locator('[data-formato="simples"]').click()));
 assert.deepEqual(excluidos.inventario,['Denis Desligado']);assert.deepEqual(excluidos.saidas,['Denis Desligado','Elisa Desligada']);assert.match(excluidos.filtros,/Excluídos da relação/);
 const pdf=await baixar('individual-excluido.pdf',()=>p.locator('[data-acao="pdf-tecnico-baixar"][data-tid="SAIDA"]').click());assert.equal(fs.readFileSync(pdf).subarray(0,5).toString(),'%PDF-');
 assert.deepEqual(await p.evaluate(()=>{const r=dadosPdfTecnico('SAIDA','PR');return [r.excluido,r.total,r.grupos.map(g=>g.quantidade)];}),[true,14,[7,5,2]]);
 // Aplicar outros filtros e atalhos de data não troca silenciosamente a situação escolhida.
 await p.locator('[name="tid"]').selectOption('SAIDA');await p.locator('[data-form="relatorios"] [type="submit"]').click();
 assert.equal(await p.evaluate(()=>UIrelatorios.filtros.situacao),'excluidos');assert.deepEqual((await resumo()).ids,['SAIDA']);
 await p.locator('[data-acao="relatorios-periodo"][data-periodo="mes"]').click();assert.equal(await seletor.inputValue(),'excluidos');
 await seletor.selectOption('ativos');assert.equal(await p.evaluate(()=>UIrelatorios.filtros.tid),'','trocar situação limpa técnico incompatível');assert.equal((await resumo()).estoque,10);
 await seletor.selectOption('todos');r=await resumo();assert.deepEqual(r.ids,['ANA','BRUNO','SAIDA','SAIDA_ZERO','ZERO']);assert.equal(r.estoque,24);assert.equal(r.devolvidas,9);assert.equal(r.uso,3);
 // Filtros de apresentação nunca dão baixa nas peças ou apagam o acervo.
 assert.deepEqual(await p.evaluate(()=>[E.novas.reduce((s,i)=>s+i.qtd,0),E.usadas.reduce((s,i)=>s+i.qtd,0),E.rmdf.reduce((s,i)=>s+i.qtd,0)]),[14,7,3]);
 for(const tema of ['light','dark'])for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:1000});await p.evaluate(t=>{document.documentElement.dataset.theme=t;scrollTo(0,0);},tema);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`relatórios ${tema}/${width}`);
 }
 await p.setViewportSize({width:1440,height:1000});await p.locator('[data-acao="relatorios-limpar"]').click();assert.equal(await seletor.inputValue(),'ativos');
 await p.evaluate(()=>irPara('tecnicos'));
 const busca=p.locator('[data-digitar="busca-tc"]');await busca.fill('Carla');
 await p.locator('[data-acao="excluir-tecnico"][data-tid="ZERO"]').waitFor();
 assert.equal(await p.evaluate(()=>UI.tc.mostrarSemDados),false,'buscar também encontra técnicos ativos sem peças');
 await busca.fill('');await p.locator('[data-acao="excluir-tecnico"][data-tid="ANA"]').waitFor();
 const botao=p.locator('[data-acao="excluir-tecnico"][data-tid="ANA"]');
 for(const tema of ['light','dark'])for(const width of [1440,390]){
  await p.setViewportSize({width,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);await botao.scrollIntoViewIfNeeded();
  assert.equal((await botao.innerText()).trim(),'Excluir');assert.equal(await botao.locator('svg path').count(),1);
  await botao.hover();const estilo=await botao.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {largura:r.width,altura:r.height,dentro:r.left>=0&&r.right<=innerWidth,sombra:s.boxShadow};});
  assert.ok(estilo.largura<140&&estilo.altura<=44&&estilo.dentro);assert.equal(estilo.sombra,'none');
  await botao.screenshot({path:`${pasta}/botao-${tema}-${width}.png`});
  await p.locator('[data-acao="tecnico"][data-tid="ANA"]').focus();await p.keyboard.press('Tab');
  const foco=await botao.evaluate(el=>({ativo:el===document.activeElement,largura:getComputedStyle(el).outlineWidth,cor:getComputedStyle(el).outlineColor,texto:getComputedStyle(el).color,sombra:getComputedStyle(el).boxShadow}));
  assert.equal(foco.ativo,true);assert.equal(foco.largura,'2px');assert.equal(foco.cor,foco.texto);assert.equal(foco.sombra,'none');
 }
 await botao.click();await p.locator('.modal [data-fechar]').first().click();assert.notEqual(await p.evaluate(()=>E.cadastro.ANA.excluido),true,'cancelar continua preservando o cadastro');
 assert.deepEqual(erros,[]);
 console.log('Relatórios por situação: ativos por padrão, excluídos com/sem estoque, histórico por período, totais/gráficos/seletores/PDFs/Excel coerentes, limpeza de filtros, acervo preservado e botão compacto com foco acessível nos dois temas passaram.');
}finally{await browser.close();}
