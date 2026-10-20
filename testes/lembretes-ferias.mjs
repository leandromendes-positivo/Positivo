import assert from 'node:assert/strict';
import {saidasParaLembrar,montarLembreteFerias,processarLembretes} from '../aviso/lembretes-ferias.mjs';
import {hojeBrasilia} from '../aviso/enviar-aviso.mjs';
const hoje='2026-12-22';
const f=(id,inicio,extra={})=>({id,nome:'Pessoa '+id,regiao:'PR',ciclo:'2026',status:'confirmado',periodos:[{inicio,fim:inicio,retorno:''}],...extra});
assert.equal(hojeBrasilia(new Date('2026-12-23T01:30:00Z')),hoje);
const registros=[f('exata','2027-01-01'),f('longe','2027-01-02'),f('amanha','2026-12-23'),f('hoje',hoje),f('passada','2026-12-21'),f('cancelada','2027-01-01',{status:'cancelado'}),f('retirada','2027-01-01',{arquivado:true}),f('invalida','2026-02-30'),f('planejada','2027-01-01',{status:'planejado'})];
const saidas=saidasParaLembrar(registros,hoje);assert.deepEqual(saidas.map(s=>s.feriasId),['amanha','exata','planejada']);
assert.equal(saidas.find(s=>s.feriasId==='exata').antecedencia,10);assert.equal(saidas.find(s=>s.feriasId==='exata').retorno,'2027-01-02');
const varios=f('varios','2027-01-01',{periodos:[{inicio:'2027-01-01',fim:'2027-01-10',retorno:'2027-01-12'},{inicio:'2026-12-25',fim:'2026-12-26',retorno:''}]});
assert.equal(saidasParaLembrar([varios],hoje).length,2);assert.equal(saidasParaLembrar([varios],hoje).find(s=>s.inicio==='2027-01-01').retorno,'2027-01-12');
const chaves=saidasParaLembrar([varios],hoje).map(s=>s.chave);assert.deepEqual(saidasParaLembrar([{...varios,periodos:[...varios.periodos].reverse()}],hoje).map(s=>s.chave),chaves,'reordenar períodos não cria novo envio');
const aviso=montarLembreteFerias(saidas.map(s=>({...s,nome:'<img src=x onerror=alert(1)>'})),'https://example.test/');assert.doesNotMatch(aviso.html,/<img[^>]*onerror/);assert.match(aviso.html,/&lt;img/);assert.match(aviso.texto,/01\/01\/2027/);assert.match(aviso.texto,/desativar/);
// Banco em memória com transações serializadas para exercitar dois trabalhadores concorrentes.
function banco(){
 const dados=new Map();let fila=Promise.resolve();
 const snap=p=>({id:p.split('/').at(-1),exists:dados.has(p),data:()=>dados.get(p)});
 const doc=p=>({path:p,get:async()=>snap(p)});
 const db={dados,doc,collection:c=>{const query=(filtros=[])=>({where:(f,op,v)=>query([...filtros,[f,v]]),get:async()=>({docs:[...dados.keys()].filter(p=>p.split('/').slice(0,-1).join('/')===c&&filtros.every(([f,v])=>dados.get(p)[f]===v)).map(snap)})});return query();},runTransaction:fn=>{
  const tarefa=fila.then(async()=>{const changes=[];const result=await fn({get:r=>r.get(),set:(r,d)=>changes.push([r.path,d])});for(const [p,d] of changes)dados.set(p,d);return result;});fila=tarefa.catch(()=>{});return tarefa;
 },batch:()=>{const updates=[];return{update:(r,d)=>updates.push([r.path,d]),commit:async()=>{for(const[p,d]of updates)dados.set(p,{...dados.get(p),...d});}};}};
 return db;
}
const db=banco();
const add=(p,d)=>db.dados.set(p,d);
for(const r of registros)add('ferias/'+r.id,r);
for(const [uid,titular,email,perfil,ativo]of [['u1','pessoa@exemplo.com','caixa@exemplo.com','usuario',true],['u2','outra@exemplo.com','caixa@exemplo.com','administrador',true],['tec','tec@exemplo.com','tecnico@exemplo.com','tecnico',true],['desativado','inativo@exemplo.com','inativo@exemplo.com','usuario',false],['parou','parou@exemplo.com','parou@exemplo.com','usuario',true]]){
 add('usuarios/'+titular,{perfil,ativo});add('lembretes_ferias/'+uid,{uid,titular,email,ativo:uid!=='parou'});
}
const mensagens=[];let verificacoes=0;
const transporte={verify:async()=>{verificacoes++;},sendMail:async m=>{mensagens.push(m);return{accepted:[m.to.address]};}};
const args={db,transporte,remetente:'remetente@exemplo.com',hoje,horario:'12:00',painel:'https://example.test/'};
const sim=await processarLembretes({...args,simular:true});assert.equal(sim.destinatarios,1);assert.equal(mensagens.length,0);assert.equal(verificacoes,0);
await Promise.all([processarLembretes(args),processarLembretes(args)]);assert.equal(mensagens.length,1,'concorrência e inscrições repetidas não duplicam mensagem');assert.equal(mensagens[0].to.address,'caixa@exemplo.com');assert.equal(mensagens[0].cc,undefined);assert.equal(mensagens[0].bcc,undefined);
await processarLembretes({...args,hoje:'2026-12-23'});assert.equal(mensagens.length,2,'somente saída que entrou hoje na janela é nova');
await processarLembretes({...args,hoje:'2026-12-23'});assert.equal(mensagens.length,2,'reexecução não repete saída');
// Uma nova data dentro do prazo recebe uma atualização; reexecutar não duplica.
add('ferias/exata',f('exata','2026-12-28'));
await processarLembretes(args);assert.equal(mensagens.length,3);await processarLembretes(args);assert.equal(mensagens.length,3);
// Desativar todos os interessados no endereço interrompe os próximos envios.
for(const uid of ['u1','u2'])db.dados.get('lembretes_ferias/'+uid).ativo=false;
add('ferias/nova',f('nova','2027-01-01'));await processarLembretes(args);assert.equal(mensagens.length,3);
// Falha antes do SMTP não consome a saída. Timeout após tentativa não é reenviado.
db.dados.get('lembretes_ferias/u1').ativo=true;
await assert.rejects(()=>processarLembretes({...args,transporte:{verify:async()=>{throw new Error('indisponivel');}}}));
const semEnvio=await processarLembretes({...args,transporte:{verify:async()=>{},sendMail:async()=>{throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});}}});assert.equal(semEnvio.pendentes,1);
const apos=mensagens.length;await processarLembretes(args);assert.equal(mensagens.length,apos,'resultado SMTP incerto não é reenviado');
// Uma rejeição inequívoca permite nova tentativa posterior.
add('ferias/rejeitada',f('rejeitada','2027-01-01'));
await processarLembretes({...args,transporte:{verify:async()=>{},sendMail:async()=>{throw Object.assign(new Error('rejeitado'),{code:'EENVELOPE'});}}});
await processarLembretes(args);assert.equal(mensagens.length,apos+1);
console.log('Lembretes: 10 dias corridos/Brasília, virada de ano, vários períodos, cancelamento, retirada, opt-out, perfis, privacidade, concorrência, deduplicação e falhas de SMTP passaram; nenhum e-mail real enviado.');
// Horário e antecedência são aplicados por inscrição, sem antecipar o envio.
const agenda=banco();agenda.dados.set('usuarios/gestor@exemplo.com',{perfil:'usuario',ativo:true});
agenda.dados.set('lembretes_ferias/gestor',{uid:'gestor',titular:'gestor@exemplo.com',email:'gestor@exemplo.com',ativo:true,horario:'14:35',antecedencia:20});
agenda.dados.set('ferias/futura',f('futura','2027-01-11'));
const lista=[];const a={db:agenda,transporte:{verify:async()=>{},sendMail:async m=>{lista.push(m);return{accepted:[m.to.address]};}},remetente:'remetente@exemplo.com',hoje};
await processarLembretes({...a,horario:'14:34'});assert.equal(lista.length,0);
await processarLembretes({...a,horario:'14:35'});assert.equal(lista.length,1);
await processarLembretes({...a,horario:'23:59'});assert.equal(lista.length,1);
agenda.dados.get('lembretes_ferias/gestor').antecedencia=1;agenda.dados.set('ferias/curta',f('curta','2026-12-24'));
await processarLembretes({...a,horario:'15:00'});assert.equal(lista.length,1,'dois dias não entra em antecedência de um dia');
await processarLembretes({...a,hoje:'2026-12-23',horario:'15:00'});assert.equal(lista.length,2);
const {processarTestesFerias}=await import('../aviso/testes-ferias.mjs');
agenda.dados.set('testes_lembretes_ferias/gestor',{uid:'gestor',pedido:'pedido-teste-1234567890',solicitadoEm:new Date()});
await Promise.all([processarTestesFerias(a,true),processarTestesFerias(a,true)]);
assert.equal(lista.length,3,'pedidos de teste concorrentes são enviados uma vez');assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,'enviado');
await processarTestesFerias(a,true);assert.equal(lista.length,3,'teste não repete nem interfere na programação');
agenda.dados.set('testes_lembretes_ferias/gestor',{uid:'gestor',pedido:'pedido-teste-2234567890',solicitadoEm:new Date()});
await processarTestesFerias(a,false);assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,'indisponivel');assert.equal(lista.length,3);
agenda.dados.set('testes_lembretes_ferias/gestor',{uid:'gestor',pedido:'pedido-teste-3234567890',solicitadoEm:new Date()});agenda.dados.get('usuarios/gestor@exemplo.com').ativo=false;
await processarTestesFerias(a,true);assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,'falhou');assert.equal(lista.length,3,'conta revogada não recebe teste');
console.log('Horários individuais, antecedência configurável e testes privados/concorrentes/revogação passaram.');
// Retomada do teste inicial só ocorre se nenhum SMTP pôde ser tentado.
const {solicitarTesteProprietario,diagnosticarFilaTestes}=await import('../aviso/testes-ferias.mjs');
agenda.dados.set('seguranca/controle',{administradorPrincipal:'gestor@exemplo.com'});
agenda.dados.set('operacoes_lembretes_ferias/teste-proprietario-2026-10-20',{criadoEm:new Date().toISOString()});
agenda.dados.set('testes_lembretes_ferias/gestor',{uid:'gestor',pedido:'teste-sem-remetente-12345',estado:'indisponivel',solicitadoEm:new Date()});
agenda.dados.get('usuarios/gestor@exemplo.com').ativo=true;
await solicitarTesteProprietario(agenda);assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,'indisponivel');
await solicitarTesteProprietario(agenda,{retomarIndisponivel:true});assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,undefined);
const pedidoFila=agenda.dados.get('testes_lembretes_ferias/gestor').pedido;
await solicitarTesteProprietario(agenda,{retomarIndisponivel:true});assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').pedido,pedidoFila);
assert.equal((await diagnosticarFilaTestes(agenda)).aguardando,1);
await processarTestesFerias(a,true);assert.equal(lista.length,4);
await solicitarTesteProprietario(agenda,{retomarIndisponivel:true});await processarTestesFerias(a,true);assert.equal(lista.length,4,'retomar não repete e-mail aceito');
agenda.dados.set('testes_lembretes_ferias/gestor',{uid:'gestor',pedido:'teste-recusa-1234567890',solicitadoEm:new Date()});
await processarTestesFerias({...a,transporte:{sendMail:async()=>{throw Object.assign(new Error('Não registrar detalhes do SMTP'),{code:'EENVELOPE'});}}},true);
assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').codigo,'EENVELOPE');
assert.equal(agenda.dados.get('testes_lembretes_ferias/gestor').estado,'falhou');
console.log('Retomada segura de remetente indisponível, preservação da fila e diagnóstico sem dados pessoais passaram.');

