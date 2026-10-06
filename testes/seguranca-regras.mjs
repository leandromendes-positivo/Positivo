// Testes adversariais das regras reais, sem usar a interface como barreira.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(`${process.env.PW_PATH || '/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const { initializeTestEnvironment,assertSucceeds,assertFails }=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
const stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const env=await initializeTestEnvironment({projectId:'demo-controle-seguranca',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
const conta=(uid,email,provider='google.com',verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();
const dono=conta('dono','dono@empresa.com'),operador=conta('ana','ana.silva@empresa.com','microsoft.com');
const outro=conta('rui','rui@outlook.com');
const por={uid:'dono',email:'dono@empresa.com'};
const usuario=(email,perfil='usuario',principal=false)=>({email,perfil,ativo:true,principal,criadoEm:stamp(),atualizadoEm:stamp(),criadoPor:por,atualizadoPor:por});
try {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await db.doc('usuarios/dono@empresa.com').set(usuario('dono@empresa.com','administrador',true));
  await db.doc('usuarios/ana.silva@empresa.com').set(usuario('ana.silva@empresa.com'));
  await db.doc('dados/indice').set({arquivos:{}});
 });
 for(const db of [env.unauthenticatedContext().firestore(),outro,conta('ana','ana.silva@empresa.com','microsoft.com',false),conta('ana','ana.silva@empresa.com','password')]) {
  await assertFails(db.doc('dados/indice').get());
  await assertFails(db.doc('usuarios/rui@outlook.com').set(usuario('rui@outlook.com','administrador')));
 }
 await assertSucceeds(operador.doc('dados/indice').get());
 await assertSucceeds(operador.doc('usuarios/ana.silva@empresa.com').get());
 await assertFails(operador.collection('usuarios').get());
 await assertFails(operador.doc('usuarios/dono@empresa.com').get());
 await assertFails(operador.doc('usuarios/ana.silva@empresa.com').update({perfil:'administrador',atualizadoEm:stamp(),atualizadoPor:{uid:'ana',email:'ana.silva@empresa.com'}}));
 for(const path of ['cadastro/tecnicos','config/geral','dados/indice','importacoes/teste','movimentos/teste','resumo/atual','seguranca/controle','acompanhamento/t1']) await assertFails(operador.doc(path).set({teste:true}));
 await assertSucceeds(dono.doc('usuarios/rui@outlook.com').set(usuario('rui@outlook.com')));
 await assertFails(dono.doc('usuarios/dono@empresa.com').update({ativo:false,atualizadoEm:stamp(),atualizadoPor:por}));
 await assertFails(dono.doc('usuarios/dono@empresa.com').update({principal:false,atualizadoEm:stamp(),atualizadoPor:por}));
 await assertFails(dono.doc('usuarios/rui@outlook.com').delete());
 await assertSucceeds(outro.doc('dados/indice').get());
 const agenda=(peca,versao=1,previsao='2026-10-10',anterior='')=>({peca,tid:'t1',versao,previsao,anterior,evento:crypto.randomUUID(),uid:'ana',email:'ana.silva@empresa.com',em:stamp()});
 const gravar=(db,d)=>{const b=db.batch();b.set(db.doc(`agendamentos/${d.peca}`),d);b.set(db.doc(`auditoria_agendamentos/${d.evento}`),d);return b.commit();};
 let d=agenda('p1');
 await assertFails(operador.doc('agendamentos/p1').set(d)); // sem evento de auditoria
 await assertFails(gravar(operador,{...d,uid:'dono',email:'dono@empresa.com'}));
 await assertFails(gravar(operador,{...d,em:firebase.firestore.Timestamp.fromDate(new Date('2000-01-01'))}));
 await assertSucceeds(gravar(operador,d));
 await assertFails(operador.doc(`auditoria_agendamentos/${d.evento}`).update({previsao:'2030-01-01'}));
 await assertFails(dono.doc(`auditoria_agendamentos/${d.evento}`).delete());
 await assertFails(operador.doc('agendamentos/p1').delete());
 await assertFails(gravar(operador,agenda('p1',2,'2026-10-11',''))); // anterior adulterado
 await assertSucceeds(gravar(operador,agenda('p1',2,'2026-10-11','2026-10-10')));
 await assertFails(gravar(operador,agenda('p1',2,'2026-10-12','2026-10-11'))); // versão antiga
 await assertSucceeds(gravar(operador,agenda('p1',3,'','2026-10-11')));
 assert.equal((await operador.doc('agendamentos/p1').get()).data().previsao,'');
 // O tamanho real dos lotes permanece dentro do limite de consultas das regras.
 const lote=operador.batch();for(let n=0;n<8;n++){const x=agenda(`lote-${n}`);lote.set(operador.doc(`agendamentos/${x.peca}`),x);lote.set(operador.doc(`auditoria_agendamentos/${x.evento}`),x);}await assertSucceeds(lote.commit());
 await assertSucceeds(operador.doc('contatos/c1').set({tid:'t1',canal:'ligacao',previsao:'',obs:'Ligação registrada',pecas:1,itens:['p1'],uid:'ana',email:'ana.silva@empresa.com',em:stamp()}));
 await assertFails(operador.doc('contatos/c1').update({obs:'reescrever'}));
 await assertSucceeds(dono.doc('usuarios/ana.silva@empresa.com').update({ativo:false,atualizadoEm:stamp(),atualizadoPor:por}));
 await assertFails(operador.doc('dados/indice').get({source:'server'}));
 await assertFails(gravar(operador,agenda('bloqueada')));
 console.log('PASSOU: Google/Microsoft, verificação de e-mail, acesso individual, perfis, antiescalação, revogação, autor e horário autenticados, auditoria imutável, concorrência e lotes.');
} finally {await env.cleanup();}
