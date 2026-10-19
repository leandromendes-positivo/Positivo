// Migração administrativa temporária. Não publica dados nem a planilha no site.
import {readFile,writeFile} from 'node:fs/promises';
import {privateDecrypt,constants,createDecipheriv,createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
const conta=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if(conta.project_id!=='controle-pecas-positivo')throw new Error('Projeto incorreto.');
const pacote=JSON.parse(await readFile(new URL('./cadastro-ferias.enc.json',import.meta.url),'utf8'));
const chave=privateDecrypt({key:conta.private_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(pacote.chave,'base64'));
const bytes=Buffer.from(pacote.dados,'base64');
const dec=createDecipheriv('aes-256-gcm',chave,Buffer.from(pacote.iv,'base64'));
dec.setAuthTag(bytes.subarray(-16));
const lista=JSON.parse(Buffer.concat([dec.update(bytes.subarray(0,-16)),dec.final()]).toString('utf8'));
if(lista.length!==26||lista.reduce((s,f)=>s+f.periodos.length,0)!==33)throw new Error('Contagem de origem incorreta.');
const dia=s=>Date.parse(s+'T00:00:00Z');
for(const f of lista){
 if(!f.nome||!/^\d+$/.test(f.matricula)||!f.ciclo||f.status!=='planejado')throw new Error('Cadastro de origem inválido.');
 const total=f.periodos.reduce((s,p)=>s+(dia(p.fim)-dia(p.inicio))/86400000+1,0);
 if(!Number.isInteger(total)||total+f.vendidos!==f.direito)throw new Error('Contagem de dias de origem inválida.');
 for(const p of f.periodos)if(!/^\d{4}-\d{2}-\d{2}$/.test(p.inicio)||!/^\d{4}-\d{2}-\d{2}$/.test(p.fim)||p.inicio>p.fim)throw new Error('Datas de origem inválidas.');
}
const db=getFirestore(initializeApp({credential:cert(conta),projectId:conta.project_id}));
let criados=0,preservados=0;
const conferir=[];
for(const f of lista){
 const id='import-'+createHash('sha256').update(`${f.matricula}|${f.ciclo}`).digest('hex');
 const ref=db.doc(`ferias/${id}`);
 const resultado=await db.runTransaction(async tx=>{
  const existentes=await tx.get(db.collection('ferias').where('matricula','==',f.matricula));
  const anterior=existentes.docs.find(s=>s.data().ciclo===f.ciclo);
  if(anterior)return {criado:false,ref:anterior.ref};
  const atual=await tx.get(ref);
  if(atual.exists)throw new Error('Identificador ocupado por cadastro diferente; migração interrompida.');
  const evento=randomUUID(),d={...f,id,evento,versao:1,atualizadoEm:FieldValue.serverTimestamp(),atualizadoPor:{uid:'carga-inicial-ferias',email:conta.client_email}};
  tx.create(ref,d);tx.create(db.doc(`historico_ferias/${evento}`),d);
  return {criado:true,ref};
 });
 if(resultado.criado)criados++;else preservados++;
 conferir.push({...resultado,origem:f});
}
let verificados=0;
for(const {ref,origem,criado} of conferir){
 const snap=await ref.get();if(!snap.exists)throw new Error('Cadastro não encontrado na conferência.');
 const d=snap.data();if(d.matricula!==origem.matricula||d.ciclo!==origem.ciclo)throw new Error('Cadastro divergente na conferência.');
 if(criado){for(const [k,v]of Object.entries(origem))if(!isDeepStrictEqual(d[k],v))throw new Error('Dados divergentes na conferência.');
  const h=await db.doc(`historico_ferias/${d.evento}`).get();if(!h.exists)throw new Error('Histórico não encontrado na conferência.');}
 verificados++;
}
const recibo={projeto:conta.project_id,criados,preservados,verificados,periodosNaOrigem:33,concluidoEm:new Date().toISOString(),execucao:process.env.GITHUB_RUN_ID||'local'};
await writeFile(new URL('./cadastro-ferias.resultado.json',import.meta.url),JSON.stringify(recibo,null,2)+'\n');
console.log(JSON.stringify(recibo));
await db.terminate();
