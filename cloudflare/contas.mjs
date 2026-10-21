import {randomBytes,createHash} from 'node:crypto';
import {escaparEmail} from '../aviso/layout-email-ferias.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const emailValido=s=>typeof s==='string'&&s.length<=254&&/^[a-z0-9.!#$%&'*+\-=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(s)&&!s.includes('/');
const falha=(mensagem='Não foi possível concluir esta solicitação.',status=400)=>Object.assign(new Error(mensagem),{status,publica:true});
export function senhaValida(s){return typeof s==='string'&&s.length>=12&&s.length<=128&&/\S/.test(s)&&!/[\u0000-\u001f\u007f]/.test(s);}
export function authAdministrativa(projeto,token,fetcher=fetch){
 const base=`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projeto)}`;
 async function chamar(caminho,body){
  const r=await fetcher(base+caminho,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw falha('O serviço de contas precisa ser conferido pelo administrador. Verifique as permissões Firebase Authentication da conta de serviço.',503);
  return r.json();
 }
 return {verificar:async()=>{
  const r=await fetcher(`https://identitytoolkit.googleapis.com/v2/projects/${encodeURIComponent(projeto)}/config`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw falha('O serviço de contas precisa da permissão Firebase Authentication Admin na conta de serviço.',503);
  const d=await r.json();if(d.signIn?.email?.enabled!==true)throw falha('Habilite o provedor E-mail/senha no Firebase antes de gerar acessos.',503);
 },buscar:async email=>(await chamar('/accounts:lookup',{email:[email]})).users?.[0]||null,criar:d=>chamar('/accounts',d),atualizar:d=>chamar('/accounts:update',d)};
}
export async function identidadeConta(req,env,db,fetcher=fetch){
 const bearer=req.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]{1,10000}$/.test(bearer))throw falha('Entre novamente para continuar.',401);
 const idToken=bearer.slice(7),r=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw falha('Entre novamente para continuar.',401);
 const u=(await r.json()).users?.[0];let c;
 try{c=JSON.parse(Buffer.from(idToken.split('.')[1],'base64url'));}catch{throw falha('Entre novamente para continuar.',401);}
 const email=u?.email?.toLowerCase();
 if(!u?.localId||u.disabled||!emailValido(email)||c.sub!==u.localId||c.aud!==env.FIREBASE_PROJECT_ID||c.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`||!Number.isFinite(c.auth_time)||c.auth_time<Number(u.validSince||0)||!['google.com','microsoft.com','password'].includes(c.firebase?.sign_in_provider))throw falha('Entre novamente para continuar.',401);
 const p=(await db.doc('usuarios/'+email).get()).data();
 if(!p?.ativo||!['administrador','usuario','tecnico'].includes(p.perfil))throw falha('Este acesso não está ativo.',403);
 return {uid:u.localId,email,claims:c,usuario:u,perfil:p};
}
export async function credencialLiberada(db,id){
 if(!['google.com','microsoft.com','password'].includes(id.claims.firebase?.sign_in_provider))return false;
 const d=(await db.doc('credenciais_usuarios/'+id.email).get()).data();
 if(!d)return id.claims.firebase?.sign_in_provider!=='password'&&id.usuario.emailVerified===true;
 return d.uid===id.uid&&d.exigirTroca===false&&d.estado==='ativo'&&id.usuario.emailVerified===true&&id.claims.cpSenha===d.versao&&id.claims.auth_time>=d.liberadoApartir;
}
export async function limitarContas(db,chave,maximo,janela,agora=Date.now()){
 const ref=db.doc('limites_contas/'+hash(chave));
 await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data(),inicio=d?.inicio>agora-janela?d.inicio:agora,n=inicio===d?.inicio?d.quantidade:0;if(n>=maximo)throw falha('Aguarde alguns minutos antes de tentar novamente.',429);tx.set(ref,{inicio,quantidade:n+1});});
}
async function enviar(servico,email,assunto,texto,html){
 const info=await servico.transporte.sendMail({from:{name:'Acesso ao painel Positivo',address:servico.remetente},to:{address:email},subject:assunto,text:texto,html,messageId:`<conta-${randomBytes(16).toString('hex')}@${servico.remetente.split('@')[1]}>`});
 if(!info.accepted?.some(e=>String(e).toLowerCase()===email))throw falha('O provedor não confirmou o envio. Tente gerar um novo acesso mais tarde.',503);
}
const origemPainel=env=>{const u=new URL(env.PAINEL_URL);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Painel inválido');u.hash='';u.search='';return u.href;};
export async function gerarTemporaria(servico,id,email,operacao,agora=Date.now()){
 const {db,authAdmin}=servico;
 if(id.perfil.perfil!=='administrador'||!await credencialLiberada(db,id))throw falha('Apenas administradores podem gerar acessos.',403);
 if(agora/1000-id.claims.auth_time>900)throw falha('Confirme sua identidade novamente antes de gerar uma senha.',401);
 if(!emailValido(email)||email===id.email)throw falha('Selecione outro cadastro ativo.',400);
 const ref=db.doc('credenciais_usuarios/'+email);
 await limitarContas(db,'admin:'+id.uid,15,15*60000,agora);
 await authAdmin.verificar?.();
 try{await servico.transporte.verify?.();}catch{throw falha('O remetente Gmail não conseguiu autenticar. Confira as credenciais de envio no Cloudflare.',503);}
 const conta=await authAdmin.buscar(email);
 const reserva=await db.runTransaction(async tx=>{
  const [alvo,estado,autor]=await Promise.all([tx.get(db.doc('usuarios/'+email)),tx.get(ref),tx.get(db.doc('usuarios/'+id.email))]);
  const p=alvo.data(),d=estado.data();
  if(!autor.data()?.ativo||autor.data()?.perfil!=='administrador'||!p?.ativo||p.principal)throw falha('Este cadastro não pode receber uma senha temporária por esta ação.',403);
  if(d?.operacao===operacao)return {repetida:true,estado:d.estado,emailEnviado:d.emailEnviado===true};
  if(d?.bloqueioAte>agora)throw falha('Há uma operação em andamento. Aguarde alguns minutos.',409);
  const versao=(d?.versao||0)+1;
  tx.set(ref,{uid:conta?.localId||'',versao,exigirTroca:true,estado:'preparando',operacao,bloqueioAte:agora+5*60000,expiraEm:agora+24*3600000,emailEnviado:false,liberadoApartir:Math.floor(agora/1000)+1});
  return {versao,nome:p.nome||''};
 });
 if(reserva.repetida){if(reserva.estado==='temporaria'&&reserva.emailEnviado)return {enviado:true};throw falha('A operação anterior não foi confirmada. Gere outra senha temporária.',409);}
 const senha='Aa7!'+randomBytes(18).toString('base64url'),claims=JSON.parse(conta?.customAttributes||'{}');claims.cpSenha=reserva.versao;
 let uid=conta?.localId;
 try{
  if(uid)await authAdmin.atualizar({localId:uid,password:senha,validSince:String(Math.floor(agora/1000)),customAttributes:JSON.stringify(claims)});
  else {uid=(await authAdmin.criar({email,password:senha,emailVerified:false})).localId;await authAdmin.atualizar({localId:uid,customAttributes:JSON.stringify(claims)});}
  await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.operacao!==operacao)throw falha('A operação mudou. Gere outra senha.',409);tx.set(ref,{...d,uid,hashTemporaria:hash(senha),estado:'temporaria',bloqueioAte:agora+5*60000});});
  const url=origemPainel(servico.env),texto=`${reserva.nome?'Olá, '+reserva.nome+'.\n\n':''}Seu acesso ao painel Positivo foi preparado.\nE-mail: ${email}\nSenha temporária: ${senha}\n\nEntre em ${url}\nA senha expira em 24 horas. Você deverá definir sua própria senha antes de acessar os dados. Se não reconhecer este cadastro, avise a administração.`;
  try{await enviar(servico,email,'Seu acesso ao painel Positivo',texto,`<div style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:28px;line-height:1.7"><h1 style="font-size:24px">Seu acesso ao painel</h1>${reserva.nome?`<p>Olá, ${escaparEmail(reserva.nome)}.</p>`:''}<p>E-mail: <strong>${escaparEmail(email)}</strong></p><p>Senha temporária:</p><p style="font-family:monospace;font-size:21px">${escaparEmail(senha)}</p><p>Válida por 24 horas. No primeiro acesso, você deverá criar sua própria senha.</p><p><a href="${escaparEmail(url)}">Abrir painel Positivo</a></p><p>Se não reconhecer este cadastro, avise a administração.</p></div>`);}catch{throw falha('O provedor não confirmou o envio da senha. Confira o remetente no Cloudflare e a caixa de spam antes de gerar outra senha.',503);}
  await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.operacao===operacao)tx.set(ref,{...d,bloqueioAte:0,emailEnviado:true});});
  return {enviado:true};
 }catch(e){await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.operacao===operacao)tx.set(ref,{...d,estado:d.estado==='temporaria'?'temporaria':'falha_envio',bloqueioAte:0});});throw e;}
}
async function gravarNovaSenha(servico,email,conta,senha,ref,operacao,agora){
 const d=(await ref.get()).data(),versao=(d?.versao||0)+1,liberadoApartir=Math.floor(agora/1000)+1;
 const claims=JSON.parse(conta.customAttributes||'{}');claims.cpSenha=versao;
 await servico.authAdmin.atualizar({localId:conta.localId,password:senha,emailVerified:true,validSince:String(liberadoApartir),customAttributes:JSON.stringify(claims)});
 await servico.db.runTransaction(async tx=>{const atual=(await tx.get(ref)).data();if(atual?.operacao!==operacao)throw falha('O acesso mudou. Solicite uma nova recuperação.',409);tx.set(ref,{uid:conta.localId,versao,exigirTroca:false,estado:'ativo',liberadoApartir,expiraEm:0,bloqueioAte:0,operacao,hashTemporaria:'',alteradoEm:agora});});
 return {alterada:true,liberadoApartir};
}
export async function trocarTemporaria(servico,id,senha,agora=Date.now()){
 if(!senhaValida(senha))throw falha('Use uma senha de 12 a 128 caracteres.');
 await servico.authAdmin.verificar?.();
 const {db}=servico,ref=db.doc('credenciais_usuarios/'+id.email),operacao=randomBytes(16).toString('hex');
 const conta=await servico.authAdmin.buscar(id.email);
 await db.runTransaction(async tx=>{
  const [s,p]=await Promise.all([tx.get(ref),tx.get(db.doc('usuarios/'+id.email))]);const d=s.data();
  if(!p.data()?.ativo||!d||d.uid!==id.uid||conta?.localId!==id.uid||id.claims.firebase.sign_in_provider!=='password'||!d.exigirTroca||d.estado!=='temporaria'||d.expiraEm<agora||d.bloqueioAte>agora||d.versao!==id.claims.cpSenha)throw falha('A senha temporária expirou ou foi substituída. Solicite outra.',403);
  if(hash(senha)===d.hashTemporaria)throw falha('Escolha uma senha diferente da temporária.');
  tx.set(ref,{...d,operacao,bloqueioAte:agora+5*60000});
 });
 return gravarNovaSenha(servico,id.email,conta,senha,ref,operacao,agora);
}
export async function recuperarSenha(servico,email,ip,agora=Date.now()){
 const generica={mensagem:'Se o endereço tiver acesso ativo, enviaremos as instruções. Confira também o spam.'};
 try{
  await limitarContas(servico.db,'recuperar-ip:'+ip,8,15*60000,agora);
  if(!emailValido(email))return generica;
  await limitarContas(servico.db,'recuperar-email:'+email,3,15*60000,agora);
  const p=(await servico.db.doc('usuarios/'+email).get()).data();if(!p?.ativo)return generica;
  const conta=await servico.authAdmin.buscar(email);if(!conta||conta.disabled)return generica;
  const token=randomBytes(32).toString('base64url');
  const ref=servico.db.doc('recuperacoes_senha/'+hash(token)),geracao=randomBytes(16).toString('hex');
  await servico.db.runTransaction(async tx=>{
   const d=(await tx.get(servico.db.doc('credenciais_usuarios/'+email))).data();
   tx.set(ref,{email,uid:conta.localId,expiraEm:agora+15*60000,usado:false,geracao,versaoBase:d?.versao||0});
   tx.set(servico.db.doc('pedidos_recuperacao/'+hash(email)),{geracao});
  });
  const url=origemPainel(servico.env)+'#redefinir-senha='+token;
  await enviar(servico,email,'Redefinir sua senha — Positivo',`Abra este link para definir uma nova senha: ${url}\nO link expira em 15 minutos e só pode ser usado uma vez. Se não solicitou, ignore: sua senha atual continua válida.`,`<div style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:28px;line-height:1.7"><h1 style="font-size:24px">Redefinir sua senha</h1><p>Você solicitou a recuperação do acesso ao painel Positivo.</p><p><a href="${escaparEmail(url)}">Definir nova senha</a></p><p>O link vale por 15 minutos e só pode ser usado uma vez.</p><p>Se não solicitou, ignore esta mensagem. Sua senha atual continua válida.</p></div>`);
 }catch{/* Resposta uniforme: não revela contas, limites individuais ou falhas do provedor. */}
 return generica;
}
export async function concluirRecuperacao(servico,token,senha,ip,agora=Date.now()){
 if(!senhaValida(senha)||typeof token!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(token))throw falha('Link inválido ou senha fora do padrão.');
 await limitarContas(servico.db,'concluir-ip:'+ip,12,15*60000,agora);
 const refToken=servico.db.doc('recuperacoes_senha/'+hash(token)),inicial=(await refToken.get()).data();
 if(!inicial||inicial.usado||inicial.expiraEm<agora)throw falha('O link expirou ou já foi usado. Solicite outro.');
 await servico.authAdmin.verificar?.();
 const conta=await servico.authAdmin.buscar(inicial.email),ref=servico.db.doc('credenciais_usuarios/'+inicial.email),operacao=randomBytes(16).toString('hex');
 await servico.db.runTransaction(async tx=>{
  const [t,p,s,pedido]=await Promise.all([tx.get(refToken),tx.get(servico.db.doc('usuarios/'+inicial.email)),tx.get(ref),tx.get(servico.db.doc('pedidos_recuperacao/'+hash(inicial.email)))]);const d=t.data(),estado=s.data();
  if(!d||d.usado||d.expiraEm<agora||!p.data()?.ativo||!conta||conta.disabled||conta.localId!==d.uid||estado?.bloqueioAte>agora||pedido.data()?.geracao!==d.geracao||(estado?.versao||0)!==d.versaoBase)throw falha('O link expirou ou o acesso mudou. Solicite outro.');
  tx.set(refToken,{...d,usado:true,usadoEm:agora});
  tx.set(ref,{...(estado||{}),uid:conta.localId,exigirTroca:true,estado:'redefinindo',operacao,bloqueioAte:agora+5*60000});
 });
 return gravarNovaSenha(servico,inicial.email,conta,senha,ref,operacao,agora);
}
export async function atenderContas(req,env,abrir,headers,ctx,fetcher=fetch){
 const caminho=new URL(req.url).pathname;
 try{
  if(req.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw falha('Envie uma solicitação válida.',415);
  if(Number(req.headers.get('Content-Length'))>4096)throw falha('Solicitação muito grande.',413);
  const reader=req.body?.getReader();let bruto='',bytes=0;
  if(reader){const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096){await reader.cancel();throw falha('Solicitação muito grande.',413);}bruto+=decoder.decode(value,{stream:true});}bruto+=decoder.decode();}
  let body;try{body=JSON.parse(bruto);}catch{throw falha('Solicitação inválida.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw falha('Solicitação inválida.');
  const s=await abrir();s.env=env;const ip=req.headers.get('CF-Connecting-IP')||'sem-ip';
  if(caminho==='/contas/recuperar'){
   const generica={mensagem:'Se o endereço tiver acesso ativo, enviaremos as instruções. Confira também o spam.'};
   const tarefa=recuperarSenha(s,String(body.email||'').trim().toLowerCase(),ip);if(ctx?.waitUntil){ctx.waitUntil(tarefa);return Response.json(generica,{headers});}return Response.json(await tarefa,{headers});
  }
  if(caminho==='/contas/redefinir')return Response.json(await concluirRecuperacao(s,body.token,body.senha,ip),{headers});
  await limitarContas(s.db,'autenticado-ip:'+ip,60,60000);
  const id=await identidadeConta(req,env,s.db,fetcher);
  if(caminho==='/contas/situacao'){
   const d=(await s.db.doc('credenciais_usuarios/'+id.email).get()).data();
   if(d?.uid===id.uid&&d.exigirTroca&&d.estado==='temporaria'&&d.expiraEm>Date.now()&&id.claims.firebase.sign_in_provider==='password'&&id.claims.cpSenha===d.versao)return Response.json({trocaObrigatoria:true,email:id.email},{headers});
   if(!await credencialLiberada(s.db,id))throw falha('Seu acesso precisa de uma nova senha temporária. Solicite a recuperação.',403);
   return Response.json({trocaObrigatoria:false},{headers});
  }
  if(caminho==='/contas/primeiro-acesso')return Response.json(await trocarTemporaria(s,id,body.senha),{headers});
  if(caminho==='/contas/temporaria'){
   if(typeof body.operacao!=='string'||!/^[-a-zA-Z0-9]{20,80}$/.test(body.operacao))throw falha('Solicitação inválida.');
   return Response.json(await gerarTemporaria(s,id,String(body.email||'').trim().toLowerCase(),body.operacao),{headers});
  }
  return Response.json({erro:'Não encontrado'},{status:404,headers});
 }catch(e){return Response.json({erro:e.publica?e.message:'O serviço de contas não está disponível. Tente novamente mais tarde.'},{status:e.publica?e.status:503,headers});}
}
