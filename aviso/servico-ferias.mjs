import {readFile} from 'node:fs/promises';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
export async function abrirServicoFerias(env=process.env){
  if(!env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');
  const credencial=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),config=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
  if(credencial.project_id!==config.projectId)throw new Error('A credencial não corresponde ao projeto do painel.');
  const app=initializeApp({credential:cert(credencial),projectId:config.projectId});
  return {db:getFirestore(app),painel:env.PAINEL_URL||'https://positivo.pages.dev/',transporte:env.GMAIL_USUARIO&&env.GMAIL_SENHA_APP?nodemailer.createTransport({service:'gmail',connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,auth:{user:env.GMAIL_USUARIO,pass:env.GMAIL_SENHA_APP}}):null,remetente:env.GMAIL_USUARIO};
}
export async function verificarServicoFerias(servico){
  const atual=(await servico.db.doc('servicos/lembretes-ferias').get()).data();
  if(atual?.executor==='cloudflare')return {habilitado:!!atual.habilitado,externo:true};
  let habilitado=false,motivo='credenciais_ausentes';
  if(servico.transporte){try{await servico.transporte.verify();habilitado=true;motivo='disponivel';}catch{motivo='falha_conexao_ou_autenticacao';}}
  await servico.db.doc('servicos/lembretes-ferias').set({habilitado,motivo,verificadoEm:new Date().toISOString()},{merge:true});
  return {habilitado,motivo};
}
