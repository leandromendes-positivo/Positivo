// Confirmação formal por e-mail com peças mistas. Nenhum canal externo é aberto.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preencherData} from './calendario-ajudante.mjs';
import {prepararEmulador} from './emulador.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PW_PATH||'playwright'),firebase=process.env.CONFIRMACOES_FIREBASE==='1';
let regras;
if(firebase){const req=createRequire(`${process.env.PW_PATH}/package.json`);regras=await req('@firebase/rules-unit-testing').initializeTestEnvironment({projectId:'demo-controle-pecas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});await prepararEmulador();}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM});fs.mkdirSync('capturas/confirmacoes',{recursive:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 if(firebase)await ctx.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({path:path.join(process.env.FIREBASE_SDK_DIR,r.request().url().split('/').pop()),contentType:'application/javascript'}));
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>{erros.push(e.message);console.error(e.message);});
 await p.addInitScript(f=>{window.__CP_AGORA='2026-10-09T09:00:00';if(f){window.CP_FIREBASE={apiKey:'chave-de-teste',authDomain:'demo-controle-pecas.firebaseapp.com',projectId:'demo-controle-pecas'};window.__CP_FIREBASE_EMULADOR__=true;window.__CP_LOGIN_TESTE__={sub:'uid-teste@exemplo.com',email:'teste@exemplo.com',email_verified:true};}},firebase);
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8000/pagina-completa.html');await p.waitForFunction(()=>E.status==='pronto');
 assert.equal(await p.evaluate(()=>Acesso.modo),firebase?'firebase':'memoria');if(firebase)assert.equal(await p.evaluate(()=>Acesso.fs.app.options.projectId),'demo-controle-pecas');
 await p.setInputFiles('#entrada-topo',fs.readdirSync('exemplos').filter(f=>f.endsWith('.csv')).map(f=>path.resolve('exemplos',f)));await p.waitForFunction(()=>UI.im.resultado);
 const original=await p.evaluate(()=>{const t=derivar().tecnicos.find(t=>t.nome.startsWith('Ana'));return {tid:t.tid,total:t.nUsadas+t.novasTodas,usada:t.usadas.find(i=>i.qtd===2),nova:novasParaCobranca(t).find(i=>i.qtd===9)};});
 const tid=original.tid;
 await p.evaluate(tid=>{UI.cob.aba='todos';UI.cob.busca=nomeTecnico(tid);irPara('cobrancas');},tid);
 assert.equal(await p.locator('[data-acao="tipo-cob"][data-tipo="usadas"]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-acao="tipo-cob"][data-tipo="novas"]').click();assert.equal(await p.evaluate(()=>filtrarCobrancas(derivar()).every(t=>itensDaAba(t,UI.cob.aba,hojeISO(),UI.cob.tipo).every(i=>i.tipo==='novas'))),true);
 await p.locator('[data-acao="tipo-cob"][data-tipo="todas"]').click();
 await p.locator(`[data-acao="cobrar-filtrado"][data-tid="${tid}"]`).click();
 assert.match(await p.locator('#cob-texto').inputValue(),/confirmação deve ser enviada por e-mail/);assert.match(await p.locator('#cob-email-corpo').inputValue(),/novas e usadas/);assert.match(await p.locator('#cob-email-corpo').inputValue(),/RMDF/);
 await p.locator('[data-registrar]').click();await p.waitForFunction(()=>!document.querySelector('#cob-form'));
 await p.locator('[data-acao="aba-cob"][data-aba="respostas"]').click();await p.locator('[data-acao="resposta-filtro"][data-v="formalizar"]').click();
 assert.match(await p.locator('.respostas-cobranca').innerText(),/Ana/);
 await p.locator(`[data-acao="confirmar-retorno"][data-tid="${tid}"]`).click();assert.equal(await p.locator('[data-salvar-confirmacao]').isDisabled(),true);
 await p.locator('[data-formalizar-email]').click();assert.equal(await p.locator('#cob-form [name="canal"]').inputValue(),'email');
 await p.locator('[data-registrar]').click();await p.waitForFunction(()=>!document.querySelector('#cob-form'));
 const formal=await p.evaluate(tid=>emailsFormais(tid)[0],tid);assert.equal(formal.tipo,'mistas');assert.equal(formal.pecas,original.total);
 await p.evaluate(data=>{window.__CP_AGORA=somaDias(data.slice(0,10),1)+'T12:00:00';mudou();UI.cob.resposta='aguardando';renderizar(true);},formal.em);
 assert.equal(await p.evaluate(()=>alertasOperacionais().some(a=>a.id==='respostas_pendentes')),true);
 await p.locator(`[data-acao="confirmar-retorno"][data-tid="${tid}"]`).click();
 const pos=await p.evaluate(({tid,uk,nk})=>{const its=pecasCobranca(derivar().mapa.get(tid),'todas');return {u:its.findIndex(i=>i.k===uk),n:its.findIndex(i=>i.k===nk)};},{tid,uk:original.usada.k,nk:original.nova.k});
 const u=p.locator(`[data-confirmacao-linha="${pos.u}"]`),n=p.locator(`[data-confirmacao-linha="${pos.n}"]`);
 for(const c of await p.locator('[data-incluir]').all())await c.uncheck();await u.locator('[data-incluir]').check();await n.locator('[data-incluir]').check();
 await u.locator('[data-quantidade]').fill('1');await n.locator('[data-quantidade]').fill('3');
 await p.locator('#confirmacao-contato').selectOption(formal.id);
 const data=await p.evaluate(()=>somaDias(hojeISO(),2));await preencherData(p.locator('#confirmacao-data'),data);
 await p.locator('#confirmacao-email').fill('Re: Devolução de peças — resposta do técnico às 10h30');await p.locator('#confirmacao-ateste').check();
 await p.locator('[data-salvar-confirmacao]').click();assert.equal(await p.evaluate(()=>E.agendamentos.length),0,'nova sem condição explícita não salva');
 await n.locator('[data-condicao]').selectOption('mista');await n.locator('[data-rmdf]').fill('1');await p.locator('#confirmacao-obs').fill('Técnico confirmou 2 novas, 1 RMDF aplicado e 1 usada.');
 for(const tema of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);for(const width of [1440,768,390,320]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await p.locator('.modal').evaluate(e=>e.scrollWidth>e.clientWidth),false);await p.screenshot({path:`capturas/confirmacoes/${firebase?'firebase':'memoria'}-${tema}-${width}.png`});}}
 await p.locator('[data-salvar-confirmacao]').click();await p.waitForFunction(()=>!document.querySelector('#confirmacao-form'));
 await p.setViewportSize({width:1440,height:1000});
 const salvo=await p.evaluate(({tid,data})=>{const t=derivar().mapa.get(tid),r=acompanhamentoRespostas(derivar(),'todas').filter(i=>i.tid===tid);return {a:E.agendamentos,pendentes:somar(r.filter(i=>i.estadoResposta==='aguardando'),i=>i.qtd),confirmadas:somar(r.filter(i=>i.estadoResposta==='confirmada'),i=>i.qtd),agenda:agendaDoPainel(derivar(),data)[0].qtd,total:t.nUsadas+t.novasTodas,cobrar:somar(itensDaAba(t,'cobrar',hojeISO(),'todas'),i=>i.qtd)};},{tid,data});
 assert.equal(salvo.total,original.total);assert.equal(salvo.confirmadas,4);assert.equal(salvo.pendentes,original.total-4);assert.equal(salvo.agenda,4);assert.equal(salvo.a.find(a=>a.peca===original.nova.k).confirmacao.qtdRmdf,1);
 assert.equal(await p.evaluate(()=>alertasOperacionais().some(a=>a.id==='respostas_confirmadas')),true);
 await p.locator('[data-acao="resposta-filtro"][data-v="confirmada"]').click();assert.match(await p.locator('.resposta-cartao').innerText(),/RMDF aplicado/);assert.match(await p.locator('.resposta-cartao').innerText(),/resposta do técnico/);
 await p.evaluate(data=>{UIpainel.dia=data;irPara('painel');},data);assert.match(await p.locator('.cartao-agenda').innerText(),/4 peças/);
 await p.evaluate(async()=>{await carregarTudo();});assert.equal(await p.evaluate(()=>E.agendamentos.filter(a=>a.confirmacao).length),2);
 // Edição obsoleta e importação concorrente não sobrescrevem a confirmação.
 const conflitos=await p.evaluate(async({tid,k,data})=>{const i=pecasCobranca(derivar().mapa.get(tid),'todas').find(i=>i.k===k),c=i.confirmacao;const out=[];await gravarAgendamentos([{...i,confirmacao:{...c,observacao:'Conferida'}}],data);try{await gravarAgendamentos([i],data);}catch(e){out.push(e.message);}try{await gravarAgendamentos([{...i,versaoAgenda:E.agendamentos.find(a=>a.peca===k).versao}],data,null,{versaoIndice:-1});}catch(e){out.push(e.message);}return out;},{tid,k:original.usada.k,data});assert.equal(conflitos.length,2);
 await p.evaluate(data=>{window.__CP_AGORA=somaDias(data,1)+'T12:00:00';mudou();},data);assert.equal(await p.evaluate(tid=>somar(acompanhamentoRespostas().filter(i=>i.tid===tid&&i.estadoResposta==='vencida'),i=>i.qtd),tid),4);
 // Uma saída parcial reduz a quantidade prevista, sem alterar a condição real da devolução.
 await p.evaluate(async({tid,uk,mat})=>{const arquivos=['usadas','novas'].map(tipo=>({tipo,regiao:'PR',nome:`PR ${tipo}.csv`,hash:`conf-parcial-${tipo}`,avisos:[],itens:E[tipo].filter(i=>i.regiao==='PR').map(i=>({...i,tecChave:E.cadastro[i.tid].chave,tecNome:E.cadastro[i.tid].nome,qtd:i.tid===tid&&(tipo==='usadas'?i.k===uk:i.mat===mat)?i.qtd-(tipo==='usadas'?1:2):i.qtd}))}));for(const a of arquivos)a.linhasLidas=a.itens.length;await importarLote(arquivos);},{tid,uk:original.usada.k,mat:original.nova.mat});
 assert.equal(await p.evaluate(tid=>somar(itensAgendaCompleta().filter(i=>i.tid===tid),i=>i.qtd),tid),1);assert.equal(await p.evaluate(tid=>E.movimentos.filter(i=>i.tid===tid).every(i=>i.destino==='pendente'&&!i.condicaoDevolucao),tid),true);
 const parcialNoPrazo=await p.evaluate(()=>{
   const i={qtd:10,qtdPrevista:3,previsao:somaDias(hojeISO(),-1),dias:2,prazo:7};
   return [selecionarAbaCobranca([i],'cobrar',hojeISO())[0].qtd,selecionarAbaCobranca([{...i,dias:8}],'cobrar',hojeISO())[0].qtd];
 });assert.deepEqual(parcialNoPrazo,[3,10],'previsão parcial vencida não antecipa o atraso do restante ainda no prazo');
 assert.deepEqual(erros,[]);console.log(`PASSOU (${firebase?'Firebase':'memória'}): filtro novas/usadas/mistas, WhatsApp não formaliza, e-mail obrigatório, quantidades parciais/RMDF, agenda, alertas, autoria, persistência, concorrência e importação.`);
}finally{await browser.close();await regras?.cleanup();}
