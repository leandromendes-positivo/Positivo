// Exclusão única de TO, autorizada pelo proprietário. Não registra dados pessoais em logs.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {regiaoDesativada} from '../aviso/escopo-operacao.mjs';
import {bloquearGravacoes} from './limpar-pecas.mjs';
export const OPERACAO_TO='retirada-to-2026-11-03';
const COLECOES_TO=new Set(['config','cadastro','dados','devolucoes','movimentos','historico','importacoes','resumo','usuarios','vinculos_tecnicos','seguranca','servicos','portal','acompanhamento','agendamentos','auditoria_agendamentos','contatos','anotacoes','ferias','historico_ferias','exclusoes_ferias','lembretes_ferias','envios_lembretes_ferias','acompanhamento_lembretes_ferias','caixa_lembretes_ferias','testes_lembretes_ferias','operacoes_lembretes_ferias','credenciais_usuarios','recuperacoes_senha','pedidos_recuperacao','limites_contas','saldos_tecnicos','declaracoes_tecnicos','eventos_tecnicos']);
const hash=s=>createHash('sha256').update(s).digest('hex');
const decodificar=v=>Array.isArray(v)?v.map(decodificar):v&&typeof v==='object'&&!v.toDate?(Object.keys(v).length===1&&Array.isArray(v.cp_lista)?v.cp_lista.map(decodificar):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decodificar(x)]))):v;
const codificar=v=>Array.isArray(v)?v.map(x=>Array.isArray(x)?{cp_lista:codificar(x)}:codificar(x)):v&&typeof v==='object'&&!v.toDate?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,codificar(x)])):v;
const igual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ufChave=c=>String(c||'').split(':')[1];
const tidVinculo=s=>String(s||'').split('--').slice(1).join('--');

