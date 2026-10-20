// Operação única autorizada pelo proprietário. Nenhum dado pessoal é registrado no log.
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
export const OPERACAO_LIMPEZA='pecas-reinicio-2026-10-20';
export const COLECOES_PECAS=['devolucoes','movimentos','historico','importacoes','acompanhamento','agendamentos','auditoria_agendamentos','contatos','anotacoes','saldos_tecnicos','declaracoes_tecnicos','eventos_tecnicos'];
const PRESERVAR=['cadastro','config','usuarios','vinculos_tecnicos','seguranca','ferias','historico_ferias','exclusoes_ferias','lembretes_ferias'];
export function bloquearGravacoes(source){
 // Remove comentários preservando strings e linhas: um ';' em comentário não encerra uma regra.
 const codigo=source.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,token=>token.startsWith('/')?token.replace(/[^\n]/g,' '):token);
 return codigo.replace(/(allow\s+([a-z,\s]+):\s*if\s+)([\s\S]*?);/g,(original,prefixo,permissoes,condicao)=>/\b(write|create|update|delete)\b/.test(permissoes)?`${prefixo}!exists(/databases/$(database)/documents/manutencao/limpeza-pecas) && (${condicao});`:original);
}
let leiturasAtivas=0;const filaLeituras=[];
async function limitarLeitura(fn){
 if(leiturasAtivas>=20)await new Promise(r=>filaLeituras.push(r));else leiturasAtivas++;
 try{return await fn();}finally{const proximo=filaLeituras.shift();if(proximo)proximo();else leiturasAtivas--;}
}
async function arvore(ref){
 const docs=await limitarLeitura(()=>ref.listDocuments());
 const linhas=await Promise.all(docs.map(async doc=>{
  const [s,subs]=await Promise.all([limitarLeitura(()=>doc.get()),limitarLeitura(()=>doc.listCollections())]);
  return [...(s.exists?[[doc.path,s.data()]]:[]),...(await Promise.all(subs.map(arvore))).flat()];
 }));
 return linhas.flat().sort(([a],[b])=>a.localeCompare(b));
}
async function preservar(db){
 const dados=[];for(const c of PRESERVAR)dados.push([c,await arvore(db.collection(c))]);
 return createHash('sha256').update(JSON.stringify(dados,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(chave=>[chave,v[chave]])):v)).digest('hex');
}
export async function limparPecasUmaVez({db,regras,source,esperar=ms=>new Promise(r=>setTimeout(r,ms)),agora=()=>new Date().toISOString()}){
 const registro=db.doc(`operacoes_manutencao/${OPERACAO_LIMPEZA}`),trava=db.doc('manutencao/limpeza-pecas');
 const estado=(await registro.get()).data();
 if(estado?.estado==='concluida'){
  if((await trava.get()).exists){await regras.releaseFirestoreRulesetFromSource(source);await trava.delete();}
  return {jaConcluida:true,...estado.resultado};
 }
 const bloqueio=(await trava.get()).data();
 if(bloqueio&&bloqueio.operacao!==OPERACAO_LIMPEZA)throw new Error('Outra manutenção está em andamento.');
 await trava.set({operacao:OPERACAO_LIMPEZA,iniciadaEm:agora()});
 await registro.set({estado:'em_andamento',iniciadaEm:estado?.iniciadaEm||agora()},{merge:true});
 await regras.releaseFirestoreRulesetFromSource(bloquearGravacoes(source));
 // Aguarda a propagação das regras de gravação antes de excluir qualquer dado.
 await esperar(70000);
 const preservados=await preservar(db);
 const antes={};for(const c of COLECOES_PECAS)antes[c]=(await arvore(db.collection(c))).length;
 antes.resumo=(await arvore(db.collection('resumo'))).length;
 antes.dados=(await arvore(db.collection('dados'))).filter(([p])=>p!=='dados/indice').length;
 console.log(`::notice title=Limpeza das peças::${Object.values(antes).reduce((a,b)=>a+b,0)} documentos operacionais identificados. Cadastros e férias fora do escopo de exclusão.`);
 const em=agora(),geracao=randomUUID();
 await db.runTransaction(async tx=>{
  const indice=await tx.get(db.doc('dados/indice'));
  const versao=(indice.data()?.versao||0)+1;
  tx.set(db.doc('dados/indice'),{arquivos:{},anterior:{},versao,atualizadoEm:em,origemSessao:OPERACAO_LIMPEZA});
  tx.set(db.doc('portal/controle'),{geracao,versao,atualizadoEm:em});
 });
 // recursiveDelete inclui subcoleções e documentos cujos pais não existem.
 for(const c of COLECOES_PECAS)await db.recursiveDelete(db.collection(c));
 for(const ref of await db.collection('dados').listDocuments())if(ref.id!=='indice')await db.recursiveDelete(ref);
 await db.recursiveDelete(db.collection('resumo'));
 await db.doc('dados/catalogo').set({m:{}});
 await db.doc('resumo/atual').set({geradoEm:agora(),hoje:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(em)),dias:{},estoque:{regra:'limite_maximo',excesso:0,acima:0,ideal:0,totalNovas:0},vencendoAmanha:0,previsoesHoje:0,atualizacao:[]});
 for(const c of COLECOES_PECAS)if((await arvore(db.collection(c))).length)throw new Error('A verificação encontrou dados de peças remanescentes. Manutenção permanece bloqueada.');
 const dados=await arvore(db.collection('dados'));
 if(dados.length!==2||dados.some(([p])=>!['dados/indice','dados/catalogo'].includes(p)))throw new Error('Há partes de planilhas remanescentes.');
 if(preservados!==await preservar(db))throw new Error('A verificação dos cadastros preservados falhou.');
 // Uma segunda versão avisa as telas abertas depois da exclusão do histórico.
 await db.runTransaction(async tx=>{
  const indice=await tx.get(db.doc('dados/indice')),versao=indice.data().versao+1;
  tx.set(db.doc('dados/indice'),{arquivos:{},anterior:{},versao,atualizadoEm:agora(),origemSessao:OPERACAO_LIMPEZA});
  tx.set(db.doc('portal/controle'),{geracao,versao,atualizadoEm:agora()});
 });
 const resultado={documentosRemovidos:Object.values(antes).reduce((a,b)=>a+b,0),colecoesZeradas:COLECOES_PECAS.length,cadastrosPreservados:true};
 await registro.set({estado:'concluida',concluidaEm:agora(),resultado},{merge:true});
 await regras.releaseFirestoreRulesetFromSource(source);
 await trava.delete();
 return resultado;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  if(process.env.LIMPEZA_PECAS_OPERACAO!==OPERACAO_LIMPEZA)throw new Error('Operação de limpeza não autorizada nesta execução.');
  const {initializeApp,cert}=await import('firebase-admin/app'),{getFirestore}=await import('firebase-admin/firestore'),{getSecurityRules}=await import('firebase-admin/security-rules');
  const config=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
  const cred=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'null');
  if(!cred||cred.project_id!==config.projectId)throw new Error('Credencial ausente ou de outro projeto.');
  const app=initializeApp({credential:cert(cred),projectId:config.projectId}),db=getFirestore(app);
  const principal=(await db.doc('seguranca/controle').get()).data()?.administradorPrincipal;
  const p=principal?(await db.doc(`usuarios/${principal}`).get()).data():null;
  if(!p?.ativo||!p.principal||p.perfil!=='administrador')throw new Error('Conta principal não validada.');
  const source=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
  const resultado=await limparPecasUmaVez({db,regras:getSecurityRules(app),source});
  console.log(`::notice title=Limpeza das peças::${JSON.stringify(resultado)}`);
 }catch(e){console.error('::error title=Limpeza das peças::Falha na manutenção. Confira a credencial e as permissões do projeto, as regras e o registro privado operacoes_manutencao. A trava permanece ativa até concluir a operação. Nenhuma credencial é exibida.');process.exitCode=1;}
}
