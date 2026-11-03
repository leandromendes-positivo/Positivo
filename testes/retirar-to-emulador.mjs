// Exclusão com Firestore/Auth reais exclusivamente nos emuladores locais.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {executarRetiradaTO,OPERACAO_TO} from '../seguranca/retirar-to.mjs';
import {bloquearGravacoes} from '../seguranca/limpar-pecas.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore'),{getAuth}=require('firebase-admin/auth');
for(const k of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[k]||''))throw Error('Somente emuladores locais.');
const projeto='demo-retirada-to',source=fs.readFileSync('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId:projeto,firestore:{host:'127.0.0.1',port:8080,rules:bloquearGravacoes(source)}});
const app=initializeApp({projectId:projeto},'teste-retirada-to'),db=getFirestore(app),auth=getAuth(app);
try{
 await env.clearFirestore();
 for(const email of ['admin@retirada.teste','pr@retirada.teste','to@retirada.teste'])try{await auth.createUser({email,password:'Teste123456!',emailVerified:true});}catch(e){if(e.code!=='auth/email-already-exists')throw e;}
 await db.doc('seguranca/controle').set({administradorPrincipal:'admin@retirada.teste'});
 await db.doc('usuarios/admin@retirada.teste').set({perfil:'administrador',ativo:true,principal:true});
 await db.doc('usuarios/to@retirada.teste').set({perfil:'tecnico',ativo:true,tecnicoId:'TO--TO1'});
 await db.doc('usuarios/pr@retirada.teste').set({perfil:'tecnico',ativo:true,tecnicoId:'PR--PR1'});
 const t={},arquivos={};
 for(const [uf,qtd]of [['PR',2],['SC',3],['RS',4],['TO',99]]){
  const tid=uf+'1';t[tid]={nome:'Pessoa '+uf,regiao:uf};arquivos['usadas:'+uf]={gen:'legado',partes:1,em:'2026-11-03'};
  await db.doc(`dados/u-${uf}-legado-0`).set({regiao:uf,tipo:'usadas',itens:[{cp_lista:['k-'+uf,tid,'NF','REM','MAT-'+uf,'CH','2026-10-01',qtd,'2026-10-01']}]});
  await db.doc(`ferias/${uf}`).set({id:uf,nome:'Pessoa '+uf,regiao:uf,status:'planejado',periodos:[]});
 }
 await db.doc('cadastro/tecnicos').set({t});await db.doc('dados/indice').set({versao:5,arquivos,anterior:{}});
 await db.doc('portal/controle').set({versao:5,geracao:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',atualizadoEm:'2026-11-03'});
 await db.doc('saldos_tecnicos/TO--TO1/geracoes/orfa/pecas/to').set({quantidade:99});
 await db.doc('devolucoes/mista').set({itens:[{cp_lista:['k-TO','TO1','MAT-TO','CH','',99,'2026-11-02',10,'TO']},{cp_lista:['k-PR','PR1','MAT-PR','CH','',1,'2026-11-02',10,'PR']}]});
 const antesPR=(await db.doc('dados/u-PR-legado-0').get()).data();
 const cliente=env.authenticatedContext('admin-fixture',{email:'admin@retirada.teste',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 const args={db,auth,source,regras:{releaseFirestoreRulesetFromSource:async()=>{}},esperar:async()=>{await assertFails(cliente.doc('dados/teste-pr').set({regiao:'PR'}));await assertSucceeds(cliente.doc('dados/u-PR-legado-0').get());}};
 const previa=await executarRetiradaTO(args);assert.ok(previa.documentosExcluir>0);assert.equal((await db.doc('ferias/TO').get()).exists,true);
 await executarRetiradaTO({...args,aplicar:true});
 for(const uf of ['PR','SC','RS'])assert.equal((await db.doc('ferias/'+uf).get()).exists,true);
 assert.equal((await db.doc('ferias/TO').get()).exists,false);assert.equal((await db.doc('dados/u-TO-legado-0').get()).exists,false);
 assert.equal((await db.doc('saldos_tecnicos/TO--TO1/geracoes/orfa/pecas/to').get()).exists,false);
 assert.deepEqual((await db.doc('dados/u-PR-legado-0').get()).data(),antesPR);
 assert.equal((await db.doc('devolucoes/mista').get()).data().itens.length,1);
 await assert.rejects(()=>auth.getUserByEmail('to@retirada.teste'),e=>e.code==='auth/user-not-found');
 assert.ok((await auth.getUserByEmail('admin@retirada.teste')).uid);assert.ok((await auth.getUserByEmail('pr@retirada.teste')).uid);
 const controle=(await db.doc('portal/controle').get()).data();assert.equal(controle.versao,(await db.doc('dados/indice').get()).data().versao);
 const resumo=(await db.doc('resumo/atual').get()).data();assert.equal(resumo.dias[resumo.hoje].pendentes,9);
 assert.equal((await db.doc(`operacoes_manutencao/${OPERACAO_TO}`).get()).data().estado,'concluida');
 await assertSucceeds(cliente.doc('dados/teste-pr').set({regiao:'PR'}));
 assert.equal((await executarRetiradaTO({...args,aplicar:true})).jaConcluida,true);
 console.log('Retirada TO nos emuladores: transações, exclusão recursiva, Firebase Auth, trava, reconstrução de saldos/resumo e preservação de PR/SC/RS passaram.');
}finally{await env.cleanup();await deleteApp(app);}
