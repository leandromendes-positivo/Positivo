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
const aviso=montarLembreteFerias(saidas.map(s=>({...s,nome:'<img src=x onerror=alert(1)>'})),'https://example.test/');assert.doesNotMatch(aviso.html,/<img/);assert.match(aviso.html,/&lt;img/);assert.match(aviso.texto,/01\/01\/2027/);assert.match(aviso.texto,/desativar/);
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
const args={db,transporte,remetente:'remetente@exemplo.com',hoje,painel:'https://example.test/'};
const sim=await processarLembretes({...args,simular:true});assert.equal(sim.destinatarios,1);assert.equal(mensagens.length,0);assert.equal(verificacoes,0);
await Promise.all([processarLembretes(args),processarLembretes(args)]);assert.equal(mensagens.length,1,'concorrência e inscrições repetidas não duplicam mensagem');assert.equal(mensagens[0].to.address,'caixa@exemplo.com');assert.equal(mensagens[0].cc,undefined);assert.equal(mensagens[0].bcc,undefined);
await processarLembretes({...args,hoje:'2026-12-23'});assert.equal(mensagens.length,2,'somente saída que entrou hoje na janela é nova');
await processarLembretes({...args,hoje:'2026-12-23'});assert.equal(mensagens.length,2,'reexecução não repete saída');
// Uma nova data dentro do prazo recebe novo aviso; mudanças de observação não.
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
