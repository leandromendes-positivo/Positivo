// Diagnóstico somente de leitura. O Secret permanece no runner; não publica nomes ou peças.
import {readFile} from 'node:fs/promises';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const config=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
let credencial;
try{credencial=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'');}catch{throw new Error('Credencial do Firebase indisponível para a conferência.');}
if(credencial.project_id!==config.projectId)throw new Error('Projeto da credencial diferente do painel.');
const db=getFirestore(initializeApp({credential:cert(credencial),projectId:config.projectId}));
const [indiceSnap,importacoes,cadastroSnap]=await Promise.all([
 db.doc('dados/indice').get(),db.collection('importacoes').orderBy('em','desc').limit(40).get(),db.doc('cadastro/tecnicos').get()
]);
const indice=indiceSnap.data()||{},cadastro=cadastroSnap.data()?.t||{};
const dia=process.env.RECUPERACAO_DIA||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const avisar=d=>console.log('::notice title=Conferencia de recuperacao::'+JSON.stringify(d).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));
avisar({dia,versaoIndice:indice.versao||0,modo:'somente leitura'});
for(const snap of importacoes.docs.filter(s=>String(s.data().em||'').slice(0,10)===dia).slice(0,15)){
 const imp=snap.data(),chaves=imp.chaves||[];
 const atual=!imp.desfeito&&!imp.escopoParcial&&chaves.length>0&&chaves.every(c=>indice.arquivos?.[c]?.lote===snap.id);
 const anteriores=chaves.map(chave=>({chave,conhecida:Object.hasOwn(indice.anterior||{},chave),lote:indice.anterior?.[chave]?.lote||null,em:indice.anterior?.[chave]?.em||null}));
 let partesDisponiveis=atual;
 if(atual)for(const chave of chaves){
  const ent=indice.anterior?.[chave];if(!ent?.gen)continue;
  const [tipo,uf]=chave.split(':'),prefixo=tipo==='usadas'?'u':tipo==='rmdf'?'r':'n';
  const refs=Array.from({length:ent.partes||0},(_,n)=>db.doc(`dados/${prefixo}-${uf}-${ent.gen}-${n}`));
  if(!refs.length||(await db.getAll(...refs)).some(s=>!s.exists||!Array.isArray(s.data().itens)))partesDisponiveis=false;
 }
 avisar({id:snap.id,em:imp.em,desfeito:!!imp.desfeito,chaves,atual,podeRestaurar:atual&&anteriores.every(a=>a.conhecida)&&partesDisponiveis,anteriores,cadastrosCriadosNoHorario:Object.values(cadastro).filter(c=>c.criadoEm===imp.em).length});
}
console.log('Conferência concluída sem alterar documentos.');
