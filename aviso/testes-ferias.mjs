import {randomUUID} from 'node:crypto';
import {emailLembreteValido} from './lembretes-ferias.mjs';
// Apenas o servidor define os resultados. Pedidos são reservados antes do SMTP e
// resultados incertos não voltam à fila automaticamente.
export async function processarTestesFerias({db,transporte,remetente},habilitado){
 const pedidos=await db.collection('testes_lembretes_ferias').get();
 const contagem={enviados:0,falhas:0,indisponiveis:0};
 for(const s of pedidos.docs){
  const ref=db.doc(`testes_lembretes_ferias/${s.id}`);
  const reserva=await db.runTransaction(async tx=>{
   const atual=await tx.get(ref),d=atual.data();
   if(!d||d.estado||d.uid!==s.id)return null;
   const inscricao=(await tx.get(db.doc(`lembretes_ferias/${s.id}`))).data();
   const perfil=inscricao?.titular?(await tx.get(db.doc(`usuarios/${inscricao.titular}`))).data():null;
   const valido=inscricao?.uid===s.id && emailLembreteValido(inscricao.email) && perfil?.ativo && ['usuario','administrador'].includes(perfil.perfil);
   const estado=!valido?'falhou':!habilitado?'indisponivel':'em_envio';
   tx.set(ref,{...d,estado,atualizadoEm:new Date().toISOString()});
   return {...d,email:inscricao?.email?.toLowerCase(),estado};
  });
  if(!reserva)continue;
  if(reserva.estado!=='em_envio'){contagem[reserva.estado==='indisponivel'?'indisponiveis':'falhas']++;continue;}
  let estado='incerto';
  try{
   const info=await transporte.sendMail({from:{name:'Férias da equipe',address:remetente},to:{address:reserva.email},subject:'Teste dos lembretes de férias — Positivo',text:'Este é o e-mail de teste solicitado no painel Férias da equipe. O remetente está funcionando. Os lembretes automáticos seguem o horário de Brasília e a antecedência escolhidos na sua inscrição. Você pode alterar ou desativar a inscrição em Férias da equipe → Lembretes por e-mail. Este teste não altera os lembretes programados.',messageId:`<teste-ferias-${reserva.pedido}@${remetente.split('@')[1]}>`});
   if(!info.accepted?.some(e=>String(e).toLowerCase()===reserva.email))throw Object.assign(new Error('Recusado'),{code:'EENVELOPE'});
   estado='enviado';
  }catch(e){if(['EAUTH','EENVELOPE','EMESSAGE'].includes(e.code)||Number(e.responseCode)>=400)estado='falhou';}
  // Falha de gravação depois de SMTP deixa em_envio: nunca repetir automaticamente.
  await db.runTransaction(async tx=>{
   const atual=(await tx.get(ref)).data();
   if(atual?.pedido===reserva.pedido)tx.set(ref,{uid:reserva.uid,pedido:reserva.pedido,solicitadoEm:reserva.solicitadoEm,estado,atualizadoEm:new Date().toISOString()});
  });
  contagem[estado==='enviado'?'enviados':'falhas']++;
 }
 return contagem;
}
// Pedido único desta solicitação do proprietário; nunca percorre endereços de
// terceiros. Só usa a inscrição vinculada à conta principal já cadastrada.
export async function solicitarTesteProprietario(db){
 const operacao=db.doc('operacoes_lembretes_ferias/teste-proprietario-2026-10-20');
 const titular=(await db.doc('seguranca/controle').get()).data()?.administradorPrincipal;
 if(!titular)return false;
 const inscricoes=await db.collection('lembretes_ferias').where('titular','==',titular).get();
 const s=inscricoes.docs.find(s=>s.data().uid===s.id&&emailLembreteValido(s.data().email));
 if(!s)return false;
 return db.runTransaction(async tx=>{
  if((await tx.get(operacao)).exists)return true;
  const ref=db.doc(`testes_lembretes_ferias/${s.id}`),ant=(await tx.get(ref)).data();
  if(ant&&['em_envio','incerto'].includes(ant.estado))return false;
  tx.set(ref,{uid:s.id,pedido:randomUUID(),solicitadoEm:new Date(),origem:'pedido-proprietario'});
  tx.set(operacao,{criadoEm:new Date().toISOString()});return true;
 });
}
