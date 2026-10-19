import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PW_PATH||'playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await b.newPage({viewport:{width:1440,height:1100}}),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>{window.__CP_AGORA='2027-01-15T12:00:00';});
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8000/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.evaluate(async()=>{
  const pessoa=(id,nome,regiao,inicio,fim,extra={})=>({id,matricula:id,nome,regiao,ciclo:'2027',direito:30,vendidos:0,status:'planejado',obs:'',periodos:[{inicio,fim,retorno:''}],...extra});
  for(const f of [pessoa('pr','Pessoa Paraná','PR','2027-01-20','2027-02-08'),pessoa('sc','Pessoa Santa Catarina','SC','2027-01-10','2027-01-29'),pessoa('to','Pessoa Tocantins','TO','2027-02-01','2027-02-20'),pessoa('rs','Pessoa Rio Grande','RS','2027-02-10','2027-03-01'),pessoa('retirada','Pessoa Retirada','PR','2027-01-16','2027-02-04',{arquivado:true}),pessoa('cancelada','Pessoa Cancelada','PR','2027-01-17','2027-02-05',{status:'cancelado'}),pessoa('semuf','Pessoa Sem UF','','2027-01-21','2027-02-09')])await salvarFerias(f);
  // Simulate the original automatic load without exposing its technical identity in the history title.
  const h=await Armazem.consultar('historico_ferias',{onde:[['id','==','pr']]});
  const d=h[0];await Armazem.gravar(`historico_ferias/${d.evento}`,{...d,atualizadoPor:{uid:'carga-inicial-ferias',email:'firebase-adminsdk@example.iam.gserviceaccount.com'}});
  const atual=E.ferias.find(f=>f.id==='pr');await salvarFerias({...atual,periodos:[{inicio:'2027-01-22',fim:'2027-02-10',retorno:''}],obs:'Cobertura ajustada <script>erro</script>'},atual.versao);
  irPara('ferias');
 });
 assert.equal(await p.locator('.ferias-card [data-ferias="excluir"]').count(),0);
 assert.equal(await p.locator('.ferias-estado').count(),4);
 assert.equal(await p.locator('.ferias-mapa-brasil').count(),0);
 assert.match(await p.locator('[data-ferias-estado="PR"]').innerText(),/Pessoa Paraná/);
 assert.doesNotMatch(await p.locator('[data-ferias-estado="PR"]').innerText(),/Pessoa Retirada|Pessoa Cancelada/);
 assert.match(await p.locator('[data-ferias-estado="SC"] [data-estado-ferias-atuais]').innerText(),/Pessoa Santa Catarina/);
 assert.match(await p.locator('[data-ferias-estado="SC"] [data-estado-ferias-atuais]').innerText(),/30\/01\/2027/);
 assert.match(await p.locator('[data-ferias-estado="TO"] [data-estado-ferias-proximas]').innerText(),/Pessoa Tocantins/);
 assert.match(await p.locator('[data-ferias-estado="RS"]').innerText(),/Pessoa Rio Grande/);
 await p.locator('[data-ferias-estado-cadastros="TO"]').click();assert.equal(await p.evaluate(()=>UI.pagina),'colaboradores');
 assert.equal(await p.locator('[data-colaborador]').count(),1);assert.match(await p.locator('[data-colaborador]').innerText(),/Pessoa Tocantins/);
 await p.click('[data-ferias="limpar-cadastro"]');assert.equal(await p.locator('[data-colaborador]').count(),7,'complete list includes cancelled, withdrawn and missing-UF records');
 await p.locator('[data-colaborador="pr"] [data-ferias="historico"]').click();
 assert.equal(await p.locator('.ferias-historico-evento').count(),2);
 assert.match(await p.locator('.ferias-historico-evento').first().innerText(),/Períodos de férias alterados/);
 assert.match(await p.locator('.ferias-historico-mudancas').innerText(),/20\/01\/2027/);
 assert.match(await p.locator('.ferias-historico-mudancas').innerText(),/22\/01\/2027/);
 assert.doesNotMatch(await p.locator('.ferias-historico').innerText(),/firebase-adminsdk/);
 assert.match(await p.locator('.ferias-historico').innerText(),/Cadastro inicial/);
 assert.equal(await p.locator('.ferias-historico script').count(),0);
 for(const tema of ['light','dark']){
  await p.evaluate(t=>document.documentElement.setAttribute('data-theme',t),tema);
  await p.setViewportSize({width:390,height:844});
  assert.ok(await p.locator('.ferias-historico-evento').first().evaluate(el=>el.getBoundingClientRect().width>260),'history uses available modal width');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await p.locator('.historico-ferias-modal [data-fechar]').first().click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'roster scroll is confined to its own table');
 await p.evaluate(()=>irPara('ferias'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'state panels fit mobile');
 assert.deepEqual(erros,[]);
 console.log('PASSOU: lista completa, ações separadas dos cartões, quadros por UF, retorno, filtros de cadastro, histórico com antes/depois, autoria legível, texto seguro e temas/celular.');
}finally{await b.close();}
