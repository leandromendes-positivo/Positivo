// RMDF em memória ou nos emuladores locais. Nenhum contato externo é aberto/enviado.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PW_PATH||'playwright');
const firebase=process.env.RMDF_FIREBASE==='1';
let regras;
if(firebase){
 const req=createRequire(`${process.env.PW_PATH}/package.json`);
 regras=await req('@firebase/rules-unit-testing').initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
 await prepararEmulador();
}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM});
fs.mkdirSync('capturas/rmdf',{recursive:true});
try {
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 if(firebase)await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.join(process.env.FIREBASE_SDK_DIR,r.request().url().split('/').pop()),contentType:'application/javascript'}));
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(f=>{
  window.__CP_AGORA='2026-10-05T09:00:00';
  if(f){window.CP_FIREBASE={apiKey:'chave-de-teste',authDomain:'demo-controle-pecas.firebaseapp.com',projectId:'demo-controle-pecas'};window.__CP_FIREBASE_EMULADOR__=true;window.__CP_LOGIN_TESTE__={sub:'uid-teste@exemplo.com',email:'teste@exemplo.com',email_verified:true};}
 },firebase);
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8004/pagina-completa.html');
 await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),firebase?'firebase':'memoria');
 if(firebase)assert.equal(await p.evaluate(()=>Acesso.fs.app.options.projectId),'demo-controle-pecas');
 await p.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));
 await p.waitForFunction(()=>UI.im.resultado);
 const tid=await p.evaluate(()=>derivar().tecnicos.find(t=>t.nome.startsWith('Ana')).tid);
 await p.evaluate(async tid=>{await salvarTecnico(tid,{email:'ana+campo@example.test',telefone:'41999999999',prazoNovas:9});irPara('estoque');},tid);
 await p.locator(`[data-acao="cobrar"][data-aba="novas"][data-tid="${tid}"]`).click();
 const whatsapp=await p.locator('#cob-texto').inputValue();
 assert.match(whatsapp,/peças novas/);assert.match(whatsapp,/será aplicado RMDF ou se ele já foi aplicado/);assert.match(whatsapp,/9 dias/);assert.doesNotMatch(whatsapp,/usada\(s\)/);
 const wURL=await p.locator('#cob-link').getAttribute('href');assert.equal(new URL(wURL).searchParams.get('text'),whatsapp);
 await p.locator('[data-cob-canal="email"]').click();
 const email=await p.locator('#cob-email-corpo').inputValue();
 assert.match(email,/código e a quantidade/);assert.match(email,/Prazo de devolução: 9 dias/);
 assert.equal(await p.locator('#cob-email-assunto').inputValue(),'Devolução de peças');
 assert.equal(await p.locator('[data-email-previa]').getByText('Peças novas com defeito · RMDF',{exact:true}).count(),1);
 await p.locator('#cob-email-editor').selectOption('outlook');
 const eURL=await p.locator('#cob-email-link').getAttribute('href');assert.equal(eURL.includes('+'),false);assert.equal(new URL(eURL).searchParams.get('body'),email);
 assert.equal(await p.locator('#cob-prev').count(),0);
 await p.locator('#cob-form [name="obs"]').fill('Técnico informou: RMDF será aplicado em 1 peça.');
 await p.locator('[data-registrar]').click();await p.waitForFunction(()=>!document.querySelector('#cob-form'));
 const contato=await p.evaluate(async tid=>({c:(await Armazem.consultar('contatos')).at(-1),ultima:derivar().mapa.get(tid).ultimaCobranca,agendas:(await Armazem.consultar('agendamentos')).length}),tid);
 assert.equal(contato.c.tipo,'novas');assert.equal(contato.c.canal,'email');assert.equal(contato.c.previsao,'');assert.ok(contato.c.itens.every(k=>k.startsWith('nova-')));assert.equal(contato.ultima,null);assert.equal(contato.agendas,0);
 await p.evaluate(tid=>modalCobrar(tid),tid);assert.doesNotMatch(await p.locator('#cob-texto').inputValue(),/RMDF/);assert.doesNotMatch(await p.locator('#cob-email-corpo').inputValue(),/RMDF/);await p.keyboard.press('Escape');
 // Importação identifica saída parcial real; a condição continua desconhecida.
 const mov=await p.evaluate(async tid=>{
  window.__CP_AGORA='2026-10-13T09:00:00';mudou();
  const nova=E.novas.find(i=>i.tid===tid&&i.qtd===9);
  const a={tipo:'novas',regiao:'PR',nome:'PR Novas.csv',hash:'rmdf-parcial',avisos:[],itens:E.novas.filter(i=>i.regiao==='PR').map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome,qtd:i===nova?6:i.qtd}))};a.linhasLidas=a.itens.length;
  await importarLote([a]);return E.movimentos.find(i=>i.tid===tid&&i.mat===nova.mat);
 },tid);
 assert.equal(mov.qtd,3);assert.equal(mov.destino,'pendente');assert.equal(mov.condicaoDevolucao,undefined);
 await p.locator('[data-acao="devolucoes-novas"]').click();await p.waitForFunction(()=>!UIinventario.carregando&&UIinventario.chave!==null);
 await p.locator(`[data-acao="consulta-classificar"][data-k="${mov.k}"]`).click();
 await p.locator('#destino-saida').selectOption('devolucao');
 assert.equal(await p.locator('[name="condicao"]:checked').count(),0);
 await p.locator('[data-salvar-destino]').click();assert.equal(await p.evaluate(k=>E.movimentos.find(i=>i.k===k).destino,mov.k),'pendente');
 // Sem confirmação ainda: apenas observação, sem converter para RMDF.
 await p.locator('#destino-saida').selectOption('pendente');await p.locator('#observacao-saida').fill('RMDF será aplicado em uma das peças.');await p.locator('[data-salvar-destino]').click();
 await p.waitForFunction(()=>!document.querySelector('#classificar-saida')&&!UIinventario.carregando);
 assert.equal(await p.evaluate(k=>E.movimentos.find(i=>i.k===k).condicaoDevolucao,mov.k),'');
 await p.locator(`[data-acao="consulta-classificar"][data-k="${mov.k}"]`).click();
 await p.locator('#destino-saida').selectOption('devolucao');await p.locator('#quantidade-saida').fill('2');await p.locator('[name="condicao"][value="nova"]').check();await p.locator('#observacao-saida').fill('Técnico confirmou duas peças sem defeito.');await p.locator('[data-salvar-destino]').click();
 await p.waitForFunction(()=>!document.querySelector('#classificar-saida')&&!UIinventario.carregando);
 const resto=await p.evaluate(k=>E.movimentos.find(i=>i.k!==k&&i.destino==='pendente'),mov.k);assert.equal(resto.qtd,1);
 await p.locator(`[data-acao="consulta-classificar"][data-k="${resto.k}"]`).click();await p.locator('#destino-saida').selectOption('devolucao');
 assert.equal(await p.locator('[name="condicao"]:checked').count(),0);
 await p.locator('[name="condicao"][value="rmdf"]').check();await p.locator('#observacao-saida').fill('Técnico confirmou RMDF aplicado.');
 for(const tema of ['light','dark']){
  await p.evaluate(tema=>document.documentElement.dataset.theme=tema,tema);
  for(const width of [1440,768,390,320]){
   await p.setViewportSize({width,height:1000});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await p.locator('.modal').evaluate(e=>e.scrollWidth>e.clientWidth),false);
   await p.screenshot({path:`capturas/rmdf/${firebase?'firebase':'memoria'}-${tema}-${width}.png`,fullPage:true});
  }
 }
 await p.locator('[data-salvar-destino]').click();await p.waitForFunction(()=>!document.querySelector('#classificar-saida')&&!UIinventario.carregando);await p.setViewportSize({width:1440,height:1000});
 // Persiste no banco, conserva origem nova e saldo; pontualidade não vira uso.
 await p.evaluate(async()=>{await carregarTudo();await carregarInventario();});
 const saldo=await p.evaluate(({tid,doc})=>{
  const ms=UIinventario.movimentos.filter(i=>i.doc===doc);const r=calcularDesempenho({tipo:'novas',periodo:'mes',referencia:'2026-10-13'});
  return {ms,soma:somar(ms,i=>i.qtd),tipo:filtrarInventario().map(i=>i.tipo),uso:r.uso.find(t=>t.tid===tid)?.uso||0,devolvidas:r.lista.find(t=>t.tid===tid)?.devolvidas||0,estoque: E.novas.filter(i=>i.tid===tid).map(i=>[i.mat,i.qtd])};
 },{tid,doc:mov.doc});
 assert.equal(saldo.soma,3);assert.equal(saldo.uso,0);assert.equal(saldo.devolvidas,3);assert.ok(saldo.tipo.every(t=>t==='novas'));assert.equal(saldo.estoque.find(([mat])=>mat===mov.mat)[1],6);
 assert.deepEqual(saldo.ms.map(i=>[i.qtd,i.condicaoDevolucao]).sort((a,b)=>a[0]-b[0]),[[1,'rmdf'],[2,'nova']]);assert.ok(saldo.ms.every(i=>i.classificacoes.length===2&&i.classificadoPor.uid));
 await p.locator('[data-mudar="inventario-filtro"][data-campo="estado"]').selectOption('rmdf');
 assert.equal(await p.locator('.tabela-inventario tbody tr').count(),1);
 await p.evaluate(async()=>{window.__exp=[];exportarExcel=async(nome,abas)=>window.__exp.push(abas);await exportarInventario();UIconsulta.filtros={...FILTROS_CONSULTA,origem:'saida'};await exportarConsulta();});
 const consulta=await p.evaluate(()=>window.__exp[1][0]);assert.ok(consulta.linhas.some(l=>l[17]==='RMDF aplicado — peça com defeito'));
 await p.evaluate(()=>exportarTudo());
 const geral=await p.evaluate(()=>window.__exp[2]);assert.ok(geral.find(a=>a.nome==='Saídas de novas').linhas.some(l=>l[9]==='RMDF aplicado — peça com defeito'));assert.equal(geral.find(a=>a.nome==='Cobranças').linhas[0][6],'Novas');
 const inventario=await p.evaluate(()=>window.__exp[0][0]);assert.equal(inventario.linhas[0][14],'RMDF aplicado — peça com defeito');assert.ok(inventario.linhas[0][16]);
 // Rejeita quantidade, condição e edição concorrente obsoleta; preserva os demais registros.
 const checks=await p.evaluate(async({k,doc})=>{
  const erros=[];for(const [q,op] of [[2,{condicao:'rmdf'}],[1,{}],[1,{condicao:'qualquer'}]])try{await classificarSaida(k,'devolucao',q,op);}catch(e){erros.push(e.message);}
  const antigo=versaoSaida(E.movimentos.find(i=>i.k===k));
  await classificarSaida(k,'devolucao',1,{condicao:'rmdf',observacao:'Conferência revisada'});
  try{await classificarSaida(k,'uso',1,{versaoEsperada:antigo});}catch(e){erros.push(e.message);}
  const d=await Armazem.ler(`movimentos/${doc}`);return {erros,itens:d.itens};
 },{k:resto.k,doc:mov.doc});
 assert.equal(checks.erros.length,4);assert.match(checks.erros[3],/alterada/);assert.equal(checks.itens.find(i=>i.k===mov.k).condicaoDevolucao,'nova');assert.equal(checks.itens.find(i=>i.k===resto.k).classificacoes.length,3);
 // Duas gravações sobre a mesma versão: somente uma pode vencer. Linhas distintas são preservadas.
 const concorrencia=await p.evaluate(async({k,outro})=>{
  const simultaneas=await Promise.allSettled([classificarSaida(k,'uso',1),classificarSaida(k,'devolucao',1,{condicao:'rmdf'})]);
  await carregarTudo();
  const separadas=await Promise.allSettled([classificarSaida(k,'devolucao',1,{condicao:'rmdf',observacao:'RMDF confirmado'}),classificarSaida(outro,'devolucao',2,{condicao:'nova',observacao:'Novas confirmadas'})]);
  await carregarTudo();await carregarInventario();
  return {simultaneas:simultaneas.map(r=>r.status),separadas:separadas.map(r=>r.status),condicoes:[k,outro].map(chave=>E.movimentos.find(i=>i.k===chave).condicaoDevolucao)};
 },{k:resto.k,outro:mov.k});
 assert.deepEqual(concorrencia.simultaneas.sort(),['fulfilled','rejected']);assert.deepEqual(concorrencia.separadas,['fulfilled','fulfilled']);assert.deepEqual(concorrencia.condicoes,['rmdf','nova']);
 // A exportação de relatórios preserva a origem nova e a condição sem inflar quantidades.
 const relatorio=await p.evaluate(()=>{
  const r=calcularRelatorio({inicio:'2026-10-01',fim:'2026-10-13',tipo:'novas'},{devolucoes:UIinventario.devolucoes,movimentos:UIinventario.movimentos},derivar());
  return abasRelatorio(r).find(a=>a.nome==='Movimentações');
 });
 assert.ok(relatorio.linhas.some(l=>l[4]==='Nova'&&l[7]===1&&l[16]==='RMDF aplicado — peça com defeito'));
 // Legado nunca ganha condição inventada.
 assert.equal(await p.evaluate(()=>condicaoDevolucao({destino:'devolucao'})),'Condição não informada');
 // Uma importação posterior e o desfazer dela preservam a classificação da saída anterior.
 await p.evaluate(async()=>{
  window.__CP_AGORA='2026-10-14T09:00:00';mudou();
  const a={tipo:'novas',regiao:'PR',nome:'PR Novas.csv',hash:'rmdf-seguinte',avisos:[],itens:E.novas.filter(i=>i.regiao==='PR').map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome}))};a.linhasLidas=a.itens.length;
  await importarLote([a]);await carregarTudo();
 });
 assert.equal(await p.evaluate(k=>E.movimentos.find(i=>i.k===k)?.condicaoDevolucao,resto.k),'rmdf');
 await p.evaluate(async()=>{await desfazerImportacao(E.importacoes.find(i=>!i.desfeito));await carregarTudo();});
 assert.equal(await p.evaluate(k=>E.movimentos.find(i=>i.k===k)?.condicaoDevolucao,resto.k),'rmdf');
 assert.equal(await p.evaluate(({tid,mat})=>E.novas.find(i=>i.tid===tid&&i.mat===mat).qtd,{tid,mat:mov.mat}),6);
 assert.deepEqual(erros,[]);
 console.log(`PASSOU (${firebase?'Firebase emulado':'memória'}): cobrança de novas nos dois canais, RMDF explícito/pendente/parcial, autoria, persistência, filtros/exportação, concorrência, saldo, pontualidade e responsividade.`);
}finally{await browser.close();await regras?.cleanup();}
