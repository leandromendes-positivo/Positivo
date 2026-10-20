// Firestore REST: compatível com Workers; não depende de gRPC/firebase-admin.
const b64=s=>Buffer.from(s).toString('base64url');
export function codificar(v){
 if(v===null)return {nullValue:null};if(v instanceof Date)return {timestampValue:v.toISOString()};
 if(Array.isArray(v))return {arrayValue:{values:v.map(codificar)}};
 if(typeof v==='object')return {mapValue:{fields:campos(v)}};
 if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
 if(typeof v==='string')return {stringValue:v};throw new Error('Valor Firestore não suportado');
}
const campos=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,codificar(v)]));
export function decodificar(v){
 if('nullValue'in v)return null;if('mapValue'in v)return lerCampos(v.mapValue.fields||{});
 if('timestampValue'in v)return new Date(v.timestampValue);
 if('arrayValue'in v)return (v.arrayValue.values||[]).map(decodificar);
 if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
 return v.stringValue??v.booleanValue??v.timestampValue;
}
const lerCampos=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,decodificar(v)]));
export async function tokenServico(cred,fetcher=fetch){
 const agora=Math.floor(Date.now()/1000),cab=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const corpo=b64(JSON.stringify({iss:cred.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:agora,exp:agora+3600}));
 const der=Buffer.from(cred.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,''),'base64');
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const assinatura=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(cab+'.'+corpo));
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:cab+'.'+corpo+'.'+b64(assinatura)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Autenticação do serviço indisponível');const d=await r.json();if(!d.access_token)throw new Error('Token de serviço indisponível');return d.access_token;
}
export function firestoreREST(projeto,token,fetcher=fetch){
 const raiz=`projects/${projeto}/databases/(default)/documents`,base=`https://firestore.googleapis.com/v1/${raiz}`;
 async function pedir(sufixo,body,metodo='POST'){
  const r=await fetcher(base+sufixo,{method:metodo,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(r.status===404)return null;
  if(!r.ok){const e=new Error('Falha de acesso ao banco');e.status=r.status;throw e;}
  return r.json();
 }
 const snapshot=(p,d)=>({id:p.split('/').at(-1),exists:!!d,data:()=>d?lerCampos(d.fields||{}):undefined});
 const nome=p=>raiz+'/'+p;
 const write=(r,d,merge=false,update=false)=>({update:{name:nome(r.path),fields:campos(d)},...(merge||update?{updateMask:{fieldPaths:Object.keys(d)}}:{}),...(update?{currentDocument:{exists:true}}:{})});
 const doc=p=>{
  if(!p||p.split('/').length%2!==0||p.split('/').some(s=>!s))throw new Error('Caminho inválido');
  const r={path:p,id:p.split('/').at(-1)};
  r.get=async()=>snapshot(p,await pedir('/'+p.split('/').map(encodeURIComponent).join('/'),undefined,'GET'));
  r.set=(d,op={})=>pedir(':commit',{writes:[write(r,d,op.merge)]});return r;
 };
 const getAll=async(refs,transaction)=>{
  if(!refs.length)return [];
  const resposta=await pedir(':batchGet',{documents:refs.map(r=>nome(r.path)),...(transaction?{transaction}:{})});
  const mapa=new Map(resposta.map(r=>[r.found?.name||r.missing,r.found||null]));
  return refs.map(r=>snapshot(r.path,mapa.get(nome(r.path))||null));
 };
 const db={doc,getAll:(...refs)=>getAll(refs),revisaoFerias:async()=>{
  const [ultimo,contagem]=await Promise.all([
   pedir(':runQuery',{structuredQuery:{from:[{collectionId:'ferias'}],select:{fields:[{fieldPath:'atualizadoEm'}]},orderBy:[{field:{fieldPath:'atualizadoEm'},direction:'DESCENDING'}],limit:1}}),
   pedir(':runAggregationQuery',{structuredAggregationQuery:{structuredQuery:{from:[{collectionId:'ferias'}]},aggregations:[{alias:'quantidade',count:{}}]}})
  ]);
  const quantidade=contagem.find(r=>r.result)?.result.aggregateFields?.quantidade?.integerValue;
  if(quantidade===undefined)throw new Error('Revisão de férias indisponível');
  const d=ultimo.find(r=>r.document)?.document;
  return [String(quantidade),d?.name||'',d?.updateTime||''].join('|');
 },collection:p=>{
  if(!/^[a-z_]+$/.test(p))throw new Error('Coleção inválida');
  const consulta=filtros=>({where:(field,op,value)=>{if(op!=='==')throw new Error('Operador inválido');return consulta([...filtros,{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:codificar(value)}}]);},get:async()=>{
   const r=await pedir(':runQuery',{structuredQuery:{from:[{collectionId:p}],...(filtros.length?{where:filtros.length===1?filtros[0]:{compositeFilter:{op:'AND',filters:filtros}}}:{})}});
   return {docs:r.filter(x=>x.document).map(x=>snapshot(x.document.name.split('/documents/')[1],x.document))};
  }});return consulta([]);
 },batch:()=>{
  const writes=[];return {update:(r,d)=>writes.push(write(r,d,true,true)),commit:()=>pedir(':commit',{writes})};
 },runTransaction:async fn=>{
  for(let tentativa=0;tentativa<4;tentativa++){
   const {transaction}=await pedir(':beginTransaction',{}),writes=[];
   const tx={getAll:(...refs)=>getAll(refs,transaction),get:async r=>{
    const res=await pedir(':batchGet',{documents:[nome(r.path)],transaction});
    return snapshot(r.path,res[0]?.found||null);
   },set:(r,d)=>writes.push(write(r,d))};
   try{const resultado=await fn(tx);await pedir(':commit',{transaction,writes});return resultado;}
   catch(e){try{await pedir(':rollback',{transaction});}catch{}if(e.status!==409||tentativa===3)throw e;}
  }
 }};return db;
}