// Lotes curtos mantêm todas as saídas e deixam o HTML abaixo do corte do Gmail.
const dbLotes=banco(),mensagensLotes=[];
dbLotes.dados.set('usuarios/gestor@exemplo.com',{ativo:true,perfil:'usuario'});
dbLotes.dados.set('lembretes_ferias/lotes',{uid:'lotes',titular:'gestor@exemplo.com',email:'caixa@exemplo.com',ativo:true});
for(let i=0;i<21;i++)dbLotes.dados.set('ferias/lote-'+i,f('lote-'+i,'2027-01-01'));
await processarLembretes({db:dbLotes,hoje,horario:'12:00',painel:'https://example.test/',remetente:'origem@exemplo.com',transporte:{verify:async()=>{},sendMail:async m=>{mensagensLotes.push(m);return {accepted:[m.to.address]};}}});
assert.equal(mensagensLotes.length,2);
for(const m of mensagensLotes){assert.ok(Buffer.byteLength(m.html,'utf8')<90000);assert.match(m.html,/alt="Positivo Tecnologia"/);}
assert.equal([...dbLotes.dados].filter(([p,d])=>p.startsWith('envios_lembretes_ferias/')&&d.estado==='enviado').length,21);
const inseguro=montarLembreteFerias(saidas,'javascript:alert(1)');assert.doesNotMatch(inseguro.html,/<(?:a|img)\b/);
console.log('E-mail: lotes sem cortar conteúdo, logo, link seguro e 21 saídas preservadas passaram.');

