// Saldo e cadastros fictícios, somente no banco em memória da versão offline.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),erros=[];
 p.on('pageerror',e=>erros.push(e.message));
 await p.addInitScript(()=>window.__CP_AGORA='2026-11-16T09:29:00-03:00');
 await p.goto(process.env.URL_PAINEL_TESTE||'http://127.0.0.1:8003/pagina-completa.html');
 await p.waitForFunction(()=>E.status==='pronto');assert.equal(await p.evaluate(()=>Acesso.modo),'memoria');
 await p.evaluate(async()=>{
  window.__linhaReversao=(nome,mat,qtd=2)=>({tecChave:nome,tecNome:nome,mat,qtd,desc:'Descrição original '+mat,nf:'NF-'+mat,remessa:'REM-'+mat,chamado:'CH-'+mat,dataFT:'2026-11-10',tipoEnvio:'BACKUP'});
  window.__arquivoReversao=(tipo,itens,regiao='PR')=>({tipo,regiao,itens,nome:`${regiao} ${tipo}.csv`,hash:crypto.randomUUID(),avisos:[],linhasLidas:itens.length});
  const linha=__linhaReversao,arquivo=__arquivoReversao;
  await importarLote([arquivo('novas',[linha('ANA','001',5)]),arquivo('usadas',[linha('ANA','002',3)]),arquivo('rmdf',[linha('ANA','003')]),arquivo('novas',[linha('SANTA CATARINA','004',7)],'SC')]);
  window.__antesReversao=structuredClone({usadas:E.usadas,novas:E.novas,rmdf:E.rmdf,catalogo:E.catalogo});
  window.__CP_AGORA='2026-11-17T09:28:00-03:00';
  await importarLote(['novas','usadas','rmdf'].map((tipo,n)=>arquivo(tipo,[{...linha('ANA','00'+(n+1),1),desc:'Descrição incorreta'},...['ERRADO','EDITADO','VINCULADO','CONTATO'].map(nome=>linha(nome,'ERR-'+nome))])));
  window.__loteReversao=E.importacoes[0].id;
  await salvarTecnico('EDITADO',{telefone:'41999999999'});
  await Armazem.gravar('usuarios/vinculado@empresa.test',{email:'vinculado@empresa.test',perfil:'tecnico',tecnicoId:'PR--VINCULADO',ativo:false});
  await Armazem.gravar('contatos/contato-teste',{tid:'CONTATO',canal:'email',obs:'Contato posterior que deve ser preservado.'});
  await Armazem.mesclar('dados/catalogo',{m:{'ERR-EDITADO':'Descrição corrigida manualmente'}},true);E.catalogo['ERR-EDITADO']='Descrição corrigida manualmente';
  irPara('importar');
 });
 const desfazer=p.getByRole('button',{name:'Desfazer última importação',exact:true});
 assert.equal(await desfazer.isEnabled(),true);await desfazer.click();
 await p.locator('.modal [data-fechar]').first().click();assert.equal(await p.evaluate(()=>E.importacoes[0].desfeito),false,'cancelar mantém a importação');
 await desfazer.click();await p.locator('.modal [data-ok]').click();
 await p.waitForFunction(()=>!UI.im.revertendo&&E.importacoes.find(i=>i.id===window.__loteReversao).desfeito);
 const reversao=await p.evaluate(()=>({
  fotos:{usadas:E.usadas,novas:E.novas,rmdf:E.rmdf},antes:__antesReversao,
  removido:!E.cadastro.ERRADO,preservados:['EDITADO','VINCULADO','CONTATO'].every(tid=>!!E.cadastro[tid]),telefone:E.cadastro.EDITADO.telefone,
  original:E.catalogo['001'],semMaterialErrado:!Object.hasOwn(E.catalogo,'ERR-ERRADO'),manual:E.catalogo['ERR-EDITADO'],
  devolucoes:E.devolucoes.length,movimentos:E.movimentos.length,
  dias:derivar().mapa.get('ANA').novasLinhas[0].dias
 }));
 assert.deepEqual(reversao.fotos,{usadas:reversao.antes.usadas,novas:reversao.antes.novas,rmdf:reversao.antes.rmdf});
 assert.equal(reversao.removido,true);assert.equal(reversao.preservados,true);assert.equal(reversao.telefone,'41999999999');
 assert.equal(reversao.original,'Descrição original 001');assert.equal(reversao.semMaterialErrado,true);assert.equal(reversao.manual,'Descrição corrigida manualmente');
 assert.equal(reversao.devolucoes,0);assert.equal(reversao.movimentos,0);assert.equal(reversao.dias,2,'nova mantém a entrada original, dia 1 em 16/11');
 assert.equal(await p.evaluate(async()=>!!await Armazem.ler('contatos/contato-teste')&&!!await Armazem.ler('usuarios/vinculado@empresa.test')),true);
 assert.equal(await desfazer.isDisabled(),true);
 assert.match(await p.evaluate(async()=>{try{await desfazerImportacao(E.importacoes.find(i=>i.id===__loteReversao));return '';}catch(e){return e.message;}}),/já foi desfeita/);
 await p.evaluate(async()=>{
  window.__CP_AGORA='2026-11-17T10:00:00-03:00';
  await importarLote([__arquivoReversao('novas',[__linhaReversao('ANA','001',6)])]);irPara('importar');
 });assert.equal(await desfazer.isEnabled(),true,'nova importação cria uma nova versão reversível');
 // Excluir remove da relação ativa; não apaga saldos, histórico nem contas globais.
 await p.evaluate(async()=>{
  E.cadastro['SEM-PECAS']={chave:'SEM PECAS',nome:'SEM PECAS',regiao:'PR',tipo:'tecnico',email:'global@empresa.test'};
  await Armazem.gravar('cadastro/tecnicos',{t:E.cadastro});
  for(const [id,perfil,tecnicoId]of [['tecnico.pr@empresa.test','tecnico','PR--SEM-PECAS'],['tecnico.sc@empresa.test','tecnico','SC--SEM-PECAS'],['global@empresa.test','usuario',null]]){
   await Armazem.gravar(`usuarios/${id}`,{email:id,perfil,ativo:true,...(tecnicoId?{tecnicoId}:{})});
  }
  E.usuarios=await Armazem.consultar('usuarios');UI.tc.mostrarSemDados=true;mudou();irPara('tecnicos');
 });
 const exclusao=p.locator('[data-acao="excluir-tecnico"][data-tid="SEM-PECAS"]');
 assert.equal(await exclusao.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true,'excluir aparece ao lado do nome, sem rolar a tabela');
 await exclusao.click();
 await p.locator('.modal [data-ok]').click();await p.waitForFunction(()=>E.cadastro['SEM-PECAS'].excluido);
 assert.equal(await p.locator('[data-acao="tecnico"][data-tid="SEM-PECAS"]').count(),0);
 const excluido=await p.evaluate(async()=>({
  cadastro:await Armazem.ler('cadastro/tecnicos'),
  ativos:await Promise.all(['tecnico.pr','tecnico.sc','global'].map(async id=>(await Armazem.ler(`usuarios/${id}@empresa.test`)).ativo)),
  pdf:opcoesPdfTecnico().some(t=>t.tid==='SEM-PECAS'),vinculo:opcoesVinculoTecnico().some(t=>t.tid==='SEM-PECAS')
 }));
 assert.equal(excluido.cadastro.t['SEM-PECAS'].nome,'SEM PECAS');assert.deepEqual(excluido.ativos,[false,false,true]);assert.equal(excluido.pdf,false);assert.equal(excluido.vinculo,false);
 await p.locator('[data-acao="tecnicos-situacao"][data-situacao="excluidos"]').click();
 assert.equal(await p.locator('[data-acao="tecnico"][data-tid="SEM-PECAS"]').count(),1);
 for(const tema of ['light','dark'])for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${tema}/${width}: cadastros sem transbordamento`);
 }
 await p.setViewportSize({width:1440,height:1000});
 await p.locator('[data-acao="reativar-tecnico"][data-tid="SEM-PECAS"]').click();await p.locator('.modal [data-ok]').click();
 await p.waitForFunction(()=>E.cadastro['SEM-PECAS'].excluido===false);
 assert.equal(await p.evaluate(async()=>(await Armazem.ler('usuarios/tecnico.pr@empresa.test')).ativo),false,'reativar cadastro não libera novamente o login');
 await p.locator('[data-acao="tecnicos-situacao"][data-situacao="ativos"]').click();
 await p.locator('[data-acao="excluir-tecnico"][data-tid="ANA"]').click();
 assert.match(await p.locator('.modal').innerText(),/continuam no estoque/);await p.locator('.modal [data-ok]').click();
 await p.waitForFunction(()=>E.cadastro.ANA.excluido);
 assert.equal(await p.evaluate(()=>derivar().mapa.get('ANA').novasQtd),6);assert.equal(await p.evaluate(()=>opcoesPdfTecnico().some(t=>t.tid==='ANA')),true,'peças pendentes continuam nos relatórios');
 await p.evaluate(async()=>{window.__CP_AGORA='2026-11-17T10:01:00-03:00';await importarLote([__arquivoReversao('novas',[__linhaReversao('ANA','001',6)])]);});
 assert.equal(await p.evaluate(()=>E.cadastro.ANA.excluido),true,'uma nova planilha não reativa um técnico excluído');
 const acesso=await p.evaluate(async()=>{
  const modo=Acesso.modo,perfil=Acesso.perfil;
  try{Acesso.modo='firebase';Acesso.perfil={ativo:true,perfil:'usuario'};
   const visivel=renderTecnicos().includes('data-acao="excluir-tecnico"');
   try{await alterarExclusaoTecnico('ANA',false);return {visivel,erro:''};}catch(e){return {visivel,erro:e.message};}
  }finally{Acesso.modo=modo;Acesso.perfil=perfil;}
 });assert.equal(acesso.visivel,false);assert.match(acesso.erro,/exclusiva de administradores/);
 assert.deepEqual(erros,[]);
 console.log('Reversão e cadastro: botão com confirmação, três estoques/datas restaurados, saídas removidas, cadastros e catálogo reconciliados, edições/vínculos preservados, exclusão/reativação, bloqueio de acessos vinculados e dois temas em 320/390/1440 px passaram.');
}finally{await browser.close();}
