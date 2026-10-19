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
 // Add a person before dates are known, and archive/reactivate through the screen.
 await page.evaluate(async()=>{await salvarFerias({nome:'Colaborador Fictício C',matricula:'TESTE-C',regiao:'SC',ciclo:'2027',direito:30,vendidos:0,status:'planejado',obs:'',periodos:[]});});
 await page.waitForFunction(()=>document.querySelectorAll('.ferias-card').length===3);
 assert.match(await page.locator('.ferias-lista').innerText(),/Sem programação/);
 assert.equal(await page.locator('[data-ferias-arquivo]').count(),0);
 assert.equal(await page.locator('[data-ferias="exportar"]').count(),0);
 const idC=await page.evaluate(()=>E.ferias.find(f=>f.matricula==='TESTE-C').id);
 await page.locator(`[data-ferias="retirar"][data-id="${idC}"]`).click();
 await page.click('[data-ok]');
 await page.waitForFunction(()=>E.ferias.find(f=>f.matricula==='TESTE-C').arquivado===true);
 await page.waitForFunction(()=>document.querySelectorAll('.ferias-card').length===2);
 await page.click('[data-ferias="arquivados"]');
 await page.waitForFunction(()=>document.querySelectorAll('.ferias-card').length===1);
 assert.match(await page.locator('.ferias-lista').innerText(),/Colaborador Fictício C/);
 await page.locator(`[data-ferias="retirar"][data-id="${idC}"]`).click();await page.click('[data-ok]');
 await page.waitForFunction(()=>E.ferias.find(f=>f.matricula==='TESTE-C').arquivado===false);
 await page.click('[data-ferias="arquivados"]');
 await page.waitForFunction(()=>document.querySelectorAll('.ferias-card').length===3);
 await page.click('[data-ferias="mes"][data-mes="02"]');
 await page.waitForFunction(()=>document.querySelectorAll('.ferias-card').length===1);
 assert.match(await page.locator('.ferias-lista').innerText(),/Colaborador Fictício B/);
 await page.click('[data-ferias="limpar"]');
 await page.evaluate(()=>carregarTudo());await page.waitForFunction(()=>E.status==='pronto');
 assert.equal(await page.evaluate(()=>E.ferias.length),3);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
  await page.setViewportSize({width:320,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'sem rolagem horizontal');
 }
 // Initial roster is encrypted; repeating its load must preserve later edits and withdrawals.
 const carga=await page.evaluate(async()=>{
  const lista=Array.from({length:26},(_,i)=>({nome:`Pessoa de teste ${i}`,matricula:`CARGA-${i}`,regiao:'SC',ciclo:'2027',direito:30,vendidos:0,status:'planejado',obs:'',periodos:[]}));
  const key=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const b64=x=>btoa(String.fromCharCode(...x)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const k=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']);
  const dados=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify(lista))));
  const pacote={iv:b64(iv),dados:b64(dados)};
  let rejeitou=false;try{await decodificarEquipeInicialFerias('A'.repeat(43),pacote);}catch{rejeitou=true;}
  const decodificada=await decodificarEquipeInicialFerias(b64(key),pacote);
  const primeira=await cadastrarEquipeInicialFerias(decodificada);
  const f=E.ferias.find(f=>f.matricula==='CARGA-0');await salvarFerias({...f,obs:'Conservar edição',arquivado:true},f.versao);
  const segunda=await cadastrarEquipeInicialFerias(decodificada);
  const preservado=E.ferias.find(x=>x.id===f.id);
  return {primeira,segunda,rejeitou,preservado:preservado.arquivado&&preservado.obs==='Conservar edição'};
 });
 assert.deepEqual(carga,{primeira:{adicionados:26,preservados:0},segunda:{adicionados:0,preservados:26},rejeitou:true,preservado:true});
 // A standard user can consult but cannot edit, even by calling the save function.
 const permissao=await page.evaluate(async()=>{Acesso.modo='firebase';Acesso.perfil={ativo:true,perfil:'usuario'};try{await salvarFerias(E.ferias[0]);return false;}catch{return true;}});assert.equal(permissao,true);
 await page.evaluate(()=>renderizar(true));assert.equal(await page.locator('[data-ferias="novo"]').count(),0);
 assert.deepEqual(erros,[]);
 console.log('PASSOU: cadastro pela tela, cálculos inclusivos e ano bissexto, retorno ajustado, conflitos por UF, cancelamento, validação, concorrência, histórico, cadastro sem datas, retirada e reativação, mapa mensal, recarga, temas, celular, carga cifrada repetível e restrição de edição.');
} finally {await browser.close();}
