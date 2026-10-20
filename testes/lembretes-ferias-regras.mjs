import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/positivo-tools/node_modules/playwright'}/package.json`);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
const {getCountFromServer}=require('firebase/firestore');
const env=await initializeTestEnvironment({projectId:'demo-lembretes-ferias',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
const conta=(uid,email,provider='google.com',verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();
const dono=conta('dono','dono@empresa.com'),pessoa=conta('pessoa','pessoa@empresa.com','microsoft.com'),outro=conta('outro','outro@empresa.com'),tecnico=conta('tecnico','tecnico@empresa.com');
const stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const novo=()=>({uid:'pessoa',titular:'pessoa@empresa.com',email:'destino@empresa.com',ativo:true,versao:1,criadoEm:stamp(),atualizadoEm:stamp()});
try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();for(const[email,perfil,ativo]of [['dono@empresa.com','administrador',true],['pessoa@empresa.com','usuario',true],['outro@empresa.com','usuario',true],['tecnico@empresa.com','tecnico',true]])await db.doc(`usuarios/${email}`).set({email,perfil,ativo});
  await db.doc('servicos/lembretes-ferias').set({habilitado:true});await db.doc('envios_lembretes_ferias/teste').set({email:'destino@empresa.com'});
 });
 await assertSucceeds(pessoa.doc('lembretes_ferias/pessoa').get());
 await assertSucceeds(pessoa.doc('servicos/lembretes-ferias').get());
 for(const email of ['dois@empresa.com,terceiro@empresa.com','a@empresa.com\r\nBcc:b@empresa.com','a@empresa..com','invalido','',123,'Pessoa@Empresa.com'])await assertFails(pessoa.doc('lembretes_ferias/pessoa').set({...novo(),email}));
 for(const extra of [{uid:'outro'},{titular:'outro@empresa.com'},{versao:2},{versao:0},{ativo:'true'},{campoExtra:true},{criadoEm:firebase.firestore.Timestamp.fromMillis(0)},{atualizadoEm:firebase.firestore.Timestamp.fromMillis(0)}])await assertFails(pessoa.doc('lembretes_ferias/pessoa').set({...novo(),...extra}));
 await assertSucceeds(pessoa.doc('lembretes_ferias/pessoa').set(novo()));
 for(const db of [outro,dono,tecnico,env.unauthenticatedContext().firestore()]){
  await assertFails(db.doc('lembretes_ferias/pessoa').get());await assertFails(db.doc('lembretes_ferias/pessoa').update({ativo:false,atualizadoEm:stamp(),versao:2}));await assertFails(db.collection('lembretes_ferias').get());await assertFails(getCountFromServer(db.collection('lembretes_ferias')._delegate));
 }
 for(const db of [tecnico,conta('pessoa','pessoa@empresa.com','password'),conta('pessoa','pessoa@empresa.com','google.com',false)]){
  await assertFails(db.doc('servicos/lembretes-ferias').get());await assertFails(db.doc('lembretes_ferias/pessoa').get());await assertFails(db.doc('lembretes_ferias/pessoa').set(novo()));
 }
 await assertFails(pessoa.doc('lembretes_ferias/outro').set(novo()));
 await assertFails(pessoa.doc('lembretes_ferias/pessoa').update({versao:1,email:'novo@empresa.com',atualizadoEm:stamp()}));
 await assertFails(pessoa.doc('lembretes_ferias/pessoa').update({versao:2,criadoEm:stamp(),atualizadoEm:stamp()}));
 await assertSucceeds(pessoa.doc('lembretes_ferias/pessoa').update({versao:2,ativo:false,atualizadoEm:stamp()}));
 await assertSucceeds(pessoa.doc('lembretes_ferias/pessoa').update({versao:3,email:'pessoa+equipe@empresa.com',ativo:true,atualizadoEm:stamp()}));
 for(const db of [pessoa,dono,tecnico]){
  await assertFails(db.doc('envios_lembretes_ferias/teste').get());await assertFails(db.doc('envios_lembretes_ferias/teste').set({estado:'enviado'}));await assertFails(db.doc('caixa_lembretes_ferias/teste').set({estado:'enviado'}));await assertFails(db.doc('servicos/lembretes-ferias').set({habilitado:true}));
 }
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('usuarios/pessoa@empresa.com').update({ativo:false}));
 await assertFails(pessoa.doc('lembretes_ferias/pessoa').get());await assertFails(pessoa.doc('lembretes_ferias/pessoa').delete());
 console.log('Regras dos lembretes: inscrição privada, autoria, validação, versões, opt-out, revogação e bloqueio de técnicos/auditoria passaram.');
}finally{await env.cleanup();}
