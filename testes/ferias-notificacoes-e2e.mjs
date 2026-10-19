// Visibilidade e lembretes de férias com dados fictícios, sem backend de produção.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PW_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),erros=[];
 page.on('pageerror',e=>erros.push(e.message));
 await page.addInitScript(()=>{window.__CP_AGORA='2027-01-01T12:00:00';});
 await page.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8000/pagina-completa.html');
 await page.waitForFunction(()=>E.status==='pronto');
 assert.equal(await page.evaluate(()=>Acesso.modo),'memoria');
 await page.evaluate(()=>{
  const pessoa=(id,nome,inicio,fim,extra={})=>({id,matricula:id,nome,regiao:'SC',ciclo:'2027',direito:30,vendidos:0,area:'tecnico',localidade:'interior',status:'planejado',periodos:[{inicio,fim,retorno:''}],...extra});
  E.ferias=[pessoa('a','Pessoa Atual','2026-12-20','2027-01-08'),pessoa('b','Pessoa Próxima','2027-01-31','2027-02-19'),pessoa('c','Pessoa Distante','2027-02-01','2027-02-20'),pessoa('d','Pessoa Hoje','2027-01-01','2027-01-20'),pessoa('e','Pessoa Retirada','2027-01-05','2027-01-24',{arquivado:true}),pessoa('f','Pessoa Cancelada','2027-01-06','2027-01-25',{status:'cancelado'})];
  mudou();irPara('ferias');
 });
 assert.match(await page.locator('.ferias-destaque.atuais').innerText(),/Pessoa Atual/);
 assert.match(await page.locator('.ferias-destaque.atuais').innerText(),/Pessoa Hoje/);
 assert.match(await page.locator('.ferias-destaque.atuais').innerText(),/09\/01\/2027/);
 assert.match(await page.locator('.ferias-destaque.proximas').innerText(),/Pessoa Próxima/);
 assert.match(await page.locator('.ferias-destaque.proximas').innerText(),/Pessoa Distante/);
 assert.doesNotMatch(await page.locator('.ferias-destaques').innerText(),/Pessoa Retirada|Pessoa Cancelada/);
 const sino=page.locator('#botao-notificacoes');await sino.click();
 assert.match(await page.locator('[data-notif-id="ferias_proximas"]').innerText(),/Pessoa Próxima/);
 assert.doesNotMatch(await page.locator('[data-notif-id="ferias_proximas"]').innerText(),/Pessoa Distante|Pessoa Retirada|Pessoa Cancelada/);
 assert.match(await page.locator('[data-notif-id="ferias_hoje"]').innerText(),/Pessoa Hoje/);
 await page.locator('[data-notif-destino="ferias_proximas"]').click();
 assert.equal(await page.evaluate(()=>UI.pagina),'ferias');
 // A change in unrelated filters must not hide today's or upcoming names at the top.
 await page.evaluate(()=>{Object.assign(UIferias,{uf:'PR',ano:'2028',busca:'inexistente'});renderizar(true);});
 assert.match(await page.locator('.ferias-destaque.proximas').innerText(),/Pessoa Próxima/);
 await sino.click();await page.locator('[data-notif-destino="ferias_proximas"]').click();
 assert.deepEqual(await page.evaluate(()=>[UIferias.uf,UIferias.ano,UIferias.busca,UIferias.arquivados]),['','','',false]);
 // Isolate a single next departure to test threshold updates without daily unread churn.
 await page.evaluate(()=>{E.ferias=E.ferias.filter(f=>f.id==='b');mudou();});
 const versao=()=>page.evaluate(()=>alertasOperacionais().find(a=>a.id==='ferias_proximas')?.versao);
 const inicial=await versao();await sino.click();
 if(!await page.locator('[data-notif-id="ferias_proximas"]').evaluate(el=>el.classList.contains('lida')))await page.locator('[data-notif-leitura="ferias_proximas"]').click();
 await page.evaluate(()=>{window.__CP_AGORA='2027-01-02T12:00:00';mudou();});
 assert.equal(await versao(),inicial);
 assert.ok(await page.locator('[data-notif-id="ferias_proximas"]').evaluate(el=>el.classList.contains('lida')));
 await page.evaluate(()=>{window.__CP_AGORA='2027-01-24T12:00:00';mudou();});
 const sete=await versao();assert.notEqual(sete,inicial);
 assert.ok(await page.locator('[data-notif-id="ferias_proximas"]').evaluate(el=>el.classList.contains('nao-lida')));
 await page.evaluate(()=>{window.__CP_AGORA='2027-01-25T12:00:00';mudou();});assert.equal(await versao(),sete);
 await page.evaluate(()=>{window.__CP_AGORA='2027-01-30T12:00:00';mudou();});assert.notEqual(await versao(),sete);
 assert.match(await page.locator('[data-notif-id="ferias_proximas"]').innerText(),/amanhã/);
 await page.evaluate(()=>{window.__CP_AGORA='2027-01-31T12:00:00';mudou();});
 assert.equal(await page.locator('[data-notif-id="ferias_proximas"]').count(),0);
 assert.equal(await page.locator('[data-notif-id="ferias_hoje"]').count(),1);
 await page.evaluate(()=>{window.__CP_AGORA='2027-02-01T12:00:00';mudou();});
 assert.equal(await page.locator('[data-notif-id="ferias_hoje"]').count(),0);
 await page.keyboard.press('Escape');
 // All authorized readers of the vacation page receive reminders; signed-out users receive none.
 const permissoes=await page.evaluate(()=>{
  window.__CP_AGORA='2027-01-30T12:00:00';Acesso.modo='firebase';Acesso.usuario={uid:'usuario-fixture',email:'usuario@example.test'};Acesso.perfil={ativo:true,perfil:'usuario'};mudou();
  const autorizado=alertasOperacionais().some(a=>a.id==='ferias_proximas');Acesso.perfil.ativo=false;
  const semAcesso=alertasOperacionais().length===0;Acesso.modo='memoria';Acesso.perfil=null;mudou();return {autorizado,semAcesso};
 });assert.deepEqual(permissoes,{autorizado:true,semAcesso:true});
 for(const tema of ['light','dark']){await page.evaluate(t=>{document.documentElement.setAttribute('data-theme',t);renderizar(true);},tema);await page.setViewportSize({width:320,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(erros,[]);
 console.log('PASSOU: nomes e retornos no topo, próxima saída em 30 dias, exclusão de retirados/cancelados, avisos 30/7/1/hoje, leitura estável, navegação, filtros, perfis e celular.');
}finally{await browser.close();}
