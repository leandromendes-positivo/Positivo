/* Confirmação por e-mail: a previsão identifica as quantidades, sem baixar estoque. */
const chaveNovaCobranca = i => `nova-${hash36([i.tid,i.regiao,i.mat].join('|'))}`;
function referenciaSaidas() {
  return { dataReferencia: hojeISO(), lotesReferencia: [...new Set([...E.importacoes.filter(i => i.em?.slice(0,10) === hojeISO()).map(i=>i.id), ...E.movimentos.filter(i=>i.em?.slice(0,10)===hojeISO()).map(i=>i.lote), ...E.devolucoes.filter(i=>i.em?.slice(0,10)===hojeISO()).map(i=>i.lote)])].filter(Boolean) };
}
function corteHistoricoAcompanhamento() {
  const datas = [...E.agendamentos.filter(a => a.previsao).map(a => a.confirmacao?.dataReferencia), ...E.contatos.map(c => c.referencia?.dataReferencia)].filter(Boolean);
  return [somaDias(hojeISO(), -120), ...datas].sort()[0];
}
let indicePrevisoes = {rev:-1};
function indicesPrevisoes() {
  if(indicePrevisoes.rev!==E.rev){
    const saidas=new Map();
    for(const [tipo,lista] of [['usadas',E.devolucoes],['novas',E.movimentos]])for(const s of lista){const k=[tipo,s.tid,s.regiao,tipo==='novas'?s.mat:s.k].join('|');if(!saidas.has(k))saidas.set(k,[]);saidas.get(k).push(s);}
    indicePrevisoes={rev:E.rev,agendas:new Map(E.agendamentos.map(a=>[a.peca,a])),saidas};
  }
  return indicePrevisoes;
}
function quantidadeSaidaDesde(i, referencia) {
  if (!referencia?.dataReferencia) return 0;
  const saidas = indicesPrevisoes().saidas.get([i.tipo,i.tid,i.regiao,i.tipo==='novas'?i.mat:i.k].join('|')) || [];
  return somar(saidas.filter(s => s.tid === i.tid && s.regiao === i.regiao && (i.tipo === 'novas' ? s.mat === i.mat : s.k === i.k)
    && s.em?.slice(0,10) >= referencia.dataReferencia && !(referencia.lotesReferencia || []).includes(s.lote)), s=>s.qtd);
}
function previsaoDaPeca(i) {
  const a = indicesPrevisoes().agendas.get(i.k), c = a?.confirmacao;
  const legado = E.acomp[i.tid]?.itens?.[i.k];
  const data = a ? a.previsao : legado?.p || '';
  const quantidade = !data ? 0 : c ? Math.min(i.qtd,Math.max(0,c.quantidade-quantidadeSaidaDesde(i,c))) : i.qtd;
  return { previsao: quantidade ? data : '', qtdPrevista: quantidade, confirmacao: c || null, versaoAgenda: a?.versao || 0,
    agendadoPor: a ? {uid:a.uid,email:a.email} : legado?.agendadoPor || null, agendadoEm: a?.em || legado?.agendadoEm || '' };
}
function novasParaCobranca(t) {
  return [...agrupar(t.novasLinhas, i=>[i.regiao,i.mat].join('|')).values()].map(grupo=>{
    const i = {...grupo[0], tipo:'novas', qtd:somar(grupo,i=>i.qtd), dias:Math.max(...grupo.map(i=>i.dias)), nome:t.nome, tipoTec:t.tipo, prazo:t.prazoNovas,
      chavesAntigas:grupo.map(n=>`nova-${hash36(n.tid+'|'+n.mat+'|'+(n.tipoEnvio||''))}`), tiposEnvio:[...new Set(grupo.map(i=>i.tipoEnvio))].join(', '), alerta:Math.max(0,t.prazoNovas-(t.prazo-t.alerta))};
    i.k=chaveNovaCobranca(i); Object.assign(i,previsaoDaPeca(i));
    i.status=statusUsada(i.dias,i.qtdPrevista===i.qtd?i.previsao:'',{prazo:i.prazo,alerta:i.alerta},hojeISO());
    i.atraso=Math.max(0,i.dias-i.prazo);i.atrasada=i.atraso>0;
    i.ultimaCobranca=E.acomp[i.tid]?.itens?.[i.k]?.uc || '';
    return i;
  });
}
function pecasCobranca(t, tipo = 'usadas') {
  return [...(tipo !== 'novas' ? t.usadas.map(i=>({...i,tipo:'usadas'})) : []), ...(tipo !== 'usadas' ? novasParaCobranca(t) : [])];
}
function selecionarAbaCobranca(itens, aba, hoje) {
  return itens.flatMap(i=>{
    const agendada = i.qtdPrevista ?? (i.previsao ? i.qtd : 0), livre = i.qtd-agendada;
    let qtd = i.qtd;
    if (aba==='sem_previsao') qtd=livre;
    if (aba==='cobrar') qtd=(i.previsao&&i.previsao<hoje ? agendada : 0) + (i.dias>i.prazo ? livre : 0);
    if (aba==='vencidas') qtd=i.previsao&&i.previsao<hoje ? agendada : 0;
    if (aba==='aguardando') qtd=i.previsao&&i.previsao>=hoje ? agendada : 0;
    if (aba==='previsoes') qtd=i.previsao===hoje ? agendada : 0;
    if (aba==='vencendo') qtd=i.dias>=i.alerta&&i.dias<=i.prazo ? livre : 0;
    return qtd>0 ? [{...i,qtd,qtdTotal:i.qtd}] : [];
  });
}
function itensAgendaCompleta(D=derivar()) {
  return D.tecnicos.flatMap(t=>pecasCobranca(t,'todas')).filter(i=>i.previsao&&i.qtdPrevista>0).map(i=>({...i,qtd:i.qtdPrevista,qtdTotal:i.qtd}));
}
function descricaoConfirmacao(i) {
  const c=i.confirmacao;
  if (!c) return i.tipo==='novas' ? 'Nova · condição não informada' : 'Usada';
  if(c.tipo==='usadas')return 'Usada';
  const novas=c.quantidade-c.qtdRmdf;
  return (i.qtdPrevista<c.quantidade?'Condição na confirmação original: ':'') + [novas?`${plural(novas,'nova','novas')}`:'',c.qtdRmdf?`${c.qtdRmdf} com RMDF aplicado`:''].filter(Boolean).join(' · ');
}
const compararContatos = (a,b) => comparar(b.em,a.em) || (b.ordem||0)-(a.ordem||0) || comparar(b.id,a.id);
function emailsFormais(tid) { return E.contatos.filter(c=>c.tid===tid&&c.canal==='email').sort(compararContatos); }
function contatoInclui(c,i) {
  return c.itens.includes(i.k) || (i.tipo==='novas' && (i.chavesAntigas||[]).some(k=>c.itens.includes(k)));
}
function acompanhamentoRespostas(D=derivar(), tipo='todas') {
  const linhas=[],porTecnico=agrupar(E.contatos,c=>c.tid);
  for(const contatos of porTecnico.values())contatos.sort(compararContatos);
  for(const t of D.tecnicos)for(const i of pecasCobranca(t,tipo)){
    const contatos=(porTecnico.get(t.tid)||[]).filter(c=>contatoInclui(c,i));
    const email=contatos.find(c=>c.canal==='email'),aviso=contatos.find(c=>c.canal==='whatsapp');
    const confirmado=i.confirmacao&&i.previsao&&i.qtdPrevista>0;
    const detalhes=email?.detalhes?.find(d=>d.k===i.k);
    const cobrada=email ? Math.min(i.qtd, Math.max(0,(detalhes?.qtd ?? i.qtd)-quantidadeSaidaDesde(i,email.referencia))) : i.qtd;
    const atendida=confirmado && (i.confirmacao.contatoId===email?.id || i.agendadoEm>email?.em) ? i.qtdPrevista : 0;
    if(email&&cobrada>atendida)linhas.push({...i,qtd:cobrada-atendida,estadoResposta:'aguardando',contato:email,diasResposta:Math.max(0,diffDias(email.em.slice(0,10),D.hoje))});
    if(!email&&aviso&&!confirmado)linhas.push({...i,estadoResposta:'formalizar',contato:aviso,diasResposta:Math.max(0,diffDias(aviso.em.slice(0,10),D.hoje))});
    if(confirmado)linhas.push({...i,qtd:i.qtdPrevista,estadoResposta:i.previsao<D.hoje?'vencida':'confirmada',contato:email,diasResposta:0});
  }
  return linhas;
}
function dadosConfirmacao(i, quantidade, qtdRmdf, contatoId, referenciaEmail, observacao='') {
  const tipo=i.tipo==='novas'?'novas':'usadas';
  const contato=E.contatos.find(c=>c.id===contatoId&&c.tid===i.tid&&c.canal==='email');
  const falhar=m=>{throw Object.assign(new Error(m),{amigavel:true});};
  if(!contato)falhar('Registre primeiro a cobrança formal por e-mail para este técnico.');
  if(!referenciaEmail.trim())falhar('Informe uma referência ao e-mail de confirmação do técnico.');
  if(!Number.isInteger(quantidade)||quantidade<1||quantidade>i.qtd)falhar('A quantidade confirmada deve estar entre 1 e o saldo da peça.');
  if(!Number.isInteger(qtdRmdf)||qtdRmdf<0||qtdRmdf>quantidade||(tipo==='usadas'&&qtdRmdf))falhar('Confira a quantidade de peças novas com RMDF.');
  return {tipo,mat:String(i.mat),regiao:i.regiao,quantidade,qtdRmdf,contatoId,referenciaEmail:referenciaEmail.trim().slice(0,200),observacao:observacao.trim().slice(0,300),...referenciaSaidas()};
}