/** Plano puro: dados mistos são editados, nunca apagados em bloco. */
export function planejarRetiradaTO(entrada,{raizes=[],hashPeca=s=>hash(s),uidsTO=[]}={}){
 const docs=new Map([...entrada].filter(([p])=>COLECOES_TO.has(p.split('/')[0])).map(([p,d])=>[p,decodificar(d)]));
 const toTids=new Set(),ativas=new Map(),matsTO=new Set(),matsAtivos=new Set(),chavesTO=new Set(),chavesAtivas=new Set();
 const feriasTO=new Set(),feriasAtivas=new Set(),emails=new Set(),uids=new Set(uidsTO),lotesTO=new Set(),lotesAtivos=new Set();
 const ativa=(tid,uf)=>{if(tid&&!regiaoDesativada(uf)&&uf){const u=ativas.get(tid)||new Set();u.add(uf);ativas.set(tid,u);}};
 const peca=(tid,uf,mat,k,tipoEnvio)=>{
  const encerrada=regiaoDesativada(uf),mats=encerrada?matsTO:matsAtivos,chaves=encerrada?chavesTO:chavesAtivas;
  if(encerrada&&tid)toTids.add(tid);else if(!encerrada)ativa(tid,uf);
  if(mat)mats.add(mat);if(k)chaves.add(k);
  if(tid&&mat){chaves.add('nova-'+hashPeca([tid,uf,mat].join('|')));if(tipoEnvio!==undefined)chaves.add('nova-'+hashPeca(tid+'|'+mat+'|'+(tipoEnvio||'')));}
 };
 for(const raiz of raizes){const id=raiz.split('/')[1];if(regiaoDesativada(id)&&tidVinculo(id))toTids.add(tidVinculo(id));if(!regiaoDesativada(id)&&id?.includes('--'))ativa(tidVinculo(id),id.split('--')[0]);}
 for(const [p,d] of docs){
  const [c,id]=p.split('/'),parte=c==='dados'&&id.match(/^([unr])-([A-Z]{2})-/);
  if(parte)for(const l of d.itens||[]){const novas=parte[1]==='n';peca(novas?l[0]:l[1],d.regiao||parte[2],novas?l[1]:l[4],novas?null:l[0],novas?l[2]:undefined);}
  if(c==='devolucoes')for(const l of d.itens||[])peca(l[1],l[8],l[2],l[0]);
  if(c==='movimentos')for(const m of d.itens||[])peca(m.tid,m.regiao,m.mat,m.k);
  if(c==='vinculos_tecnicos'||c==='usuarios'){
   const vinculo=c==='vinculos_tecnicos'?id:d.tecnicoId;
   if(vinculo){if(regiaoDesativada(vinculo))toTids.add(tidVinculo(vinculo));else ativa(tidVinculo(vinculo),vinculo.split('--')[0]);}
  }
  if(c==='usuarios'&&d.perfil==='tecnico'&&regiaoDesativada(d.tecnicoId)){
   if(d.principal)throw new Error('RETIRADA: perfil principal não pode ser excluído.');emails.add(id.toLowerCase());
  }
  if(c==='cadastro'&&id==='tecnicos')for(const [tid,t]of Object.entries(d.t||{})){if(regiaoDesativada(t.regiao))toTids.add(tid);else ativa(tid,t.regiao);}
  if(c==='ferias'){if(regiaoDesativada(d.regiao))feriasTO.add(id);else feriasAtivas.add(id);}
 }
 for(const [p,d]of docs)if(p.startsWith('historico_ferias/')&&d.id&&regiaoDesativada(d.regiao)&&!feriasAtivas.has(d.id))feriasTO.add(d.id);
 for(const [p,d]of docs)if(p.startsWith('credenciais_usuarios/')&&emails.has(p.split('/')[1])&&d.uid)uids.add(d.uid);
 for(const [p,d]of docs)if(['envios_lembretes_ferias','acompanhamento_lembretes_ferias'].includes(p.split('/')[0])&&d.lote){
  const fora=feriasTO.has(d.feriasId)||regiaoDesativada(d.programacao?.regiao)||regiaoDesativada(d.programacaoPendente?.regiao);(fora?lotesTO:lotesAtivos).add(d.lote);
 }
 const exclusivo=tid=>!!tid&&toTids.has(tid)&&!ativas.has(tid),chaveExclusiva=k=>chavesTO.has(k)&&!chavesAtivas.has(k);
 const alteracoes=[],arvores=raizes.filter(p=>regiaoDesativada(p.split('/')[1]));
 const mudar=(p,antes,depois)=>{if(depois===null||!igual(decodificar(antes),depois))alteracoes.push({caminho:p,...(depois===null?{excluir:true}:{dados:codificar(depois)})});};
 for(const [p,d]of docs){
  const [c,id]=p.split('/');let novo=d;
  if(['operacoes_manutencao','manutencao','seguranca','servicos'].includes(c))continue;
  if(regiaoDesativada(d.regiao)||regiaoDesativada(d.uf)||regiaoDesativada(d.tecnicoId)||regiaoDesativada(d.confirmacao?.regiao)
    || (c==='dados'&&/^[unr]-TO-/i.test(id))||(c==='vinculos_tecnicos'&&regiaoDesativada(id))||exclusivo(d.tid)||(c==='acompanhamento'&&exclusivo(id)))novo=null;
  else if(c==='cadastro'&&id==='tecnicos')novo={...d,t:Object.fromEntries(Object.entries(d.t||{}).filter(([tid])=>!exclusivo(tid)).map(([tid,t])=>[tid,regiaoDesativada(t.regiao)?{...t,regiao:[...ativas.get(tid)].sort()[0]}:t]))};
  else if(p==='dados/indice'){
   const filtrar=m=>Object.fromEntries(Object.entries(m||{}).filter(([k])=>!regiaoDesativada(ufChave(k))));
   novo={...d,arquivos:filtrar(d.arquivos),anterior:filtrar(d.anterior)};
  }else if(p==='dados/catalogo')novo={...d,m:Object.fromEntries(Object.entries(d.m||{}).filter(([m])=>!matsTO.has(m)||matsAtivos.has(m)))};
  else if(c==='devolucoes'||c==='movimentos'){
   const itens=(d.itens||[]).filter(l=>!regiaoDesativada(c==='devolucoes'?l[8]:l.regiao));if(itens.length!==(d.itens||[]).length)novo=itens.length?{...d,itens}:null;
  }else if(c==='importacoes'){
   const arquivos=(d.arquivos||[]).filter(a=>!regiaoDesativada(a.regiao)),chaves=(d.chaves||[]).filter(k=>!regiaoDesativada(ufChave(k)));
   if(arquivos.length!==(d.arquivos||[]).length||chaves.length!==(d.chaves||[]).length){
    novo=arquivos.length||chaves.length?{...d,arquivos,chaves,devolvidas:arquivos.filter(a=>a.tipo==='usadas').reduce((s,a)=>s+(a.saidasQtd||0),0),avisos:(d.avisos||[]).filter(a=>!/(?:\bTO\b|Tocantins)/i.test(a)),escopoParcial:true}:null;
   }
  }else if(c==='historico'&&(Object.keys(d.t||{}).some(t=>toTids.has(t))||(d.regioes||[]).some(regiaoDesativada))){
   const t=Object.fromEntries(Object.entries(d.t||{}).filter(([tid])=>!exclusivo(tid)).map(([tid,l])=>[tid,(toTids.has(tid)||((d.regioes||[]).some(regiaoDesativada)&&!Object.keys(d.t||{}).some(t=>toTids.has(t))))?[null,null,null,null]:l]));
   const somar=i=>Object.values(t).some(l=>l[i]==null)?null:Object.values(t).reduce((s,l)=>s+(l[i]||0),0);
   novo=Object.keys(t).length?{...d,t,escopoParcial:true,regioes:[...new Set(Object.keys(t).flatMap(tid=>[...(ativas.get(tid)||[])]))],tot:{usadas:somar(0),atrasadas:somar(1),novas:somar(3),cobrarTec:null,cobrarPecas:null,ideal:null,acima:null,excessoNovas:null}}:null;
  }
  if(novo&&c==='historico'&&novo.regioes?.some(regiaoDesativada))novo={...novo,regioes:novo.regioes.filter(u=>!regiaoDesativada(u))};
  if(novo&&novo.feriasId&&feriasTO.has(novo.feriasId))novo=null;
  if(novo&&c==='exclusoes_ferias'&&novo.cadastroId&&feriasTO.has(novo.cadastroId))novo=null;
  if(novo&&['acompanhamento_lembretes_ferias'].includes(c)&&(regiaoDesativada(novo.programacao?.regiao)||regiaoDesativada(novo.programacaoPendente?.regiao)))novo=null;
  if(novo&&c==='caixa_lembretes_ferias'&&lotesTO.has(id))novo=lotesAtivos.has(id)?{...novo,quantidade:null,escopoParcial:true}:null;
  if(novo&&c==='limites_contas'&&([...emails].some(e=>hash('recuperar-email:'+e)===id)||[...uids].some(u=>hash('admin:'+u)===id)))novo=null;
  if(novo&&['credenciais_usuarios','pedidos_recuperacao'].includes(c)&&(emails.has(id)||[...emails].some(e=>hash(e)===id)))novo=null;
  if(novo&&['recuperacoes_senha','lembretes_ferias','testes_lembretes_ferias','operacoes_lembretes_ferias','envios_lembretes_ferias','acompanhamento_lembretes_ferias','caixa_lembretes_ferias'].includes(c)&&(emails.has(novo.email?.toLowerCase())||emails.has(novo.titular?.toLowerCase())||uids.has(novo.uid)||uids.has(id)))novo=null;
  if(novo&&novo.itens&&!['dados','devolucoes','movimentos'].includes(c)){
   if(Array.isArray(novo.itens)){
    const itens=novo.itens.filter(i=>typeof i==='string'?!chaveExclusiva(i):!regiaoDesativada(i?.regiao));
    if(itens.length!==novo.itens.length)novo=itens.length?{...novo,itens}:null;
   }else novo={...novo,itens:Object.fromEntries(Object.entries(novo.itens).filter(([k])=>!chaveExclusiva(k)))};
  }
  if(novo&&Array.isArray(novo.detalhes)){
   const detalhes=novo.detalhes.filter(i=>!regiaoDesativada(i.regiao)&&!chaveExclusiva(i.k));
   if(detalhes.length!==novo.detalhes.length)novo=detalhes.length?{...novo,detalhes,pecas:detalhes.reduce((s,i)=>s+(i.qtd||0),0)}:null;
  }
  if(novo&&c==='acompanhamento'&&Array.isArray(novo.cobrancas))novo={...novo,cobrancas:novo.cobrancas.filter(v=>!regiaoDesativada(v.regiao)&&!(v.itens?.length&&v.itens.every(chaveExclusiva))).map(v=>({...v,...(v.itens?{itens:v.itens.filter(k=>!chaveExclusiva(k))}:{})}))};
  if(novo&&c==='resumo'&&id==='atual'&&(toTids.size||feriasTO.size||arvores.length))novo={geradoEm:d.geradoEm||'',hoje:d.hoje||'',dias:{},estoque:{regra:'limite_maximo',excesso:0,acima:0,ideal:0,totalNovas:0},atualizacao:[]};
  if(c==='usuarios'&&d.principal&&novo===null)throw new Error('RETIRADA: conta principal protegida.');
  mudar(p,entrada.get(p),novo);
 }
 const porColecao={};for(const a of alteracoes){const c=a.caminho.split('/')[0],v=porColecao[c]||{excluir:0,editar:0};v[a.excluir?'excluir':'editar']++;porColecao[c]=v;}
 return {alteracoes,arvores,emails:[...emails],resumo:{documentosExcluir:alteracoes.filter(a=>a.excluir).length,documentosEditar:alteracoes.filter(a=>!a.excluir).length,arvoresExcluir:arvores.length,contasTO:emails.size,porColecao}};
}

