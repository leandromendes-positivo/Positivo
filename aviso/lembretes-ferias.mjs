import {createHash,randomUUID} from 'node:crypto';
import {hojeBrasilia} from './enviar-aviso.mjs';
export const emailLembreteValido=e=>typeof e==='string' && e.length<=254 && /^[a-z0-9.!#$%&'*+\-=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(e);
const hash=s=>createHash('sha256').update(s).digest('hex');
const diaMs=86400000;
function dataValida(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
const somarDias=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*diaMs).toISOString().slice(0,10);
export function saidasParaLembrar(ferias,hoje=hojeBrasilia()){
  if(!dataValida(hoje))throw new Error('Data de processamento inválida.');
  const saidas=new Map();
  for(const f of ferias){
    if(f.arquivado || !['planejado','confirmado'].includes(f.status) || !f.id || !f.nome)continue;
    for(const p of f.periodos||[]){
      if(!p||!dataValida(p.inicio)||!dataValida(p.fim)||p.fim<p.inicio)continue;
      const antecedencia=Math.round((Date.parse(p.inicio+'T00:00:00Z')-Date.parse(hoje+'T00:00:00Z'))/diaMs);
      if(antecedencia<1||antecedencia>10)continue;
      const chave=hash(JSON.stringify([f.id,p.inicio]));
      saidas.set(chave,{chave,feriasId:f.id,nome:f.nome,uf:f.regiao||'Não informada',ciclo:f.ciclo||'',status:f.status,inicio:p.inicio,fim:p.fim,retorno:dataValida(p.retorno)&&p.retorno>p.fim?p.retorno:somarDias(p.fim,1),dias:Math.round((Date.parse(p.fim+'T00:00:00Z')-Date.parse(p.inicio+'T00:00:00Z'))/diaMs)+1,antecedencia});
    }
  }
  return [...saidas.values()].sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.nome.localeCompare(b.nome,'pt-BR'));
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=s=>s.split('-').reverse().join('/');
export function montarLembreteFerias(saidas,painel=''){
  const assunto=`Férias da equipe — ${saidas.length} ${saidas.length===1?'saída próxima':'saídas próximas'}`;
  const linhas=saidas.map(s=>`${s.nome} · ${s.uf} · ${s.status==='confirmado'?'Confirmado':'Planejado'}\nSaída: ${data(s.inicio)} (em ${s.antecedencia} ${s.antecedencia===1?'dia':'dias'})\nPeríodo: ${data(s.inicio)} a ${data(s.fim)} · ${s.dias} dias corridos\nRetorno: ${data(s.retorno)}`);
  const texto=[assunto,'','Você solicitou lembretes das férias da equipe.',...linhas.flatMap(l=>['',l]),'','O aviso é previsto para 10 dias antes. Inscrições, alterações de data ou retomada do serviço dentro desse prazo são avisadas na próxima verificação, antes da saída.','As informações refletem a programação atual. Consulte o painel para acompanhar alterações.','Para alterar o endereço ou desativar o recebimento, abra Férias da equipe → Lembretes por e-mail.',...(painel?['',painel+'#ferias']:[])].join('\n');
  const html=`<div style="font-family:Arial,sans-serif;color:#182323;line-height:1.6;max-width:680px"><h2>${esc(assunto)}</h2><p>Você solicitou lembretes das férias da equipe.</p>${linhas.map(l=>`<div style="padding:16px 0;border-bottom:1px solid #ddd">${esc(l).replaceAll('\n','<br>')}</div>`).join('')}<p>O aviso é previsto para 10 dias antes. Inscrições, alterações ou retomada do serviço dentro desse prazo são avisadas na próxima verificação, antes da saída.</p><p>Consulte a programação atual no painel. Para alterar o endereço ou desativar os lembretes, abra <strong>Férias da equipe → Lembretes por e-mail</strong>.</p>${/^https:\/\//.test(painel)?`<p><a href="${esc(painel+'#ferias')}">Abrir programação de férias</a></p>`:''}</div>`;
  return {assunto,texto,html};
}
export async function destinatariosLembretes(db){
  const docs=await db.collection('lembretes_ferias').where('ativo','==',true).get(),grupos=new Map(),perfis=new Map();
  for(const s of docs.docs){
    const d=s.data();
    if(d.uid!==s.id || !emailLembreteValido(d.email) || !emailLembreteValido(d.titular))continue;
    if(!perfis.has(d.titular))perfis.set(d.titular,(await db.doc(`usuarios/${d.titular}`).get()).data());
    const p=perfis.get(d.titular);
    if(!p?.ativo || !['usuario','administrador'].includes(p.perfil))continue;
    const email=d.email.toLowerCase(),g=grupos.get(email)||[];g.push({id:s.id,...d});grupos.set(email,g);
  }
  return grupos;
}
// O SMTP não participa da transação do Firestore. Uma tentativa de resultado incerto
// permanece reservada para conferência, evitando reenvio automático de e-mail já aceito.
export async function processarLembretes({db,transporte,remetente,hoje=hojeBrasilia(),painel='',simular=false,agora=()=>new Date().toISOString()}){
  const ferias=await db.collection('ferias').get();
  const saidas=saidasParaLembrar(ferias.docs.map(s=>({...s.data(),id:s.id})),hoje);
  const destinatarios=await destinatariosLembretes(db);
  const resultado={destinatarios:destinatarios.size,saidas:saidas.length,enviados:0,ignorados:0,pendentes:0,falhas:0};
  if(!saidas.length||!destinatarios.size||simular)return resultado;
  await transporte.verify(); // Falhas de credencial/conexão não reservam nenhum envio.
  for(const [email,inscricoes] of destinatarios){
    // Um e-mail pode ter sido desativado durante o processamento: reconfere antes de reservar.
    const validas=await Promise.all(inscricoes.map(async s=>{
      const [atual,p]=await Promise.all([db.doc(`lembretes_ferias/${s.id}`).get(),db.doc(`usuarios/${s.titular}`).get()]);
      const d=atual.data(),perfil=p.data();return d?.ativo && d.email?.toLowerCase()===email && d.titular===s.titular && perfil?.ativo && ['usuario','administrador'].includes(perfil.perfil);
    }));
    if(!validas.some(Boolean))continue;
    // Releitura impede enviar períodos cancelados, retirados ou alterados desde a seleção inicial.
    const atuais=await Promise.all([...new Set(saidas.map(s=>s.feriasId))].map(async id=>{const s=await db.doc(`ferias/${id}`).get();return s.exists?{...s.data(),id}:null;}));
    const elegiveis=saidasParaLembrar(atuais.filter(Boolean),hoje).filter(s=>saidas.some(p=>p.chave===s.chave));
    for(let inicio=0;inicio<elegiveis.length;inicio+=100){
      const grupo=elegiveis.slice(inicio,inicio+100),lote=randomUUID(),outbox=db.doc(`caixa_lembretes_ferias/${lote}`);
      const reservados=await db.runTransaction(async tx=>{
        const refs=grupo.map(s=>db.doc(`envios_lembretes_ferias/${hash(email+'|'+s.chave)}`));
        const snapshots=await Promise.all(refs.map(r=>tx.get(r)));
        const novos=grupo.map((s,i)=>({s,ref:refs[i],existente:snapshots[i]})).filter(x=>!x.existente.exists || x.existente.data().estado==='falhou');
        const pendentes=snapshots.filter(s=>s.exists&&['em_envio','incerto'].includes(s.data().estado)).length;
        if(!novos.length)return {novos:[],pendentes};
        for(const {s,ref} of novos)tx.set(ref,{email,feriasId:s.feriasId,inicio:s.inicio,estado:'em_envio',lote,atualizadoEm:agora()});
        tx.set(outbox,{email,estado:'em_envio',hoje,quantidade:novos.length,criadoEm:agora()});
        return {novos,pendentes};
      });
      const {novos:reserva,pendentes}=reservados;resultado.pendentes+=pendentes;
      resultado.ignorados+=grupo.length-reserva.length;
      if(!reserva.length)continue;
      const aviso=montarLembreteFerias(reserva.map(x=>x.s),painel);
      try{
        const info=await transporte.sendMail({from:{name:'Férias da equipe',address:remetente},to:{address:email},subject:aviso.assunto,text:aviso.texto,html:aviso.html,messageId:`<ferias-${lote}@${remetente.split('@')[1]}>`});
        if(!info.accepted?.some(e=>String(e).toLowerCase()===email))throw Object.assign(new Error('Entrega não aceita pelo servidor de e-mail.'),{code:'EENVELOPE'});
        const batch=db.batch();for(const {ref} of reserva)batch.update(ref,{estado:'enviado',atualizadoEm:agora()});batch.update(outbox,{estado:'enviado',atualizadoEm:agora()});await batch.commit();resultado.enviados++;
      }catch(e){
        const certoNaoEnviado=['EAUTH','EENVELOPE','EMESSAGE'].includes(e.code)||Number(e.responseCode)>=400;
        const estado=certoNaoEnviado?'falhou':'incerto';
        const batch=db.batch();for(const {ref} of reserva)batch.update(ref,{estado,atualizadoEm:agora()});batch.update(outbox,{estado,atualizadoEm:agora(),codigo:certoNaoEnviado?'smtp_rejeitado':'resultado_nao_confirmado'});await batch.commit();
        resultado.falhas++;if(!certoNaoEnviado)resultado.pendentes++;
      }
    }
  }
  return resultado;
}
