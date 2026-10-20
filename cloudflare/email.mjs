import {emailLembreteValido} from '../aviso/lembretes-ferias.mjs';
export function transporteEmail(env,fetcher=fetch){
 const remetente=env.EMAIL_REMETENTE;
 if(!emailLembreteValido(remetente))throw new Error('Remetente inválido');
 let gmailToken;
 async function requisitar(url,init){
  const r=await fetcher(url,{...init,signal:AbortSignal.timeout(15000)});
  if(!r.ok){const e=new Error('Resposta do provedor não confirmada');if(r.status>=400&&r.status<500&&r.status!==408)e.responseCode=r.status;else e.code='ESOCKET';throw e;}return r.json();
 }
 const verify=async()=>{
  if(env.EMAIL_PROVEDOR==='resend'){
   if(!env.RESEND_API_KEY)throw new Error('Falta configuração do provedor');return;
  }
  if(env.EMAIL_PROVEDOR!=='gmail'||!env.GMAIL_CLIENT_ID||!env.GMAIL_CLIENT_SECRET||!env.GMAIL_REFRESH_TOKEN)throw new Error('Falta configuração Gmail OAuth');
  const d=await requisitar('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'})});
  if(!d.access_token)throw new Error('Token Gmail indisponível');gmailToken=d.access_token;
 };
 return {verify,sendMail:async m=>{
  const destino=m.to?.address;if(!emailLembreteValido(destino))throw Object.assign(new Error('Destinatário inválido'),{code:'EENVELOPE'});
  if(env.EMAIL_PROVEDOR==='resend'){
   const resposta=await requisitar('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':m.messageId},body:JSON.stringify({from:remetente,to:[destino],subject:m.subject,text:m.text,...(m.html?{html:m.html}:{})})});
   if(!resposta.id)throw new Error('Aceite não confirmado');
  }else{
   if(!gmailToken)await verify();
   const base64=s=>Buffer.from(s,'utf8').toString('base64');
   const limite='ferias-'+crypto.randomUUID();
   const partes=[['text/plain',m.text||''],...(m.html?[['text/html',m.html]]:[])].map(([tipo,texto])=>`--${limite}\r\nContent-Type: ${tipo}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(texto).match(/.{1,76}/g)?.join('\r\n')||''}`);
   const raw=[`From: ${remetente}`,`To: ${destino}`,`Subject: =?UTF-8?B?${base64(m.subject)}?=`,`Message-ID: ${m.messageId}`,'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${limite}"`,'',...partes,`--${limite}--`,''].join('\r\n');
   const resposta=await requisitar('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+gmailToken,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw).toString('base64url')})});
   if(!resposta.id)throw new Error('Aceite não confirmado');
  }
  return {accepted:[destino]};
 }};
}
