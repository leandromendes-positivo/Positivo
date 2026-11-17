// Recuperação administrativa delimitada por lote e versão. Não registra dados pessoais nos logs.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {recalcularResumo} from '../aviso/recalcular-resumo.mjs';

function decodificar(v){
 if(v&&typeof v.toDate==='function')return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(v.toDate());
 if(Array.isArray(v))return v.map(decodificar);
 if(v&&typeof v==='object'){if(Object.keys(v).length===1&&Array.isArray(v.cp_lista))return v.cp_lista.map(decodificar);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decodificar(x)]));}
 return v;
}
async function listar(db,colecao){return (await db.collection(colecao).get()).docs.map(s=>({id:s.id,...decodificar(s.data())}));}
async function ferramentas(){
 const codigo=await readFile(new URL('../src/js/39-reversao-importacao.js',import.meta.url),'utf8');
 return vm.runInNewContext(codigo+'\n({validarReversaoImportacao,planejarLimpezaImportacao,assinaturaRegistroImportacao})',{structuredClone});
}
async function lerFotos(db,arquivos){
 const fotos={usadas:[],novas:[],rmdf:[]};
 for(const [chave,ent]of Object.entries(arquivos||{})){
  if(!ent?.gen)continue;
  if(!/^(novas|usadas|rmdf):(PR|SC|RS)$/.test(chave))throw new Error('UF ou tipo inesperado no índice; recuperação interrompida.');
  const [tipo,regiao]=chave.split(':'),prefixo=tipo==='usadas'?'u':tipo==='rmdf'?'r':'n';
  if(!Number.isInteger(ent.partes)||ent.partes<1)throw new Error('Versão anterior sem partes válidas.');
  for(let n=0;n<ent.partes;n++){
   const snap=await db.doc(`dados/${prefixo}-${regiao}-${ent.gen}-${n}`).get();
   if(!snap.exists||!Array.isArray(snap.data().itens))throw new Error('Uma parte da versão anterior está indisponível.');
   for(const l of decodificar(snap.data().itens)){
    if(!Array.isArray(l))throw new Error('Linha compacta inválida na versão anterior.');
    fotos[tipo].push(tipo==='novas'?{tid:l[0],regiao,mat:l[1],tipoEnvio:l[2],qtd:l[3],linhas:l[4],desde:l[5]}:{k:l[0],tid:l[1],regiao,nf:l[2],remessa:l[3],mat:l[4],chamado:l[5],dataFT:l[6]||null,qtd:l[7],desde:l[8],matSol:l[9]||'',qtdUso:l[10]||l[7]});
   }
  }
 }
 return fotos;
}
async function publicarFotos(db,fotos,cadastro,catalogo){
 const codigo=await readFile(new URL('../src/js/27-portal.js',import.meta.url),'utf8');
 const montar=vm.runInNewContext(codigo+'\nmontarSaldosTecnicos',{TextEncoder});
 const saldos=montar(fotos.usadas,fotos.novas,cadastro,catalogo,fotos.rmdf),geracao=randomUUID();
 let batch=db.batch(),n=0;
 const gravar=async(ref,d)=>{batch.set(ref,d);if(++n===400){await batch.commit();batch=db.batch();n=0;}};
 for(const [id,s]of saldos){const ref=db.doc(`saldos_tecnicos/${id}/geracoes/${geracao}`);await gravar(ref,{nome:s.nome,tid:s.tid,regiao:s.regiao,total:s.pecas.size});for(const [peca,d]of s.pecas)await gravar(ref.collection('pecas').doc(peca),d);}
 if(n)await batch.commit();return geracao;
}
export async function recuperarImportacao(db,{id,versaoEsperada,dia,aplicar=false}){
 if(!/^L\d{14}[a-z0-9]+$/.test(id||'')||!/^\d{4}-\d{2}-\d{2}$/.test(dia||''))throw new Error('Identificação ou data da recuperação inválida.');
 const f=await ferramentas(),backupRef=db.doc(`recuperacoes_importacao/${id}`),backupSnap=await backupRef.get();
 let resultado=backupSnap.data()?.resultado;
 if(!resultado){
  const [indiceSnap,impSnap,cadSnap,catSnap,controle,manutencao]=await Promise.all(['dados/indice',`importacoes/${id}`,'cadastro/tecnicos','dados/catalogo','seguranca/controle','manutencao/limpeza-pecas'].map(p=>db.doc(p).get()));
  if(manutencao.exists)throw new Error('Há uma manutenção ativa. Nenhum saldo foi alterado.');
  const indice=decodificar(indiceSnap.data()||{}),imp={...decodificar(impSnap.data()||{}),id};
  if(indice.versao!==versaoEsperada||String(imp.em||'').slice(0,10)!==dia)throw new Error('O estoque mudou ou o lote não pertence ao dia autorizado.');
  const chaves=f.validarReversaoImportacao(imp,indice),arquivos={...indice.arquivos};
  for(const c of chaves)arquivos[c]=indice.anterior[c]||null;
  const fotos=await lerFotos(db,arquivos);
  const [devs,movs,agendas,contatos,anotacoes,usuarios,historicos]=await Promise.all(['devolucoes','movimentos','agendamentos','contatos','anotacoes','usuarios','historico'].map(c=>listar(db,c)));
  const registros=[...agendas,...contatos,...anotacoes,...devs.flatMap(d=>(d.itens||[]).filter(l=>l[9]!==id).map(l=>({tid:l[1],mat:l[2],lote:l[9]}))),...movs.flatMap(d=>(d.itens||[]).filter(m=>m.lote!==id)),...historicos.filter(h=>h.data<dia).flatMap(h=>Object.keys(h.t||{}).map(tid=>({tid})))];
  const limpeza=f.planejarLimpezaImportacao(imp,{cadastro:decodificar(cadSnap.data()?.t||{}),catalogo:decodificar(catSnap.data()?.m||{}),fotos,registros,usuarios});
  resultado={id,planilhas:chaves.length,cadastrosRemovidos:limpeza.removidos.length,versao:versaoEsperada+1,origens:[...new Set(chaves.map(c=>indice.anterior[c]?.em||'sem planilha anterior'))]};
  if(!aplicar)return {...resultado,modo:'somente leitura'};
  const geracao=await publicarFotos(db,fotos,limpeza.cadastro,limpeza.catalogo);
  const devsAlteradas=devs.filter(d=>(d.itens||[]).some(l=>l[9]===id)),movsAlterados=movs.filter(d=>d.lote===id||(d.itens||[]).some(m=>m.lote===id));
  if(devsAlteradas.length+movsAlterados.length>400)throw new Error('Recuperação excede o limite transacional.');
  await db.runTransaction(async tx=>{
   const [atual,imAtual,cadAtual,catAtual,backupAtual,histAtual,resumoAtual]=await Promise.all([tx.get(db.doc('dados/indice')),tx.get(db.doc(`importacoes/${id}`)),tx.get(db.doc('cadastro/tecnicos')),tx.get(db.doc('dados/catalogo')),tx.get(backupRef),tx.get(db.doc(`historico/${dia}`)),tx.get(db.doc('resumo/atual'))]);
   if(backupAtual.exists)throw new Error('A recuperação já foi iniciada em outra execução.');
   if(atual.data()?.versao!==versaoEsperada)throw new Error('Uma nova importação mudou o estoque. Recuperação cancelada.');
   f.validarReversaoImportacao({...decodificar(imAtual.data()),id},decodificar(atual.data()));
   if(f.assinaturaRegistroImportacao(decodificar(cadAtual.data()))!==f.assinaturaRegistroImportacao(decodificar(cadSnap.data()))||f.assinaturaRegistroImportacao(decodificar(catAtual.data()))!==f.assinaturaRegistroImportacao(decodificar(catSnap.data())))throw new Error('O cadastro foi editado durante a conferência. Execute novamente.');
   const saidas=[...devsAlteradas.map(d=>['devolucoes',d]),...movsAlterados.map(d=>['movimentos',d])];
   const snaps=await Promise.all(saidas.map(([c,d])=>tx.get(db.doc(`${c}/${d.id}`))));
   const anteriores={...indice.anterior},reversivel={...indice.reversivel};
   for(const c of chaves){anteriores[c]=null;reversivel[c]=false;}
   tx.set(backupRef.collection('antes').doc('indice'),atual.data());tx.set(backupRef.collection('antes').doc('cadastro'),cadAtual.data());tx.set(backupRef.collection('antes').doc('catalogo'),catAtual.data());tx.set(backupRef.collection('antes').doc('importacao'),imAtual.data());
   if(histAtual.exists)tx.set(backupRef.collection('antes').doc('historico'),histAtual.data());if(resumoAtual.exists)tx.set(backupRef.collection('antes').doc('resumo'),resumoAtual.data());
   saidas.forEach(([c,d],n)=>{
    if(!snaps[n].exists)return;
    const raw=snaps[n].data(),linhas=raw.itens||[];
    tx.set(backupRef.collection('saidas').doc(`${c}-${d.id}`),{colecao:c,id:d.id,documento:raw});
    const itens=linhas.filter(l=>c==='devolucoes'?decodificar(l)[9]!==id:raw.lote!==id&&l.lote!==id);
    if(itens.length)tx.set(db.doc(`${c}/${d.id}`),{...raw,itens});else tx.delete(db.doc(`${c}/${d.id}`));
   });
   const em=new Date().toISOString(),por={uid:'recuperacao-administrativa',email:controle.data()?.administradorPrincipal||''};
   tx.set(db.doc('dados/indice'),{...atual.data(),arquivos,anterior:anteriores,reversivel,versao:versaoEsperada+1,atualizadoEm:em,origemSessao:`recuperacao-${id}`});
   tx.set(db.doc('cadastro/tecnicos'),{...cadAtual.data(),t:limpeza.cadastro});tx.set(db.doc('dados/catalogo'),{...catAtual.data(),m:limpeza.catalogo});
   tx.set(db.doc('portal/controle'),{geracao,versao:versaoEsperada+1,atualizadoEm:em});
   tx.set(db.doc(`importacoes/${id}`),{desfeito:true,desfeitoEm:em,desfeitoPor:por,cadastrosRemovidos:limpeza.removidos,backupRecuperacao:backupRef.path},{merge:true});
   tx.set(backupRef,{estado:'aplicada',em,por,resultado,partesOriginaisPreservadas:true});
  });
 }
 if(aplicar){
  const atual=(await db.doc('dados/indice').get()).data();
  if(atual?.versao!==resultado.versao)throw new Error('Houve outra atualização após a recuperação; o resumo não será sobrescrito.');
  const {resumo,historico}=await recalcularResumo(db,dia,{incluirHistorico:true});
  // Converte listas aninhadas usando a mesma representação do painel.
  const codificar=(v,lista=false)=>Array.isArray(v)?(lista?{cp_lista:v.map(x=>codificar(x,true))}:v.map(x=>codificar(x,true))):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,codificar(x,false)])):v;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(db.doc('dados/indice'));if(snap.data()?.versao!==resultado.versao)throw new Error('O estoque mudou durante o recálculo.');
   tx.set(db.doc('resumo/atual'),codificar(resumo));tx.set(db.doc(`historico/${dia}`),codificar(historico));tx.set(backupRef,{estado:'verificada',verificadaEm:new Date().toISOString()},{merge:true});
  });
 }
 return {...resultado,estado:aplicar?'verificada':'já aplicada'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
 let credencial;try{credencial=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'');}catch{throw new Error('Credencial do Firebase indisponível.');}
 if(credencial.project_id!==config.projectId)throw new Error('A credencial pertence a outro projeto.');
 const id=process.env.RECUPERACAO_IMPORTACAO_ID,aplicar=process.argv.includes('--aplicar');
 if(aplicar&&process.env.RECUPERACAO_IMPORTACAO_AUTORIZACAO!==id)throw new Error('Lote de recuperação diferente do autorizado.');
 const db=getFirestore(initializeApp({credential:cert(credencial),projectId:config.projectId}));
 const r=await recuperarImportacao(db,{id,versaoEsperada:Number(process.env.RECUPERACAO_VERSAO),dia:process.env.RECUPERACAO_DIA,aplicar});
 console.log('::notice title=Recuperacao de importacao::'+JSON.stringify(r).replaceAll('%','%25').replaceAll('\n','%0A'));
}
