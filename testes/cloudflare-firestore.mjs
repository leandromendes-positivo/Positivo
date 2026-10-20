// Integração REST com transações reais, exclusivamente no emulador.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {firestoreREST} from '../cloudflare/firestore.mjs';
import {limitarTeste,deveProcessarLembretes} from '../cloudflare/worker.mjs';
import {processarTestesFerias} from '../aviso/testes-ferias.mjs';
import {processarLembretes} from '../aviso/lembretes-ferias.mjs';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(host||''))throw new Error('Integração permitida apenas no emulador.');
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-worker-ferias',firestore:{host:'127.0.0.1',port:8080,rules:'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }'}});
const db=firestoreREST('demo-worker-ferias','owner',async(url,init)=>{
 assert.ok(url.startsWith('https://firestore.googleapis.com/v1/projects/demo-worker-ferias/'));
 return fetch(url.replace('https://firestore.googleapis.com','http://'+host),init);
});
try{
 await env.clearFirestore();
 await db.doc('usuarios/pessoa@exemplo.com').set({ativo:true,perfil:'usuario'});
 const solicitadoEm=new Date('2026-10-20T12:00:00Z');
 for(const uid of ['pessoa','outra']){
  await db.doc('lembretes_ferias/'+uid).set({uid,titular:'pessoa@exemplo.com',email:'destino@exemplo.com',ativo:true});
  await db.doc('testes_lembretes_ferias/'+uid).set({uid,pedido:'pedido-'+uid,solicitadoEm});
 }
 assert.equal((await db.collection('lembretes_ferias').where('ativo','==',true).get()).docs.length,2);
 const mensagens=[],servico={db:limitarTeste(db,'pessoa'),remetente:'origem@exemplo.com',transporte:{sendMail:async m=>{mensagens.push(m);return {accepted:[m.to.address]};}}};
 await Promise.all([processarTestesFerias(servico,true),processarTestesFerias(servico,true)]);
 assert.equal(mensagens.length,1,'reserva real impede envio concorrente duplicado');
 assert.equal((await db.doc('testes_lembretes_ferias/pessoa').get()).data().estado,'enviado');
 assert.deepEqual((await db.doc('testes_lembretes_ferias/pessoa').get()).data().solicitadoEm,solicitadoEm,'timestamp preservado para o limite de frequência');
 assert.equal((await db.doc('testes_lembretes_ferias/outra').get()).data().estado,undefined,'endpoint não processa terceiro');
 await db.doc('servicos/lembretes-ferias').set({executor:'cloudflare',habilitado:true});
 await db.doc('servicos/lembretes-ferias').set({ultimoProcessamento:'agora'},{merge:true});
 assert.equal((await db.doc('servicos/lembretes-ferias').get()).data().executor,'cloudflare','merge preserva configuração');
 const batch=db.batch();batch.update(db.doc('servicos/lembretes-ferias'),{habilitado:false});await batch.commit();
 assert.equal((await db.doc('servicos/lembretes-ferias').get()).data().habilitado,false);
 assert.equal((await db.doc('ferias/inexistente').get()).exists,false);
 await db.doc('ferias/pessoa').set({atualizadoEm:new Date('2026-10-20T10:00:00Z')});
 const antesRevisao=await db.revisaoFerias();
 await db.doc('ferias/outra').set({atualizadoEm:new Date('2026-10-20T11:00:00Z')});
 assert.notEqual(await db.revisaoFerias(),antesRevisao,'nova programação altera revisão');
 await db.doc('lembretes_ferias/pessoa').set({horario:'07:55',versao:1},{merge:true});
 await db.doc('lembretes_ferias/outra').set({horario:'07:55',versao:1},{merge:true});
 assert.equal(await deveProcessarLembretes(db,new Date('2026-10-20T10:54:00Z')),null,'não processa antes do horário de Brasília');
 const janela=await deveProcessarLembretes(db,new Date('2026-10-20T10:55:00Z'));assert.ok(janela);
 await janela.ref.set({assinatura:janela.assinatura});
 assert.equal(await deveProcessarLembretes(db,new Date('2026-10-20T11:00:00Z')),null,'não relê todo o planejamento a cada minuto sem mudança');
 await db.doc('lembretes_ferias/pessoa').set({versao:2},{merge:true});
 assert.ok(await deveProcessarLembretes(db,new Date('2026-10-20T11:00:00Z')),'preferência alterada reabre janela');

 const lote=await db.getAll(db.doc('testes_lembretes_ferias/outra'),db.doc('ferias/inexistente'));assert.deepEqual(lote.map(s=>[s.id,s.exists]),[['outra',true],['inexistente',false]]);
 await db.runTransaction(async tx=>{const l=await tx.getAll(db.doc('usuarios/pessoa@exemplo.com'),db.doc('ferias/inexistente'));assert.deepEqual(l.map(s=>s.exists),[true,false]);});
 // Acompanhamento das alterações passa pelo mesmo adaptador REST da produção.
 const programacao={nome:'Pessoa REST',regiao:'PR',status:'confirmado',periodos:[{inicio:'2026-10-30',fim:'2026-11-08',retorno:'2026-11-09'}],atualizadoEm:new Date('2026-10-20T12:00:00Z')};
 await db.doc('ferias/real').set(programacao);
 const enviados=[],args={db,remetente:'origem@exemplo.com',hoje:'2026-10-20',horario:'12:00',painel:'https://example.test/',transporte:{verify:async()=>{},sendMail:async m=>{enviados.push(m);return{accepted:[m.to.address]};}}};
 await Promise.all([processarLembretes(args),processarLembretes(args)]);assert.equal(enviados.length,1,'concorrência real não repete lembrete');
 await db.doc('ferias/real').set({...programacao,periodos:[{inicio:'2026-10-30',fim:'2026-11-18',retorno:'2026-11-19'}]});
 await Promise.all([processarLembretes(args),processarLembretes(args)]);assert.equal(enviados.length,2,'concorrência real não repete atualização');assert.match(enviados[1].text,/18\/11\/2026/);
 await db.doc('ferias/real').set({...programacao,status:'cancelado'});await processarLembretes(args);assert.equal(enviados.length,3);assert.match(enviados[2].text,/Cancelado/);
 await processarLembretes(args);assert.equal(enviados.length,3,'snapshot REST evita repetição do cancelamento');
 console.log('Worker REST: transações reais, concorrência, atualizações/cancelamentos, isolamento por UID, timestamps, consultas e merge passaram. Nenhum e-mail real enviado.');
}finally{await env.cleanup();}
