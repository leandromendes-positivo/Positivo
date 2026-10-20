import {programacaoFerias,mesmaProgramacao,resumoProgramacao,camposAlterados} from './alteracoes-ferias.mjs';
import {layoutEmailFerias} from './layout-email-ferias.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {hojeBrasilia} from './data-brasilia.mjs';
export const emailLembreteValido=e=>typeof e==='string' && e.length<=254 && /^[a-z0-9.!#$%&'*+\-=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(e);
const hash=s=>createHash('sha256').update(s).digest('hex');
const diaMs=86400000;
function dataValida(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
const somarDias=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*diaMs).toISOString().slice(0,10);
export function saidasParaLembrar(ferias,hoje=hojeBrasilia(),limite=10){
  if(!dataValida(hoje))throw new Error('Data de processamento inválida.');
  const saidas=new Map();
  for(const f of ferias){
    if(f.arquivado || !['planejado','confirmado'].includes(f.status) || !f.id || !f.nome)continue;
    for(const p of f.periodos||[]){
      if(!p||!dataValida(p.inicio)||!dataValida(p.fim)||p.fim<p.inicio)continue;
      const antecedencia=Math.round((Date.parse(p.inicio+'T00:00:00Z')-Date.parse(hoje+'T00:00:00Z'))/diaMs);
      if(antecedencia<1||antecedencia>limite)continue;
      const chave=hash(JSON.stringify([f.id,p.inicio]));
      saidas.set(chave,{chave,feriasId:f.id,nome:f.nome,uf:f.regiao||'Não informada',ciclo:f.ciclo||'',status:f.status,inicio:p.inicio,fim:p.fim,retorno:dataValida(p.retorno)&&p.retorno>p.fim?p.retorno:somarDias(p.fim,1),dias:Math.round((Date.parse(p.fim+'T00:00:00Z')-Date.parse(p.inicio+'T00:00:00Z'))/diaMs)+1,antecedencia});
    }
  }
  return [...saidas.values()].sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.nome.localeCompare(b.nome,'pt-BR'));
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=s=>s.split('-').reverse().join('/');
export function montarLembreteFerias(saidas,painel='',alteracoes=[]){
  const assunto=alteracoes.length?'Férias da equipe — programação atualizada':`Férias da equipe — ${saidas.length} ${saidas.length===1?'saída próxima':'saídas próximas'}`;
  const linhas=saidas.map(s=>`${s.nome} · ${s.uf} · ${s.status==='confirmado'?'Confirmado':'Planejado'}\nSaída: ${data(s.inicio)} (em ${s.antecedencia} ${s.antecedencia===1?'dia':'dias'})\nPeríodo: ${data(s.inicio)} a ${data(s.fim)} · ${s.dias} dias corridos\nRetorno: ${data(s.retorno)}`);
  const texto=[assunto,'','Você solicitou lembretes das férias da equipe.',...linhas.flatMap(l=>['',l]),...alteracoes.flatMap(a=>['',`ALTERAÇÃO — ${a.depois?.nome||a.antes?.nome||a.nome}`,`O que mudou: ${camposAlterados(a.antes,a.depois).join(', ')}.`,...(a.antes?['Antes:',resumoProgramacao(a.antes)]:[]),'Agora:',resumoProgramacao(a.depois)]),'','O lembrete inicial segue a antecedência escolhida na sua inscrição. Alterações posteriores nas férias já avisadas geram uma atualização na próxima verificação após o horário de envio, mesmo se a nova saída estiver fora desse prazo.','As informações refletem a programação atual. Consulte o painel para acompanhar alterações.','Para alterar o endereço ou desativar o recebimento, abra Férias da equipe → Lembretes por e-mail.',...(painel?['',painel+'#ferias']:[])].join('\n');
  const cartoes=saidas.map(s=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-cartao" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;border-bottom:1px solid #dddddd"><tr><td style="padding:0 0 24px;font-family:Arial,Helvetica,sans-serif">
    <p class="email-secundario" style="margin:0 0 10px;color:#555555;font-size:12px;font-weight:700;letter-spacing:1px;line-height:1.5">${s.antecedencia===1?'SAÍDA AMANHÃ':`SAÍDA EM ${esc(s.antecedencia)} DIAS`}</p>
    <h2 class="email-pessoa email-texto" style="margin:0 0 8px;color:#111111;font-size:22px;line-height:1.35;overflow-wrap:anywhere;word-break:break-word">${esc(s.nome)}</h2>
    <p class="email-secundario" style="margin:0 0 20px;color:#555555;font-size:14px;line-height:1.6">${esc(s.uf)} · ${s.status==='confirmado'?'Confirmado':'Planejado'}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">
    <tr><td width="90" valign="top" class="email-secundario" style="width:90px;padding:7px 12px 7px 0;color:#555555">Saída</td><td valign="top" class="email-texto email-data" style="padding:7px 0;color:#111111;font-weight:700">${esc(data(s.inicio))}</td></tr>
    <tr><td width="90" valign="top" class="email-secundario" style="width:90px;padding:7px 12px 7px 0;color:#555555">Último dia</td><td valign="top" class="email-texto" style="padding:7px 0;color:#111111">${esc(data(s.fim))}</td></tr>
    <tr><td width="90" valign="top" class="email-secundario" style="width:90px;padding:7px 12px 7px 0;color:#555555">Retorno</td><td valign="top" class="email-texto" style="padding:7px 0;color:#111111;font-weight:700">${esc(data(s.retorno))}</td></tr>
    <tr><td width="90" valign="top" class="email-secundario" style="width:90px;padding:7px 12px 7px 0;color:#555555">Duração</td><td valign="top" class="email-texto" style="padding:7px 0;color:#111111">${esc(s.dias)} ${s.dias===1?'dia corrido':'dias corridos'}</td></tr>
    </table></td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td height="28" style="height:28px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`).join('');
  const revisoes=alteracoes.map(a=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #dddddd"><tr><td style="padding:0 0 24px;font-family:Arial,Helvetica,sans-serif"><p class="email-secundario" style="margin:0 0 10px;color:#555555;font-size:12px;font-weight:700;letter-spacing:1px">PROGRAMAÇÃO ATUALIZADA</p><h2 class="email-pessoa email-texto" style="margin:0 0 12px;color:#111111;font-size:22px;line-height:1.35;overflow-wrap:anywhere">${esc(a.depois?.nome||a.antes?.nome||a.nome)}</h2><p class="email-texto" style="margin:0 0 20px;color:#111111;font-size:15px;line-height:1.7">O que mudou: <strong>${esc(camposAlterados(a.antes,a.depois).join(', '))}</strong>.</p>${a.antes?`<p class="email-secundario" style="margin:0 0 20px;color:#555555;font-size:14px;line-height:1.8"><strong>Antes</strong><br>${esc(resumoProgramacao(a.antes)).replace(/\n/g,'<br>')}</p>`:''}<p class="email-texto" style="margin:0;color:#111111;font-size:14px;line-height:1.8"><strong>Agora</strong><br>${esc(resumoProgramacao(a.depois)).replace(/\n/g,'<br>')}</p></td></tr></table><p style="margin:0;height:28px;font-size:1px;line-height:1px">&nbsp;</p>`).join('');
  const html=layoutEmailFerias({titulo:alteracoes.length?'Programação atualizada':'Férias da equipe',resumo:alteracoes.length?'Houve alteração nas férias que você já recebeu por e-mail. Confira a programação atualizada.':`${saidas.length} ${saidas.length===1?'colaborador com saída próxima.':'colaboradores com saída próxima.'} Confira as datas para planejar a cobertura da equipe.`,painel,conteudo:revisoes+cartoes+'<p class="email-secundario" style="margin:0;color:#555555;font-size:13px;line-height:1.7">O lembrete inicial segue a antecedência escolhida, em dias corridos. Alterações nas férias já avisadas geram uma atualização na próxima verificação após o horário de envio, inclusive cancelamentos e mudanças para fora dessa antecedência.</p>'});
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
export async function processarLembretes({db,transporte,remetente,hoje=hojeBrasilia(),painel='',simular=false,agora=()=>new Date().toISOString(),horario=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}){
  const ferias=await db.collection('ferias').get();
  const registros=new Map(ferias.docs.map(s=>[s.id,{...s.data(),id:s.id}]));
  const saidas=saidasParaLembrar([...registros.values()],hoje,90);
  const destinatarios=await destinatariosLembretes(db);
  const resultado={destinatarios:destinatarios.size,saidas:saidas.length,enviados:0,ignorados:0,pendentes:0,falhas:0};
  if(!destinatarios.size||simular)return resultado;
  await transporte.verify();
  for(const [email,inscricoes] of destinatarios){
    const validas=await Promise.all(inscricoes.map(async s=>{
      const [atual,p]=await Promise.all([db.doc(`lembretes_ferias/${s.id}`).get(),db.doc(`usuarios/${s.titular}`).get()]);
      const d=atual.data(),perfil=p.data();return d?.ativo && d.email?.toLowerCase()===email && d.titular===s.titular && perfil?.ativo && ['usuario','administrador'].includes(perfil.perfil) && horario>=(d.horario||'07:55') ? (Number.isInteger(d.antecedencia)&&d.antecedencia>=1&&d.antecedencia<=90?d.antecedencia:10) : 0;
    }));
    if(!validas.some(Boolean))continue;
    const anteriores=await db.collection('envios_lembretes_ferias').where('email','==',email).get();
    const historico=anteriores.docs.map(d=>d.data());
    const ids=new Set([...saidas.map(s=>s.feriasId),...historico.filter(d=>d.estado==='enviado').map(d=>d.feriasId)]);
    // Cada colaborador fica em um único lote, inclusive quando tem vários períodos.
    const grupos=[];let grupo=[],peso=0;
    for(const id of [...ids].sort()){
      const custo=Math.max(1,saidas.filter(s=>s.feriasId===id).length);
      if(peso+custo>20&&grupo.length){grupos.push(grupo);grupo=[];peso=0;}
      grupo.push(id);peso+=custo;
    }
    if(grupo.length)grupos.push(grupo);
    for(const idsLote of grupos){
      const lote=randomUUID(),outbox=db.doc(`caixa_lembretes_ferias/${lote}`);
      const reserva=await db.runTransaction(async tx=>{
        // Releitura transacional evita avisar datas que já foram canceladas ou alteradas.
        const estadosRefs=idsLote.map(id=>db.doc(`acompanhamento_lembretes_ferias/${hash(email+'|'+id)}`));
        const feriasRefs=idsLote.map(id=>db.doc('ferias/'+id));
        const ler=refs=>tx.getAll?tx.getAll(...refs):Promise.all(refs.map(r=>tx.get(r)));
        const assinaturas=await ler(inscricoes.map(s=>db.doc('lembretes_ferias/'+s.id)));
        const perfis=await ler(inscricoes.map(s=>db.doc('usuarios/'+s.titular)));
        const limites=assinaturas.map((s,i)=>{
          const d=s.data(),p=perfis[i].data();
          return d?.uid===inscricoes[i].id&&d.ativo&&d.email?.toLowerCase()===email&&d.titular===inscricoes[i].titular&&p?.ativo&&['usuario','administrador'].includes(p.perfil)&&horario>=(d.horario||'07:55')?(Number.isInteger(d.antecedencia)&&d.antecedencia>=1&&d.antecedencia<=90?d.antecedencia:10):0;
        });
        if(!limites.some(Boolean))return {eventos:[],novos:[],estadosEnvio:[],pendentes:0};
        const estados=await ler(estadosRefs),atuais=await ler(feriasRefs);
        const elegiveis=saidasParaLembrar(atuais.filter(s=>s.exists).map(s=>({...s.data(),id:s.id})),hoje,Math.max(...limites));
        const refs=elegiveis.map(s=>db.doc(`envios_lembretes_ferias/${hash(email+'|'+s.chave)}`));
        const snapshots=await ler(refs);
        const eventos=[],novos=[],estadosEnvio=[];let pendentes=0;
        for(let i=0;i<idsLote.length;i++){
          const id=idsLote[i],estado=estados[i].data(),f=atuais[i].exists?atuais[i].data():null;
          if(estado&&['em_envio','incerto'].includes(estado.estado)){pendentes++;continue;}
          const atual=programacaoFerias(f),legados=historico.filter(d=>d.feriasId===id&&d.estado==='enviado');
          let anterior=estado?.programacao??null;
          let avisado=estado?.avisado===true||legados.length>0;
          // Registros antigos só continham a saída. Não inventa uma versão anterior:
          // usa a data da edição para reconhecer mudanças posteriores ao envio antigo.
          let migracaoAlterada=false;
          if(!estado&&legados.length){
            const ultimo=legados.map(d=>Date.parse(d.atualizadoEm)).filter(Number.isFinite).sort((a,b)=>b-a)[0];
            const editado=f?.atualizadoEm?.toDate?f.atualizadoEm.toDate().getTime():f?.atualizadoEm instanceof Date?f.atualizadoEm.getTime():Date.parse(f?.atualizadoEm);
            migracaoAlterada=!f||f.arquivado||f.status==='cancelado'||(Number.isFinite(ultimo)&&Number.isFinite(editado)&&editado>ultimo);
            if(!migracaoAlterada)anterior=atual;
          }
          const mudou=avisado&&(migracaoAlterada||!mesmaProgramacao(anterior,atual));
          const indices=elegiveis.map((s,j)=>s.feriasId===id?j:-1).filter(j=>j>=0);
          const pend=indices.filter(j=>snapshots[j].exists&&['em_envio','incerto'].includes(snapshots[j].data().estado));
          if(pend.length){pendentes+=pend.length;continue;}
          const indicesNovos=indices.filter(j=>!snapshots[j].exists||snapshots[j].data().estado==='falhou');
          if(!mudou&&!indicesNovos.length){
            if(!estado&&avisado)tx.set(estadosRefs[i],{email,feriasId:id,avisado:true,programacao:atual,estado:'enviado',atualizadoEm:agora()});
            continue;
          }
          // Alterações de férias já avisadas não dependem de a nova saída continuar
          // na janela de antecedência (cancelamentos e exclusões também entram).
          if(mudou)eventos.push({antes:anterior,depois:atual,nome:f?.nome||legados[0]?.nome||'Colaborador'});
          else for(const j of indicesNovos)novos.push(elegiveis[j]);
          const refsNovos=indicesNovos.map(j=>refs[j]);
          for(const j of indicesNovos)tx.set(refs[j],{email,feriasId:id,inicio:elegiveis[j].inicio,nome:elegiveis[j].nome,estado:'em_envio',lote,atualizadoEm:agora()});
          tx.set(estadosRefs[i],{email,feriasId:id,avisado,programacao:anterior,programacaoPendente:atual,estado:'em_envio',lote,atualizadoEm:agora()});
          estadosEnvio.push({ref:estadosRefs[i],programacao:atual,refsNovos});
        }
        if(estadosEnvio.length)tx.set(outbox,{email,estado:'em_envio',hoje,quantidade:novos.length+eventos.length,criadoEm:agora()});
        return {eventos,novos,estadosEnvio,pendentes};
      });
      resultado.pendentes+=reserva.pendentes;
      if(!reserva.estadosEnvio.length){resultado.ignorados+=idsLote.length;continue;}
      const aviso=montarLembreteFerias(reserva.novos,painel,reserva.eventos);
      try{
        const info=await transporte.sendMail({from:{name:'Férias da equipe',address:remetente},to:{address:email},subject:aviso.assunto,text:aviso.texto,html:aviso.html,messageId:`<ferias-${lote}@${remetente.split('@')[1]}>`});
        if(!info.accepted?.some(e=>String(e).toLowerCase()===email))throw Object.assign(new Error('Entrega não aceita pelo servidor de e-mail.'),{code:'EENVELOPE'});
        const batch=db.batch();
        for(const e of reserva.estadosEnvio){
          for(const ref of e.refsNovos)batch.update(ref,{estado:'enviado',atualizadoEm:agora()});
          batch.update(e.ref,{estado:'enviado',avisado:true,programacao:e.programacao,programacaoPendente:null,atualizadoEm:agora()});
        }
        batch.update(outbox,{estado:'enviado',atualizadoEm:agora()});await batch.commit();resultado.enviados++;
      }catch(e){
        const certoNaoEnviado=['EAUTH','EENVELOPE','EMESSAGE'].includes(e.code)||Number(e.responseCode)>=400;
        const estado=certoNaoEnviado?'falhou':'incerto';
        const batch=db.batch();
        for(const e of reserva.estadosEnvio){for(const ref of e.refsNovos)batch.update(ref,{estado,atualizadoEm:agora()});batch.update(e.ref,{estado,atualizadoEm:agora()});}
        batch.update(outbox,{estado,atualizadoEm:agora(),codigo:certoNaoEnviado?'smtp_rejeitado':'resultado_nao_confirmado'});await batch.commit();
        resultado.falhas++;if(!certoNaoEnviado)resultado.pendentes++;
      }
    }
  }
  return resultado;
}
