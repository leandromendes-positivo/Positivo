// Banco e usuários exclusivamente locais. Nunca aponta para o projeto real.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {limparPecasUmaVez,bloquearGravacoes,COLECOES_PECAS} from '../seguranca/limpar-pecas.mjs';
const require=createRequire(`${process.env.PW_PATH||'/workspace/Positivo/seguranca'}/package.json`);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
if(!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Teste de limpeza permitido somente no emulador local.');
const projeto='demo-limpeza-pecas',source=await readFile('firestore.rules','utf8'),bloqueadas=bloquearGravacoes(source);
const env=await initializeTestEnvironment({projectId:projeto,firestore:{host:'127.0.0.1',port:8080,rules:bloqueadas}});
const app=initializeApp({projectId:projeto},'teste-limpeza'),db=getFirestore(app);
try{
 await env.clearFirestore();
 await db.doc('usuarios/admin@teste.com').set({perfil:'administrador',ativo:true,principal:true});
 await db.doc('ferias/colaborador').set({nome:'Preservar férias',periodos:[]});
 await db.doc('cadastro/tecnicos').set({t:{TEC:{nome:'Preservar técnico'}}});
 await db.doc('config/geral').set({prazo:7});await db.doc('vinculos_tecnicos/PR--TEC').set({email:'tecnico@teste.com',tid:'TEC',regiao:'PR'});
 await db.doc('historico_ferias/evento').set({nome:'Preservar histórico de férias'});
 await db.doc('lembretes_ferias/usuario').set({email:'preservar@teste.com'});
 const usuario=env.authenticatedContext('admin',{email:'admin@teste.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 await assertSucceeds(usuario.doc('dados/parte').set({teste:true}));
 await db.doc('manutencao/limpeza-pecas').set({operacao:'pecas-reinicio-2026-10-20'});
 await assertFails(usuario.doc('dados/parte').set({teste:false}));
 await assertSucceeds(usuario.doc('ferias/colaborador').get());
 await db.doc('manutencao/limpeza-pecas').delete();
 await db.doc('dados/indice').set({versao:12,arquivos:{'usadas:PR':{gen:'antiga',partes:1}},anterior:{arquivo:'antigo'}});
 await db.doc('dados/u-PR-antiga-0').set({itens:[{cp_lista:['peca-antiga']}]});await db.doc('dados/catalogo').set({m:{M:'Material antigo'}});
 await db.doc('resumo/atual').set({estoque:{totalNovas:99}});
 for(const c of COLECOES_PECAS)await db.doc(`${c}/antigo`).set({antigo:true});
 // Pais ausentes também devem ser limpos, incluindo os saldos publicados e declarações.
 await db.doc('saldos_tecnicos/PR--TEC/geracoes/antiga/pecas/P').set({quantidade:99});
 await db.doc('declaracoes_tecnicos/PR--TEC/itens/P').set({quantidadeDevolver:99});
 const publicacoes=[];
 const args={db,source,regras:{releaseFirestoreRulesetFromSource:async s=>publicacoes.push(s)},esperar:async ms=>assert.equal(ms,70000)};
 const resultado=await limparPecasUmaVez(args);
 assert.equal(resultado.cadastrosPreservados,true);assert.equal(publicacoes[0],bloqueadas);assert.equal(publicacoes.at(-1),source);
 assert.equal((await db.doc('manutencao/limpeza-pecas').get()).exists,false);
 for(const c of COLECOES_PECAS)assert.equal((await db.collection(c).get()).size,0);
 assert.equal((await db.doc('saldos_tecnicos/PR--TEC/geracoes/antiga/pecas/P').get()).exists,false);
 assert.equal((await db.doc('declaracoes_tecnicos/PR--TEC/itens/P').get()).exists,false);
 const indice=(await db.doc('dados/indice').get()).data();assert.equal(indice.versao,14);assert.deepEqual(indice.arquivos,{});assert.deepEqual(indice.anterior,{});
 assert.equal((await db.doc('portal/controle').get()).data().versao,14);
 assert.deepEqual((await db.doc('dados/catalogo').get()).data(),{m:{}});
 assert.equal((await db.doc('resumo/atual').get()).data().estoque.totalNovas,0);
 assert.equal((await db.doc('cadastro/tecnicos').get()).data().t.TEC.nome,'Preservar técnico');
 assert.equal((await db.doc('ferias/colaborador').get()).data().nome,'Preservar férias');
 assert.equal((await db.doc('usuarios/admin@teste.com').get()).data().principal,true);
 assert.equal((await db.doc('lembretes_ferias/usuario').get()).exists,true);
 // Uma nova importação nunca é apagada por outra publicação ou reexecução.
 await db.doc('dados/n-PR-nova-0').set({itens:['nova-importacao']});
 const repetida=await limparPecasUmaVez(args);assert.equal(repetida.jaConcluida,true);
 assert.equal((await db.doc('dados/n-PR-nova-0').get()).exists,true);
 assert.equal((await db.doc('dados/indice').get()).data().versao,14);
 console.log('Limpeza real no emulador: trava de escrita, leitura preservada, exclusão recursiva, cadastros/férias/acessos intactos, saldos zerados e execução única passaram.');
}finally{await deleteApp(app);await env.cleanup();}
