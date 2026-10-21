// A troca de senha é uma barreira do banco, inclusive para chamadas REST diretas.
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const env=await initializeTestEnvironment({projectId:'demo-senha-regras',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
const conta=(claims={})=>env.authenticatedContext('pessoa',{email:'pessoa@empresa.com',email_verified:true,auth_time:201,cpSenha:2,firebase:{sign_in_provider:'password'},...claims}).firestore();
try{
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();await db.doc('usuarios/pessoa@empresa.com').set({ativo:true,perfil:'usuario'});await db.doc('dados/indice').set({versao:1});
  await db.doc('credenciais_usuarios/pessoa@empresa.com').set({uid:'pessoa',versao:2,exigirTroca:true,estado:'temporaria',liberadoApartir:200});
 });
 await assertFails(conta().doc('dados/indice').get());await assertFails(conta().doc('usuarios/pessoa@empresa.com').get());
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('credenciais_usuarios/pessoa@empresa.com').update({exigirTroca:false,estado:'ativo'}));
 await assertSucceeds(conta().doc('dados/indice').get());
 for(const claims of [{cpSenha:1},{auth_time:199},{email_verified:false},{firebase:{sign_in_provider:'custom'}}])await assertFails(conta(claims).doc('dados/indice').get());
 for(const col of ['credenciais_usuarios','recuperacoes_senha','pedidos_recuperacao','limites_contas']){await assertFails(conta().doc(col+'/pessoa@empresa.com').get());await assertFails(conta().doc(col+'/pessoa@empresa.com').set({exigirTroca:false,versao:2}));}
 await assertFails(conta().doc('usuarios/pessoa@empresa.com').update({perfil:'administrador'}));
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('credenciais_usuarios/pessoa@empresa.com').update({versao:3,exigirTroca:true,estado:'temporaria'}));
 await assertFails(conta().doc('dados/indice').get());
 console.log('Senha nas regras: troca obrigatória no servidor, versão/token/horário, bloqueio imediato e segredos privados passaram.');
}finally{await env.cleanup();}
