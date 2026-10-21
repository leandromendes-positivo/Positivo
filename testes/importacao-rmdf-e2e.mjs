// Arquivos fictícios: não conecta ao Firebase nem modifica saldos de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {chromium}=require('playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await b.newPage({viewport:{width:1366,height:900}}),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 const cab='Técnico;Nota Fiscal;Remessa;Material Solicitado;Material Solicitado Descrição;Material Enviado;Material Enviado Descrição;Chamado;Data FT;Qtd;\n';
 const linhas=['ANA TESTE;NF01;000123;000001;Placa;000001;Placa;CH01;01/10/2026 10:54:00;2;', 'BRUNO TESTE;NF02;000124;000002;Cabo;000002;Cabo;CH02;02/10/2026 11:00:00;3;'];
 const upload=async arquivos=>p.locator('#entrada-topo').setInputFiles(arquivos.map(([name,conteudo])=>({name,mimeType:'text/csv',buffer:Buffer.from(conteudo)})));
 await upload([['PR Novas.csv',cab.replace('Data FT','TIPO')+'ANA TESTE;NF01;000123;000001;Placa;000001;Placa;CH01;BACKUP;4;'],['PR Usadas.csv',cab+linhas[0]],['PR RMDF.csv',cab+linhas.join('\n')]]);
 await p.waitForFunction(()=>UI.im.fila.length===3);assert.equal(await p.evaluate(()=>E.importacoes.length),0,'RMDF exige conferência antes da gravação');
 assert.deepEqual(await p.evaluate(()=>UI.im.fila.map(f=>f.tipo)),['novas','usadas','rmdf']);
 await p.locator('[data-acao="tentar-importar"]').click();await p.waitForFunction(()=>!UI.im.processando&&E.rmdf.length===2);
 const estado=()=>p.evaluate(()=>({rmdf:E.rmdf.reduce((s,p)=>s+p.qtd,0),novas:E.novas.reduce((s,p)=>s+p.qtd,0),usadas:E.usadas.reduce((s,p)=>s+p.qtd,0),devolucoes:E.devolucoes.length,movimentos:E.movimentos.length}));
 assert.deepEqual(await estado(),{rmdf:5,novas:4,usadas:2,devolucoes:0,movimentos:0});
 await p.evaluate(async()=>{E.rmdf=[];await carregarFotos();});assert.equal((await estado()).rmdf,5,'relação serializa e recarrega em partes próprias');
 await p.locator('[data-nav="rmdf"]').click();assert.match(await p.locator('#conteudo').innerText(),/Mesma referência também em usadas/);
 await p.locator('[data-digitar="rmdf-busca"]').fill('BRUNO');await p.waitForFunction(()=>UIrmdf.busca==='BRUNO');await p.waitForTimeout(350);assert.equal(await p.locator('#conteudo tbody tr').count(),1);
 await p.evaluate(async()=>{window.__exportacaoRmdf=null;exportarExcel=async(nome,abas)=>{window.__exportacaoRmdf={nome,abas};};await exportarRmdf();});
 assert.equal(await p.evaluate(()=>window.__exportacaoRmdf.abas[0].linhas.length),1,'exportação respeita filtro');
 await p.evaluate(()=>{UIrmdf.busca='';irPara('rmdf');});
 for(const tema of ['light','dark'])for(const width of [1366,390,320]){await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${tema}/${width}: sem transbordar a página`);}
 await p.setViewportSize({width:1366,height:900});
 const isolamento=await p.evaluate(()=>{
  const original=E.rmdf[0],outro={...original,regiao:'SC',qtd:9};
  const mapa=montarSaldosTecnicos(E.usadas,E.novas,E.cadastro,E.catalogo,[...E.rmdf,outro]);
  return {pr:mapa.get('PR--'+original.tid).pecas.get('r-'+original.k).quantidade,sc:mapa.get('SC--'+original.tid).pecas.get('r-'+original.k).quantidade,tipos:[...mapa.get('PR--'+original.tid).pecas.values()].map(p=>p.tipo).sort()};
 });assert.equal(isolamento.pr,2);assert.equal(isolamento.sc,9);assert.deepEqual(isolamento.tipos,['novas','rmdf','usadas']);
 // Uma nova foto RMDF não altera usadas/novas nem gera devolução ao desaparecer uma linha.
 await upload([['PR RMDF.csv',cab+linhas[1]]]);await p.waitForFunction(()=>UI.im.fila.length===1);await p.locator('[data-acao="tentar-importar"]').click();await p.waitForFunction(()=>!UI.im.processando&&E.rmdf.length===1);
 assert.deepEqual(await estado(),{rmdf:3,novas:4,usadas:2,devolucoes:0,movimentos:0});
 await p.evaluate(async()=>{await desfazerImportacao(E.importacoes[0]);});assert.equal((await estado()).rmdf,5,'desfazer restaura somente a relação');
 // Impede que uma quantidade inválida apague silenciosamente parte da relação.
 await upload([['PR RMDF.csv',cab+linhas[0].replace(';2;',';1,5;')]]);await p.waitForFunction(()=>UI.im.fila.length===1&&UI.im.fila[0].erro);assert.equal((await estado()).rmdf,5);
 assert.equal(await p.evaluate(()=>UI.im.fila[0].lido),null);
 const antesAmbiguo=await p.evaluate(()=>E.importacoes.length);
 await upload([['PR.csv',cab+linhas[0]]]);await p.waitForFunction(()=>UI.im.fila.length===1&&UI.im.fila[0].lido);
 assert.equal(await p.evaluate(()=>E.importacoes.length),antesAmbiguo,'nome sem categoria exige conferência');
 assert.match(await p.locator('#conteudo').innerText(),/colunas são comuns a Usadas e RMDF/);
 await p.locator('[data-mudar="fila-tipo"]').selectOption('rmdf');await p.locator('[data-acao="tentar-importar"]').click();await p.waitForFunction(()=>!UI.im.processando&&E.rmdf.length===1);
 assert.equal((await estado()).rmdf,2);assert.equal((await estado()).usadas,2);assert.equal((await estado()).devolucoes,0);
 assert.deepEqual(erros,[]);
 console.log('RMDF: três arquivos, confirmação, isolamento por tipo/técnico/UF, referência cruzada, filtro, recarga, saída sem baixa, desfazer e quantidade inválida passaram.');
}finally{await b.close();}
