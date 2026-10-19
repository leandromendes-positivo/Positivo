// Dados fictícios; nunca conecta ao projeto Firebase real.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PW_PATH || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM || undefined});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),erros=[];
 page.on('pageerror',e=>erros.push(e.message));
 await page.addInitScript(()=>{window.__CP_AGORA='2027-01-15T12:00:00';});
 await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
 await page.waitForFunction(()=>E.status==='pronto');
 assert.equal(await page.evaluate(()=>Acesso.modo),'memoria');
 await page.click('[data-nav="ferias"]');
 await page.click('[data-ferias="novo"]');
 const form=page.locator('.ferias-form');
 await form.locator('[name="nome"]').fill('Colaborador Fictício A');
 await form.locator('[name="matricula"]').fill('TESTE-A');
 await form.locator('[name="regiao"]').fill('PR Interior');
 await form.locator('[name="ciclo"]').fill('2027');
 // Native value + input also works with the shared calendar's hidden input.
 await page.evaluate(()=>{for(const [n,v] of [['inicio0','2027-01-10'],['fim0','2027-01-29']]){const el=document.querySelector(`.ferias-form [name="${n}"]`);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}});
 await form.locator('[name="vendidos"]').fill('10');
 await page.click('[data-ferias-salvar]');
 await page.waitForFunction(()=>E.ferias.length===1 && document.querySelector('.ferias-lista')?.textContent.includes('20 dias programados'));
 assert.match(await page.locator('.ferias-lista').innerText(),/20 dias programados/);
 assert.match(await page.locator('.ferias-lista').innerText(),/30\/01\/2027/);
 const resultados=await page.evaluate(async()=>{
  const base={nome:'Colaborador Fictício B',matricula:'TESTE-B',regiao:'PR Capital',ciclo:'2027',direito:30,vendidos:0,status:'planejado',obs:'',periodos:[{inicio:'2027-01-29',fim:'2027-02-12',retorno:''}]};
  await salvarFerias(base);
  const b=E.ferias.find(f=>f.matricula==='TESTE-B'),a=E.ferias.find(f=>f.matricula==='TESTE-A');
  const conflito=conflitosFerias(a).length;
  const foraUf=conflitosFerias({...b,regiao:'SC'}).length;
  const semRegiao=conflitosFerias({...b,regiao:''}).length;
  const cancelado=conflitosFerias({...b,status:'cancelado'}).length;
  await salvarFerias({...b,periodos:[{inicio:'2027-02-01',fim:'2027-02-15',retorno:'2027-02-17'}]},b.versao);
  let concorrencia=false;try{await salvarFerias(b,b.versao);}catch(e){concorrencia=/outra sessão/.test(e.message);}
  let invalidas=0;
  for(const f of [{...base,periodos:[{inicio:'2027-02-30',fim:'2027-03-10',retorno:''}]},{...base,vendidos:20},{...base,periodos:[...base.periodos,...base.periodos]}])try{validarFerias(f);}catch{invalidas++;}
  const hist=await Armazem.consultar('historico_ferias',{onde:[['id','==',b.id]]});
  return {conflito,foraUf,semRegiao,cancelado,concorrencia,invalidas,historico:hist.length,retorno:retornoFerias(E.ferias.find(f=>f.id===b.id).periodos[0]),bissexto:diasFerias({inicio:'2028-02-07',fim:'2028-03-07'}),concluido:situacaoFerias(a,'2027-01-30')};
 });
 assert.deepEqual(resultados,{conflito:1,foraUf:0,semRegiao:0,cancelado:0,concorrencia:true,invalidas:3,historico:2,retorno:'2027-02-17',bissexto:30,concluido:'Concluído'});
 // Generate/import an actual workbook with fictitious names and inconsistent spreadsheet totals.
 const importacao=await page.evaluate(async()=>{
  await bibliotecasExcelRelatorio();const w=new ExcelJS.Workbook(),s=w.addWorksheet('Relação');s.getCell('B3').value='Matrícula';s.getCell('C3').value='Nome';
  s.getRow(4).values=[1,'TESTE-C','Colaborador Fictício C','','20 dias + vender 10',new Date('2027-03-01T00:00:00Z'),new Date('2027-03-20T00:00:00Z'),19,null,null,null,19,'Informar região',null,'Conferir com RH'];
  const file=new File([await w.xlsx.writeBuffer()],'ferias-teste.xlsx');
  const resultado=await lerPlanilhaFerias(file);await importarFerias(file);return {n:resultado.lista.length,avisos:resultado.avisos.length};
 });
 assert.equal(importacao.n,1);assert.equal(importacao.avisos,4);
 await page.click('[data-importar]');await page.waitForFunction(()=>E.ferias.length===3);
 await page.evaluate(()=>carregarTudo());await page.waitForFunction(()=>E.status==='pronto');
 assert.equal(await page.evaluate(()=>E.ferias.length),3);
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-ferias="exportar"]')]);assert.match(download.suggestedFilename(),/^ferias-.*\.xlsx$/);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
  await page.setViewportSize({width:320,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sem rolagem horizontal');
 }
 // A standard user can consult but cannot edit, even by calling the save function.
 const permissao=await page.evaluate(async()=>{Acesso.modo='firebase';Acesso.perfil={ativo:true,perfil:'usuario'};try{await salvarFerias(E.ferias[0]);return false;}catch{return true;}});assert.equal(permissao,true);
 await page.evaluate(()=>renderizar(true));assert.equal(await page.locator('[data-ferias="novo"]').count(),0);
 assert.deepEqual(erros,[]);
 console.log('PASSOU: cadastro pela tela, cálculos inclusivos e ano bissexto, retorno ajustado, conflitos por UF, cancelamento, validação, concorrência, histórico, importação Excel, exportação, recarga, temas, celular e restrição de edição.');
} finally {await browser.close();}