// Atualizações usam a última programação aceita pelo provedor, não só a saída.
const mudancas=banco(),avisosMudancas=[];
mudancas.dados.set('usuarios/gestor@exemplo.com',{perfil:'usuario',ativo:true});
mudancas.dados.set('lembretes_ferias/gestor',{uid:'gestor',titular:'gestor@exemplo.com',email:'gestor@exemplo.com',ativo:true,horario:'12:00',antecedencia:10});
const salvarMudanca=d=>mudancas.dados.set('ferias/pessoa',structuredClone(d));
let atual=f('pessoa','2027-01-01');salvarMudanca(atual);
const am={db:mudancas,hoje,horario:'12:00',painel:'https://example.test/',remetente:'origem@exemplo.com',transporte:{verify:async()=>{},sendMail:async m=>{avisosMudancas.push(m);return {accepted:[m.to.address]};}}};
await processarLembretes(am);assert.equal(avisosMudancas.length,1);
atual.periodos[0].fim='2027-01-10';atual.periodos[0].retorno='2027-01-11';salvarMudanca(atual);
await Promise.all([processarLembretes(am),processarLembretes(am)]);assert.equal(avisosMudancas.length,2,'mesma saída com fim/retorno alterados avisa uma vez mesmo com concorrência');
assert.match(avisosMudancas[1].subject,/programação atualizada/);assert.match(avisosMudancas[1].text,/Antes:/);assert.match(avisosMudancas[1].text,/Agora:/);assert.match(avisosMudancas[1].text,/10\/01\/2027/);
await processarLembretes(am);assert.equal(avisosMudancas.length,2);
atual.atualizadoEm=new Date();atual.versao=40;salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,2,'metadados técnicos não repetem aviso');
atual.periodos=[{inicio:'2027-03-01',fim:'2027-03-20',retorno:'2027-03-21'}];salvarMudanca(atual);
await processarLembretes({...am,horario:'11:59'});assert.equal(avisosMudancas.length,2,'atualizações respeitam horário e inscrição');
await processarLembretes(am);assert.equal(avisosMudancas.length,3,'mudança para fora da janela também avisa quem já recebeu');
atual.status='cancelado';salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,4);assert.match(avisosMudancas.at(-1).text,/Cancelado/);
await processarLembretes(am);assert.equal(avisosMudancas.length,4,'cancelamento não repete');
atual.status='confirmado';atual.arquivado=true;salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,5);assert.match(avisosMudancas.at(-1).text,/Retirado da lista/);
atual.arquivado=false;salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,6,'restaurar programação também é alteração');
mudancas.dados.delete('ferias/pessoa');await processarLembretes(am);assert.equal(avisosMudancas.length,7);assert.match(avisosMudancas.at(-1).text,/Cadastro excluído/);
await processarLembretes(am);assert.equal(avisosMudancas.length,7,'exclusão não repete');
salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,8,'restaurar após exclusão avisa');
atual.obs='Novo detalhe';salvarMudanca(atual);
await processarLembretes({...am,transporte:{verify:async()=>{},sendMail:async()=>{throw Object.assign(new Error('rejeitado'),{code:'EENVELOPE'});}}});
await processarLembretes(am);assert.equal(avisosMudancas.length,9,'atualização rejeitada pode tentar novamente');
atual.status='planejado';salvarMudanca(atual);
await processarLembretes({...am,transporte:{verify:async()=>{},sendMail:async()=>{throw Object.assign(new Error('incerto'),{code:'ETIMEDOUT'});}}});
await processarLembretes(am);assert.equal(avisosMudancas.length,9,'atualização incerta não é duplicada');
// Privacidade: quem nunca recebeu aquele colaborador ou saiu da inscrição não recebe atualização.
mudancas.dados.set('ferias/nunca',f('nunca','2027-05-01',{status:'cancelado'}));
mudancas.dados.get('lembretes_ferias/gestor').ativo=false;atual.nome='Nome alterado';salvarMudanca(atual);await processarLembretes(am);assert.equal(avisosMudancas.length,9);
// Migração: um envio antigo sem snapshot não deve disparar todos os lembretes de novo.
const migracao=banco();migracao.dados.set('usuarios/gestor@exemplo.com',{perfil:'usuario',ativo:true});migracao.dados.set('lembretes_ferias/gestor',{uid:'gestor',titular:'gestor@exemplo.com',email:'gestor@exemplo.com',ativo:true});
const {createHash}=await import('node:crypto');const antiga=saidasParaLembrar([f('legado','2027-01-01')],hoje)[0];
migracao.dados.set('envios_lembretes_ferias/'+createHash('sha256').update('gestor@exemplo.com|'+antiga.chave).digest('hex'),{email:'gestor@exemplo.com',feriasId:'legado',inicio:'2027-01-01',estado:'enviado',atualizadoEm:'2026-12-22T10:00:00.000Z'});
migracao.dados.set('ferias/legado',f('legado','2027-01-01',{atualizadoEm:new Date('2026-12-22T09:00:00.000Z')}));
const antesMigracao=avisosMudancas.length;await processarLembretes({...am,db:migracao});assert.equal(avisosMudancas.length,antesMigracao);
migracao.dados.get('ferias/legado').periodos[0].fim='2027-01-05';await processarLembretes({...am,db:migracao});assert.equal(avisosMudancas.length,antesMigracao+1);
// Se a edição já ocorreu depois do envio legado, a implantação envia a atualização.
for(const p of [...migracao.dados.keys()])if(p.startsWith('acompanhamento_lembretes_ferias/'))migracao.dados.delete(p);
migracao.dados.get('ferias/legado').atualizadoEm=new Date('2026-12-22T10:00:00.001Z');
await processarLembretes({...am,db:migracao});assert.equal(avisosMudancas.length,antesMigracao+2);
const alteracaoMaliciosa=montarLembreteFerias([],'https://example.test/',[{antes:null,depois:{...atual,nome:'<img src=x onerror=alert(1)>',regiao:'<script>x</script>'}}]);assert.doesNotMatch(alteracaoMaliciosa.html,/<img[^>]*onerror/);assert.match(alteracaoMaliciosa.html,/&lt;script&gt;/);
console.log('Alterações: fim/retorno sem mudar saída, fora da janela, cancelamento, retirada, exclusão/restauração, concorrência, migração, privacidade e SMTP passaram.');
// Lotes de atualizações continuam abaixo do corte do Gmail, sem perder colaboradores.
for(let i=0;i<21;i++)dbLotes.dados.get('ferias/lote-'+i).status='planejado';
await processarLembretes({db:dbLotes,hoje,horario:'12:00',painel:'https://example.test/',remetente:'origem@exemplo.com',transporte:{verify:async()=>{},sendMail:async m=>{mensagensLotes.push(m);return {accepted:[m.to.address]};}}});
assert.equal(mensagensLotes.length,4);for(const m of mensagensLotes.slice(2)){assert.match(m.subject,/programação atualizada/);assert.ok(Buffer.byteLength(m.html,'utf8')<90000);}
// A ordem dos períodos não importa; voltar a uma versão anterior é uma nova alteração.
const ordem=banco(),mailsOrdem=[];ordem.dados.set('usuarios/gestor@exemplo.com',{perfil:'usuario',ativo:true});ordem.dados.set('lembretes_ferias/gestor',{uid:'gestor',titular:'gestor@exemplo.com',email:'gestor@exemplo.com',ativo:true});
ordem.dados.set('ferias/varios',structuredClone(varios));const ao={...am,db:ordem,transporte:{verify:async()=>{},sendMail:async m=>{mailsOrdem.push(m);return{accepted:[m.to.address]};}}};
await processarLembretes(ao);ordem.dados.get('ferias/varios').periodos.reverse();await processarLembretes(ao);assert.equal(mailsOrdem.length,1);
ordem.dados.get('ferias/varios').status='planejado';await processarLembretes(ao);ordem.dados.get('ferias/varios').status='confirmado';await processarLembretes(ao);assert.equal(mailsOrdem.length,3);
