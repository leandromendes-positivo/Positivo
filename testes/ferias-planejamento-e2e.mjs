// Fluxo funcional em memória: nenhuma gravação no Firebase real.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await browser.newPage({viewport:{width:1280,height:1000}}),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>window.__CP_AGORA='2028-03-01T09:00:00');
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');await p.waitForFunction(()=>typeof modalFerias==='function'&&E.status==='pronto');
 await p.evaluate(()=>modalFerias());
 const campo=n=>p.locator(`.ferias-form [name="${n}"]`);
 const data=(n,v)=>p.evaluate(({n,v})=>{const e=document.querySelector(`.ferias-form [name="${n}"]`);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},{n,v});
 await data('inicio0','2027-09-01');assert.equal(await campo('fim0').inputValue(),'2027-09-30');assert.match(await p.locator('[data-ferias-retorno="0"]').innerText(),/01\/10\/2027/);
 assert.equal(await campo('fim0').getAttribute('readonly'),'');
 await campo('vendidos').fill('10');assert.equal(await campo('dias0').inputValue(),'20');assert.equal(await campo('fim0').inputValue(),'2027-09-20');
 await campo('vendidos').fill('0');await campo('dias0').fill('15');assert.equal(await campo('fim0').inputValue(),'2027-09-15');
 await data('inicio1','2027-10-01');assert.equal(await campo('dias1').inputValue(),'15');assert.equal(await campo('fim1').inputValue(),'2027-10-15');
 await campo('vendidos').fill('10');assert.equal(await campo('dias0').inputValue(),'15');assert.equal(await campo('dias1').inputValue(),'5');assert.equal(await campo('fim1').inputValue(),'2027-10-05');
 await data('inicio1','');assert.equal(await campo('fim1').inputValue(),'');
 await data('inicio0','2028-02-20');await campo('dias0').fill('10');assert.equal(await campo('fim0').inputValue(),'2028-02-29');
 await campo('nome').fill('Pessoa cálculo');await campo('matricula').fill('CALCULO-TESTE');await campo('regiao').selectOption('PR');await campo('area').selectOption('administrativo');await campo('ciclo').fill('2028');
 await p.locator('[data-ferias-salvar]').click();await p.locator('.ferias-form').waitFor({state:'detached'});
 const id=await p.evaluate(()=>E.ferias.find(f=>f.matricula==='CALCULO-TESTE').id);
 assert.equal(await p.evaluate(id=>E.ferias.find(f=>f.id===id).periodos[0].fim,id),'2028-02-29');
 const auditorias=await p.evaluate(async()=>{
  const modelo={nome:'Pessoa cálculo',matricula:'CALCULO-TESTE',regiao:'PR',area:'administrativo',localidade:'',direito:30,vendidos:10,status:'confirmado',obs:''};
  await salvarFerias({...modelo,ciclo:'2027',periodos:[{inicio:'2027-09-01',fim:'2027-09-20',retorno:''}]});
  const anterior=E.ferias.find(f=>f.ciclo==='2027');await salvarFerias({...anterior,nome:'Pessoa atualizada'},anterior.versao);
  await salvarFerias({...modelo,ciclo:'2026',status:'cancelado',periodos:[{inicio:'2026-08-01',fim:'2026-08-20',retorno:''}]});
  await salvarFerias({...modelo,ciclo:'2029',periodos:[{inicio:'2029-08-01',fim:'2029-08-20',retorno:''}]});
  await salvarFerias({...modelo,ciclo:'outro',matricula:'OUTRO',nome:'Outra pessoa',periodos:[{inicio:'2027-01-01',fim:'2027-01-20',retorno:''}]});
  await salvarFerias({...modelo,ciclo:'removido-antes',periodos:[{inicio:'2027-11-01',fim:'2027-11-20',retorno:''}]});
  const removido=E.ferias.find(f=>f.ciclo==='removido-antes');await Armazem.gravar('exclusoes_ferias/'+removido.evento,{cadastroId:removido.id,em:'2026-12-01T09:00:00'});await Armazem.apagar('ferias/'+removido.id);E.ferias=await Armazem.consultar('ferias');
  const dados=[{...modelo,periodos:[{inicio:'2027-09-01',fim:'2027-09-20',retorno:''}]},{...modelo,periodos:[{inicio:'2027-09-01',fim:'2027-09-20',retorno:''}]}];
  if(periodosConcluidosFerias(dados,'2028-03-01').length!==1)throw new Error('Período repetido no histórico.');
  return (await Armazem.consultar('historico_ferias')).length;
 });
 await p.evaluate(id=>abrirHistoricoFerias(id),id);
 assert.equal(await p.locator('.ferias-historico-evento').count(),2);
 const texto=await p.locator('.historico-ferias-modal').innerText();assert.match(texto,/20\/02\/2028/);assert.match(texto,/01\/09\/2027/);assert.doesNotMatch(texto,/Antes|Depois|Cadastro inicial|Registro [0-9]|Outra pessoa|2029|2026|01\/11\/2027/);
 assert.equal(await p.evaluate(async()=>(await Armazem.consultar('historico_ferias')).length),auditorias);
 assert.deepEqual(erros,[]);
 console.log('Férias: fim/retorno automáticos, dias vendidos, divisão de períodos, ano bissexto, gravação e histórico de férias concluídas sem versões/duplicações/cancelamentos/outras pessoas passaram.');
}finally{await browser.close();}
