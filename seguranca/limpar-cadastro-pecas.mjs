// Complemento da limpeza autorizada: somente nomes/metadados operacionais de peças.
import {readFile} from 'node:fs/promises';
export const OPERACAO='cadastro-pecas-reinicio-2026-10-20';
export async function limparCadastroPecas(db){
 return db.runTransaction(async tx=>{
  const registro=db.doc(`operacoes_manutencao/${OPERACAO}`);
  const feito=await tx.get(registro);
  if(feito.data()?.estado==='concluida')return {jaConcluida:true,...feito.data().resultado};
  const [indice,cadastro]=await Promise.all([tx.get(db.doc('dados/indice')),tx.get(db.doc('cadastro/tecnicos'))]);
  // Nunca apaga um cadastro que já recebeu novas planilhas após o reinício.
  if(Object.keys(indice.data()?.arquivos||{}).length)throw new Error('Novas importações presentes; limpeza interrompida para preservar o novo cadastro.');
  const resultado={cadastrosOperacionaisRemovidos:Object.keys(cadastro.data()?.t||{}).length,acessosEFeriasPreservados:true};
  tx.set(db.doc('cadastro/tecnicos'),{t:{}});
  tx.set(registro,{estado:'concluida',concluidaEm:new Date().toISOString(),resultado});
  return resultado;
 });
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  if(process.env.LIMPEZA_CADASTRO_OPERACAO!==OPERACAO)throw new Error('Operação não autorizada.');
  const {initializeApp,cert}=await import('firebase-admin/app'),{getFirestore}=await import('firebase-admin/firestore');
  const cfg=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
  const cred=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'null');
  if(!cred||cred.project_id!==cfg.projectId)throw new Error('Credencial ausente ou de outro projeto.');
  const db=getFirestore(initializeApp({credential:cert(cred),projectId:cfg.projectId}));
  const controle=(await db.doc('seguranca/controle').get()).data();
  const principal=controle?.administradorPrincipal?(await db.doc(`usuarios/${controle.administradorPrincipal}`).get()).data():null;
  if(!principal?.ativo||!principal.principal||principal.perfil!=='administrador')throw new Error('Administrador principal não validado.');
  console.log(`::notice title=Cadastro operacional de peças::${JSON.stringify(await limparCadastroPecas(db))}`);
 }catch(e){
  console.error('::error title=Cadastro operacional de peças::Limpeza não concluída. Verifique a existência de novas importações e a autorização do projeto. Contas de acesso e férias não fazem parte desta operação.');process.exitCode=1;
 }
}
