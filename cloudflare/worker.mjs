import {firestoreREST,tokenServico} from './firestore.mjs';
import {transporteEmail} from './email.mjs';
import {processarTestesFerias} from '../aviso/testes-ferias.mjs';
import {processarLembretes} from '../aviso/lembretes-ferias.mjs';
export function origemPermitida(req,env){
 try{return new URL(env.PAINEL_URL).origin===req.headers.get('Origin')&&new URL(env.PAINEL_URL).protocol==='https:';}catch{return false;}
}
export async function autenticar(req,env,db,fetcher=fetch){
 const bearer=req.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]{1,10000}$/.test(bearer))throw new Error('Não autorizado');
 const idToken=bearer.slice(7);
 const r=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('Não autorizado');
 const u=(await r.json()).users?.[0];
 // A API verifica assinatura/expiração; as claims só são lidas após essa validação.
 const claims=JSON.parse(Buffer.from(idToken.split('.')[1],'base64url').toString());
 if(!u?.localId||u.disabled||!u.emailVerified||claims.sub!==u.localId||claims.aud!==env.FIREBASE_PROJECT_ID||claims.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`||!Number.isFinite(claims.auth_time)||claims.auth_time<Number(u.validSince||0))throw new Error('Não autorizado');
 const email=u.email?.toLowerCase();if(!email||email.includes('/'))throw new Error('Não autorizado');
 const conexao=typeof db==='function'?await db():db;
 const perfil=(await conexao.doc('usuarios/'+email).get()).data();
 if(!perfil?.ativo||!['usuario','administrador'].includes(perfil.perfil))throw new Error('Não autorizado');
 return {uid:u.localId,email};
}
export function limitarTeste(db,uid){
 return {...db,collection:p=>p==='testes_lembretes_ferias'?{get:async()=>{
  const s=await db.doc(p+'/'+uid).get();return {docs:s.exists?[s]:[]};
 }}:db.collection(p)};
}
async function abrir(env){
 const cred=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||'null');
 if(!cred||cred.project_id!==env.FIREBASE_PROJECT_ID)throw new Error('Projeto inválido');
 return {db:firestoreREST(env.FIREBASE_PROJECT_ID,await tokenServico(cred)),transporte:transporteEmail(env),remetente:env.EMAIL_REMETENTE};
}
async function disponivel(env,servico){
 if(env.ATIVAR_SERVICO!=='true')throw new Error('Serviço não ativado');
 const painel=new URL(env.PAINEL_URL),worker=new URL(env.WORKER_URL);
 if(painel.protocol!=='https:'||worker.protocol!=='https:'||worker.pathname!=='/'||worker.search||worker.hash)throw new Error('URL inválida');
 await servico.transporte.verify();
 await servico.db.doc('servicos/lembretes-ferias').set({executor:'cloudflare',endpointTeste:worker.origin+'/testar',habilitado:true,motivo:'disponivel',verificadoEm:new Date().toISOString()},{merge:true});
}
export default {
 async fetch(req,env,ctx){
  if(!origemPermitida(req,env))return new Response(null,{status:403});
  const headers={'Access-Control-Allow-Origin':new URL(env.PAINEL_URL).origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  if(new URL(req.url).pathname!=='/testar')return new Response(null,{status:404,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return new Response(null,{status:405,headers});
  if(env.ATIVAR_SERVICO!=='true')return Response.json({erro:'Serviço ainda não ativado'},{status:503,headers});
  // O endpoint não aceita destinatário nem UID no corpo. Usa somente o pedido
  // que as regras do Firestore já autorizaram para a própria conta.
  let servico,identidade;
  try{identidade=await autenticar(req,env,async()=>{servico=await abrir(env);return servico.db;});}catch{return Response.json({erro:'Acesso não autorizado ou serviço indisponível'},{status:403,headers});}
  const processamento=(async()=>{
  try{
   const assinatura=(await servico.db.doc('lembretes_ferias/'+identidade.uid).get()).data();
   if(assinatura?.titular!==identidade.email||assinatura.uid!==identidade.uid)return Response.json({erro:'Salve sua inscrição antes de testar'},{status:403,headers});
   await servico.transporte.verify();
   const resultado=await processarTestesFerias({...servico,db:limitarTeste(servico.db,identidade.uid)},true);
   return Response.json({processado:true,enviados:resultado.enviados},{headers});
  }catch{return Response.json({erro:'Não foi possível confirmar o envio. Consulte o status no painel.'},{status:503,headers});}
  })();
  ctx?.waitUntil(processamento);return processamento;
 },
 async scheduled(_evento,env){
  if(env.ATIVAR_SERVICO!=='true')return;
  let servico;
  try{
  servico=await abrir(env);
  await disponivel(env,servico);
  await processarTestesFerias(servico,true);
  const resultado=await processarLembretes({...servico,painel:env.PAINEL_URL.replace(/\/$/,'')+'/'});
  await servico.db.doc('servicos/lembretes-ferias').set({ultimoProcessamento:new Date().toISOString(),ultimaExecucaoSemFalhas:!resultado.falhas&&!resultado.pendentes},{merge:true});
  }catch{
   if(servico)try{await servico.db.doc('servicos/lembretes-ferias').set({habilitado:false,ultimaExecucaoSemFalhas:false,motivo:'falha_cloudflare',verificadoEm:new Date().toISOString()},{merge:true});}catch{}
   throw new Error('Serviço Cloudflare indisponível. Confira a configuração e os registros privados de envio.');
  }
 }
};