async function coletar(db){
 const docs=new Map(),snapshots=new Map(),raizes=[];
 for(const col of await db.listCollections()){
  if(!COLECOES_TO.has(col.id))continue;
  if(['saldos_tecnicos','declaracoes_tecnicos'].includes(col.id)){for(const ref of await col.listDocuments())raizes.push(ref.path);continue;}
  const lote=await col.get();for(const d of lote.docs){docs.set(d.ref.path,d.data());snapshots.set(d.ref.path,d);}
 }
 return {docs,snapshots,raizes};
}
async function hashPecaVersionado(){const util=await readFile(new URL('../src/js/00-util.js',import.meta.url),'utf8');return vm.runInNewContext(util+'\nhash36');}
async function planejar(db,auth){
 const dados=await coletar(db),op={raizes:dados.raizes,hashPeca:await hashPecaVersionado()},base=planejarRetiradaTO(dados.docs,op),uidsTO=[];
 if(auth)for(const email of base.emails){try{uidsTO.push((await auth.getUserByEmail(email)).uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}}
 return {...dados,plano:planejarRetiradaTO(dados.docs,{...op,uidsTO})};
}
export async function executarRetiradaTO({db,auth,regras,source,aplicar=false,esperar=ms=>new Promise(r=>setTimeout(r,ms))}){
 const registro=db.doc(`operacoes_manutencao/${OPERACAO_TO}`),trava=db.doc('manutencao/limpeza-pecas');
 const anterior=(await registro.get()).data();
 if(aplicar&&anterior?.estado==='concluida')return {jaConcluida:true,...anterior.resultado};
 if(!aplicar)return (await planejar(db,auth)).plano.resumo;
 const principal=(await db.doc('seguranca/controle').get()).data()?.administradorPrincipal;
 const dono=await auth.getUserByEmail(principal);
 const bloqueio=await trava.get();if(bloqueio.exists&&bloqueio.data().operacao!==OPERACAO_TO)throw new Error('RETIRADA: outra manutenção está em andamento.');
 await trava.set({operacao:OPERACAO_TO,iniciadaEm:new Date().toISOString()});
 await registro.set({estado:'em_andamento',iniciadaEm:new Date().toISOString()},{merge:true});
 await regras.releaseFirestoreRulesetFromSource(bloquearGravacoes(source));
 await esperar(70000);
 const {plano,snapshots}=await planejar(db,auth);
 const pendentes=new Set(anterior?.uidsPendentes||[]);
 for(const email of plano.emails){try{const u=await auth.getUserByEmail(email);if(u.uid===dono.uid)throw new Error('RETIRADA: conta principal protegida.');pendentes.add(u.uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}}
 await registro.set({uidsPendentes:[...pendentes]},{merge:true});
 for(let i=0;i<plano.alteracoes.length;i+=30){
  const lote=plano.alteracoes.slice(i,i+30);
  await db.runTransaction(async tx=>{
   const atuais=await Promise.all(lote.map(a=>tx.get(db.doc(a.caminho))));
   for(let j=0;j<lote.length;j++){const a=lote[j],ant=snapshots.get(a.caminho),atual=atuais[j];if(!atual.exists||!ant.updateTime.isEqual(atual.updateTime))throw new Error('RETIRADA: houve alteração concorrente; execute novamente.');}
   for(const a of lote){if(a.excluir)tx.delete(db.doc(a.caminho));else tx.set(db.doc(a.caminho),a.dados);}
  });
 }
 for(const a of plano.alteracoes)if(a.excluir)await db.recursiveDelete(db.doc(a.caminho));
 for(const raiz of plano.arvores)await db.recursiveDelete(db.doc(raiz));
 for(const uid of pendentes){if(uid===dono.uid)throw new Error('RETIRADA: conta principal protegida.');await auth.deleteUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e;});}
 const restante=await planejar(db,auth);
 if(restante.plano.alteracoes.length||restante.plano.arvores.length||restante.plano.emails.length)throw new Error('RETIRADA: ainda existem registros de TO.');
 await db.runTransaction(async tx=>{const ref=db.doc('dados/indice'),s=await tx.get(ref);tx.set(ref,{...s.data(),arquivos:s.data()?.arquivos||{},anterior:s.data()?.anterior||{},versao:(s.data()?.versao||0)+1,atualizadoEm:new Date().toISOString(),origemSessao:OPERACAO_TO});});
 const {prepararPortalExistente}=await import('./portal.mjs');await prepararPortalExistente(db);
 const {recalcularResumo}=await import('../aviso/recalcular-resumo.mjs');
 const hoje=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await db.doc('resumo/atual').set(codificar(await recalcularResumo(db,hoje,{duranteManutencao:true})));
 await regras.releaseFirestoreRulesetFromSource(source);
 await trava.delete();
 await registro.set({estado:'concluida',concluidaEm:new Date().toISOString(),resultado:plano.resumo});
 return plano.resumo;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  const aplicar=process.argv.includes('--aplicar');
  if(aplicar&&process.env.RETIRAR_TO_AUTORIZACAO!==OPERACAO_TO)throw new Error('RETIRADA: exclusão não autorizada nesta execução.');
  const {initializeApp,cert}=await import('firebase-admin/app'),{getFirestore}=await import('firebase-admin/firestore'),{getAuth}=await import('firebase-admin/auth'),{getSecurityRules}=await import('firebase-admin/security-rules');
  const cfg=JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8')),cred=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'null');
  if(!cred||cred.project_id!==cfg.projectId)throw new Error('RETIRADA: credencial de outro projeto.');
  const app=initializeApp({credential:cert(cred),projectId:cfg.projectId}),db=getFirestore(app);
  const dono=(await db.doc('seguranca/controle').get()).data()?.administradorPrincipal,p=dono?(await db.doc(`usuarios/${dono}`).get()).data():null;
  if(!p?.ativo||!p.principal||p.perfil!=='administrador')throw new Error('RETIRADA: administrador principal não validado.');
  const source=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
  const resultado=await executarRetiradaTO({db,auth:getAuth(app),regras:getSecurityRules(app),source,aplicar});
  console.log(`::notice title=${aplicar?'Exclusão TO concluída':'Prévia da exclusão TO'}::${JSON.stringify(resultado)}`);
 }catch(e){console.error(`::error title=Retirada de TO::${e.message?.startsWith('RETIRADA:')?e.message:'Falha na limpeza. Confira as permissões e a manutenção antes de retomar.'}${e.code?' Código: '+String(e.code).replace(/[^a-zA-Z0-9_/-]/g,''):''}`);process.exitCode=1;}
}
