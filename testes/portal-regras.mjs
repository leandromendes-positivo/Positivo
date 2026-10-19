// Ataques diretos ao Firestore: esconder menus não é uma autorização.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH||'/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
const {getCountFromServer}=require('firebase/firestore');
const env=await initializeTestEnvironment({projectId:'demo-portal-tecnicos',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
const stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const conta=(uid,email,provider='google.com',verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();
const admin=conta('admin','admin@empresa.com'),ana=conta('ana','ana@empresa.com'),bruno=conta('bruno','bruno@empresa.com','microsoft.com'),operador=conta('operador','operador@empresa.com');
const id='PR--ANA',outroId='SC--ANA',gen='11111111-1111-4111-8111-111111111111',gen2='22222222-2222-4222-8222-222222222222';
const por={uid:'admin',email:'admin@empresa.com'};
const usuario=(email,perfil='tecnico',tecnicoId=id)=>({email,perfil,ativo:true,principal:false,criadoPor:por,atualizadoPor:por,criadoEm:stamp(),atualizadoEm:stamp(),...(perfil==='tecnico'?{tecnicoId}:{})});
const peca=(tipo='novas')=>({tipo,mat:'MAT-1',descricao:'Placa',quantidade:5,chamado:'',nf:'',tipoEnvio:'',desde:'2026-10-19'});
let verificacoes=0;
async function sim(p){await assertSucceeds(p);verificacoes++;}async function nao(p){await assertFails(p);verificacoes++;}
async function enviar(db,d,{semEvento=false,semAtual=false}={}){
 const b=db.batch();if(!semAtual)b.set(db.doc(`declaracoes_tecnicos/${d.tecnicoId}/itens/${d.peca}`),d);
 if(!semEvento)b.set(db.doc(`eventos_tecnicos/${d.evento}`),d);return b.commit();
}
let contador=0;
const declaracao=(extra={})=>({tecnicoId:id,peca:'n-1',geracao:gen,mat:'MAT-1',tipo:'novas',quantidadeDevolver:2,quantidadeRmdf:1,rmdf:'previsto',previsao:'2026-10-25',protocolo:'',observacao:'Separadas para retorno',cancelado:false,uid:'ana',email:'ana@empresa.com',versao:1,evento:`aaaaaaaa-aaaa-4aaa-8aaa-${String(++contador).padStart(12,'0')}`,em:stamp(),...extra});
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const [e,perfil,tid]of [['admin@empresa.com','administrador'],['operador@empresa.com','usuario'],['ana@empresa.com','tecnico',id],['bruno@empresa.com','tecnico',outroId]])await db.doc(`usuarios/${e}`).set(usuario(e,perfil,tid));
  await db.doc('cadastro/tecnicos').set({t:{ANA:{nome:'Ana',regiao:'PR'},BRUNO:{nome:'Bruno',regiao:'SC'}}});
  await db.doc(`vinculos_tecnicos/${id}`).set({email:'ana@empresa.com',tid:'ANA',regiao:'PR'});
  await db.doc(`vinculos_tecnicos/${outroId}`).set({email:'bruno@empresa.com',tid:'ANA',regiao:'SC'});
  await db.doc('dados/indice').set({versao:1});await db.doc('portal/controle').set({versao:1,geracao:gen,atualizadoEm:'2026-10-19T09:00:00'});
  await db.doc('seguranca/controle').set({versao:2});
  for(const t of [id,outroId,'RS--ANA'])for(const g of [gen,gen2]){
   await db.doc(`saldos_tecnicos/${t}/geracoes/${g}`).set({nome:'Ana',regiao:t.split('--')[0],tid:'ANA',total:2});
   await db.doc(`saldos_tecnicos/${t}/geracoes/${g}/pecas/n-1`).set(peca());
   await db.doc(`saldos_tecnicos/${t}/geracoes/${g}/pecas/u-1`).set(peca('usadas'));
  }
 });
 await sim(ana.doc('usuarios/ana@empresa.com').get());await sim(ana.doc('seguranca/controle').get());await sim(ana.doc('portal/controle').get());
 await sim(ana.doc(`vinculos_tecnicos/${id}`).get());await sim(ana.doc(`saldos_tecnicos/${id}/geracoes/${gen}`).get());
 await sim(ana.collection(`saldos_tecnicos/${id}/geracoes/${gen}/pecas`).get());
 assert.equal((await bruno.collection(`saldos_tecnicos/${outroId}/geracoes/${gen}/pecas`).get()).size,2);
 for(const db of [ana,bruno]){
  for(const caminho of ['config/geral','cadastro/tecnicos','dados/indice','dados/catalogo','ferias/conhecido','historico_ferias/conhecido','seguranca/outro','resumo/atual','movimentos/conhecido','devolucoes/conhecido','agendamentos/conhecido','contatos/conhecido','usuarios/admin@empresa.com'])await nao(db.doc(caminho).get());
  for(const col of ['usuarios','cadastro','dados','ferias','devolucoes','importacoes','historico','movimentos','agendamentos','contatos','portal','vinculos_tecnicos'])await nao(db.collection(col).limit(1).get());
  await nao(getCountFromServer(db.collection('usuarios')._delegate));await nao(db.collectionGroup('pecas').get());
 }
 for(const db of [env.unauthenticatedContext().firestore(),conta('fora','fora@empresa.com'),conta('ana','ana@empresa.com','password'),conta('ana','ana@empresa.com','google.com',false)]){
  await nao(db.doc('portal/controle').get());await nao(db.doc(`saldos_tecnicos/${id}/geracoes/${gen}/pecas/n-1`).get());
 }
 for(const caminho of [`saldos_tecnicos/${outroId}/geracoes/${gen}/pecas/n-1`,`saldos_tecnicos/${id}/geracoes/${gen2}/pecas/n-1`,`saldos_tecnicos/${outroId}/geracoes/${gen}`,`declaracoes_tecnicos/${outroId}/itens/n-1`])await nao(ana.doc(caminho).get());
 await nao(ana.collection(`saldos_tecnicos/${outroId}/geracoes/${gen}/pecas`).get());
 await nao(ana.doc(`saldos_tecnicos/${id}/geracoes/${gen}/pecas/n-1`).update({quantidade:999}));
 for(const perfil of ['administrador','usuario'])await nao(ana.doc('usuarios/ana@empresa.com').update({perfil,tecnicoId:firebase.firestore.FieldValue.delete(),atualizadoPor:{uid:'ana',email:'ana@empresa.com'},atualizadoEm:stamp()}));
 await nao(ana.doc('usuarios/ana@empresa.com').update({tecnicoId:outroId,atualizadoPor:{uid:'ana',email:'ana@empresa.com'},atualizadoEm:stamp()}));
 await nao(ana.doc(`vinculos_tecnicos/${id}`).update({email:'fora@empresa.com'}));
 await nao(ana.doc('portal/controle').update({geracao:gen2}));
 // Vínculos devem ser recíprocos, explícitos e exclusivos em uma transação administrativa.
 await nao(admin.doc('usuarios/novo@empresa.com').set(usuario('novo@empresa.com','tecnico','SC--BRUNO')));
 const b=admin.batch();b.set(admin.doc('usuarios/novo@empresa.com'),usuario('novo@empresa.com','tecnico','SC--BRUNO'));b.set(admin.doc('vinculos_tecnicos/SC--BRUNO'),{email:'novo@empresa.com',tid:'BRUNO',regiao:'SC'});await sim(b.commit());
 const rs=admin.batch();rs.set(admin.doc('usuarios/ana.rs@empresa.com'),usuario('ana.rs@empresa.com','tecnico','RS--ANA'));rs.set(admin.doc('vinculos_tecnicos/RS--ANA'),{email:'ana.rs@empresa.com',tid:'ANA',regiao:'RS'});await sim(rs.commit());
 const anaRS=conta('ana-rs','ana.rs@empresa.com');await sim(anaRS.doc(`saldos_tecnicos/RS--ANA/geracoes/${gen}/pecas/n-1`).get());await nao(anaRS.doc(`saldos_tecnicos/${id}/geracoes/${gen}/pecas/n-1`).get());
 await nao(admin.doc('usuarios/roubo@empresa.com').set(usuario('roubo@empresa.com')));
 const roubo=admin.batch();roubo.set(admin.doc('usuarios/roubo@empresa.com'),usuario('roubo@empresa.com'));roubo.set(admin.doc(`vinculos_tecnicos/${id}`),{email:'roubo@empresa.com',tid:'ANA',regiao:'PR'});await nao(roubo.commit());
 await sim(ana.doc('usuarios/ana@empresa.com').update({nome:'Ana Silva',atualizadoPor:{uid:'ana',email:'ana@empresa.com'},atualizadoEm:stamp()}));
 const original=declaracao();
 for(const extra of [
  {tecnicoId:outroId},{peca:'inexistente'},{geracao:gen2},{mat:'OUTRO'},{tipo:'usadas'},
  {quantidadeDevolver:5},{quantidadeDevolver:-1},{quantidadeDevolver:1.5},{quantidadeRmdf:7},{quantidadeRmdf:-1},
  {rmdf:'aplicado',protocolo:''},{rmdf:'qualquer'},{previsao:''},{previsao:'amanha'},
  {email:'bruno@empresa.com'},{uid:'bruno'},{versao:2},{versao:0},{cancelado:true},{observacao:'x'.repeat(501)},
  {protocolo:'x'.repeat(101)},{extra:true},{em:firebase.firestore.Timestamp.fromMillis(0)}
 ])await nao(enviar(ana,declaracao(extra)));
 await nao(enviar(ana,declaracao(),{semEvento:true}));await nao(enviar(ana,declaracao(),{semAtual:true}));
 await nao(enviar(operador,declaracao()));await nao(enviar(admin,declaracao()));
 await sim(enviar(ana,original));
 await sim(ana.doc(`eventos_tecnicos/${original.evento}`).get());await nao(bruno.doc(`eventos_tecnicos/${original.evento}`).get());
 await sim(ana.collection('eventos_tecnicos').where('tecnicoId','==',id).get());await nao(ana.collection('eventos_tecnicos').get());
 await nao(ana.collection('eventos_tecnicos').where('tecnicoId','==',outroId).get());await sim(operador.collection('eventos_tecnicos').get());
 await nao(ana.doc(`eventos_tecnicos/${original.evento}`).update({observacao:'Apagando autoria'}));
 await nao(ana.doc(`declaracoes_tecnicos/${id}/itens/n-1`).delete());
 await nao(enviar(ana,declaracao({versao:1}))); // Concorrência: versão já utilizada.
 await sim(enviar(ana,declaracao({versao:2,rmdf:'aplicado',protocolo:'RMDF-123'})));
 await nao(enviar(ana,declaracao({peca:'u-1',tipo:'usadas'}))); // RMDF não é permitido para usadas.
 await sim(enviar(ana,declaracao({peca:'u-1',tipo:'usadas',quantidadeRmdf:0,rmdf:'nenhum'})));
 await sim(enviar(ana,declaracao({versao:3,quantidadeDevolver:0,quantidadeRmdf:0,rmdf:'nenhum',previsao:'',cancelado:true})));
 // O índice e o portal avançam juntos; clientes antigos não podem desatualizar o portal.
 await nao(admin.doc('dados/indice').set({versao:2}));
 await nao(admin.doc('portal/controle').set({geracao:gen2,versao:2,atualizadoEm:'2026-10-20'}));
 const avancar=admin.batch();avancar.set(admin.doc('dados/indice'),{versao:2});avancar.set(admin.doc('portal/controle'),{geracao:gen2,versao:2,atualizadoEm:'2026-10-20'});await sim(avancar.commit());
 await nao(enviar(ana,declaracao({versao:4})));await nao(ana.doc(`saldos_tecnicos/${id}/geracoes/${gen}/pecas/n-1`).get());
 await sim(enviar(ana,declaracao({versao:4,geracao:gen2})));
 // Uma publicação antiga ou incompleta não pode exibir saldo divergente do índice oficial.
 await env.withSecurityRulesDisabled(async c=>c.firestore().doc('dados/indice').set({versao:3}));
 await nao(ana.doc(`saldos_tecnicos/${id}/geracoes/${gen2}/pecas/n-1`).get());
 await nao(enviar(ana,declaracao({versao:5,geracao:gen2})));
 await env.withSecurityRulesDisabled(async c=>c.firestore().doc('dados/indice').set({versao:2}));
 await sim(admin.doc('usuarios/ana@empresa.com').update({ativo:false,atualizadoPor:por,atualizadoEm:stamp()}));
 await nao(ana.doc(`saldos_tecnicos/${id}/geracoes/${gen2}/pecas/n-1`).get());
 await nao(ana.doc('portal/controle').get());await nao(enviar(ana,declaracao({versao:5,geracao:gen2})));
 console.log(`Portal técnico: ${verificacoes} verificações de isolamento, autoria, quantidades, histórico, revogação e publicação atômica passaram.`);
}finally{await env.cleanup();}
