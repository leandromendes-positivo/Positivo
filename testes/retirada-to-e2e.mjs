// Registros legados em memória: nenhuma alteração no projeto real.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`),{chromium}=require('playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await b.newPage({viewport:{width:1366,height:1000}}),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 await p.evaluate(async()=>{
  await Armazem.gravar('cadastro/tecnicos',{t:{PR1:{nome:'Pessoa ativa',regiao:'PR'},TO1:{nome:'Pessoa encerrada',regiao:'TO'}}});
  await Armazem.gravar('dados/indice',{versao:1,arquivos:{'usadas:PR':{gen:'legado',partes:1,em:'2026-11-03'},'usadas:TO':{gen:'legado',partes:1,em:'2026-11-03'},'novas:TO':{gen:'legado',partes:1,em:'2026-11-03'}},anterior:{}});
  await Armazem.gravar('dados/u-PR-legado-0',{itens:[['pr-k','PR1','NF','REM','MAT-PR','CH','2026-10-01',2,'2026-10-01']]});
  await Armazem.gravar('dados/u-TO-legado-0',{itens:[['to-k','TO1','NF','REM','MAT-TO','CH','2026-10-01',100,'2026-10-01']]});
  await Armazem.gravar('dados/n-TO-legado-0',{itens:[['TO1','MAT-TO','BACKUP',100,1,'2026-10-01']]});
  await Armazem.gravar('devolucoes/mista',{data:'2026-11-02',itens:[['to-k','TO1','MAT-TO','CH','2026-10-01',100,'2026-11-02',32,'TO'],['pr-k','PR1','MAT-PR','CH','2026-10-01',1,'2026-11-02',32,'PR']]});
  await Armazem.gravar('ferias/to',{id:'to',nome:'Colaborador encerrado',matricula:'TO1',regiao:'TO',ciclo:'2026',status:'planejado',direito:30,vendidos:0,obs:'',periodos:[{inicio:'2026-11-13',fim:'2026-12-12'}]});
  await carregarTudo();irPara('painel');
 });
 const estado=await p.evaluate(()=>({ufs:derivar().regioes,usadas:derivar().kpi.usadas,novas:derivar().kpi.novas,tecnicos:derivar().tecnicos.map(t=>t.tid),devolucoes:E.devolucoes.reduce((s,p)=>s+p.qtd,0)}));
 assert.equal(estado.usadas,2);assert.equal(estado.novas,0);assert.deepEqual(estado.tecnicos,['PR1']);assert.equal(estado.devolucoes,1);assert.ok(!estado.ufs.includes('TO'));
 assert.equal(await p.locator('[data-uf="TO"]').count(),0,'TO não tem dados ou seleção no mapa');
 assert.equal(await p.locator('.mapa-cena > .mapa-estado > path').count(),27,'o desenho do Brasil permanece completo');
 const baseNeutra=p.locator('.mapa-cena > .mapa-estado[aria-hidden="true"]');
 assert.equal(await baseNeutra.count(),1);assert.equal(await baseNeutra.getAttribute('pointer-events'),'none');
 assert.equal(await baseNeutra.locator('text, title, [tabindex], [data-acao]').count(),0,'o território neutro não expõe nomes, indicadores ou ações');
 for(const pagina of ['usadas','novas','rmdf','tecnicos','ferias','colaboradores','importar']){
  await p.evaluate(pagina=>irPara(pagina),pagina);
  assert.doesNotMatch(await p.locator('#conteudo').innerText(),/Pessoa encerrada|Colaborador encerrado|Tocantins/);
  assert.equal(await p.locator('#conteudo option[value="TO"]').count(),0);
 }
 await p.evaluate(()=>{irPara('ferias');modalFerias();});assert.equal(await p.locator('.ferias-form [name="regiao"] option[value="TO"]').count(),0);await p.locator('.modal [data-fechar]').first().click();
 const proibido=await p.evaluate(async()=>{
  try{await importarLote([{tipo:'usadas',regiao:'TO',itens:[]}]);return false;}catch{return true;}
 });assert.equal(proibido,true);
 await p.locator('#entrada-topo').setInputFiles({name:'TO Usadas.csv',mimeType:'text/csv',buffer:Buffer.from('Técnico;Material;Qtd;Data FT\nPessoa;123;1;01/11/2026')});await p.waitForFunction(()=>UI.im.fila.length===1&&UI.im.fila[0].erro);assert.equal(await p.evaluate(()=>UI.im.fila[0].lido),null);
 assert.equal(await p.evaluate(async()=>!!(await Armazem.ler('dados/u-TO-legado-0',{preservarHistorico:true}))),true,'o filtro visual não apaga registros antigos');
 assert.deepEqual(erros,[]);console.log('Retirada TO: dados legados fora das telas, indicadores e filtros; importação bloqueada e demais UFs preservadas.');
}finally{await b.close();}
