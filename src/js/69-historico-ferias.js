/* Histórico legível: versões recentes primeiro, diferenças e fotografia do cadastro. */
function periodoHistoricoFerias(p) {
  return p ? `${fmtData(p.inicio)} a ${fmtData(p.fim)} · ${diasFerias(p)} dias · retorno ${fmtData(retornoFerias(p))}${p.retorno?' (ajustado)':''}` : 'Não programado';
}
function diferencasHistoricoFerias(atual, anterior) {
  if (!anterior || anterior.versao !== atual.versao-1) return null;
  const status={planejado:'Planejado',confirmado:'Confirmado',cancelado:'Cancelado'};
  const campos=[['nome','Nome',v=>v||'Não informado'],['matricula','Matrícula',v=>v||'Não informada'],['regiao','Região',v=>v||'Não informada'],['area','Área',v=>AREAS_FERIAS[v]||'Não informada'],['localidade','Localidade',(_,f)=>LOCALIDADES_FERIAS[localidadeFerias(f)]||'Não informada'],['ciclo','Ciclo',v=>v||'Não informado'],['status','Confirmação',v=>status[v]||'Não informada'],['direito','Direito em dias',v=>String(v)],['vendidos','Dias vendidos',v=>String(v)],['arquivado','Situação do cadastro',v=>v?'Retirado':'Ativo'],['obs','Observações',v=>v||'Sem observações']];
  const alteracoes=[];
  for(const [chave,titulo,formatar] of campos){
    const de=formatar(anterior[chave],anterior),para=formatar(atual[chave],atual);
    if(de!==para)alteracoes.push({titulo,de,para});
  }
  for(let i=0;i<Math.max(atual.periodos.length,anterior.periodos.length);i++){
    const de=periodoHistoricoFerias(anterior.periodos[i]),para=periodoHistoricoFerias(atual.periodos[i]);
    if(de!==para)alteracoes.push({titulo:`${i+1}º período`,de,para});
  }
  return alteracoes;
}
function autorHistoricoFerias(d) {
  const por=d.atualizadoPor||{},email=por.email||'';
  if(por.uid==='carga-inicial-ferias'||por.uid==='implantacao'||/@[^@]*\.iam\.gserviceaccount\.com$/i.test(email))return 'Cadastro inicial';
  const nome=E.usuarios?.find(u=>u.email===email)?.nome;
  return nome||email||(por.uid==='demonstracao'?'Demonstração':'Responsável não identificado');
}
function fichaHistoricoFerias(d) {
  const campos=[['Nome',nomeBonito(d.nome)],['Matrícula',d.matricula],['UF',ufFerias(d.regiao)||'Não informada'],['Área e localidade',perfilFerias(d)],['Ciclo',d.ciclo],['Confirmação',{planejado:'Planejado',confirmado:'Confirmado',cancelado:'Cancelado'}[d.status]],['Dias programados',d.periodos.reduce((s,p)=>s+diasFerias(p),0)],['Dias vendidos',d.vendidos],['Direito em dias',d.direito]];
  return `<dl class="ferias-historico-ficha">${campos.map(([n,v])=>`<div><dt>${esc(n)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="ferias-historico-periodos">${d.periodos.map((p,i)=>`<div><strong>${i+1}º período</strong><span>${esc(periodoHistoricoFerias(p))}</span></div>`).join('')||'<p>Nenhum período programado nesta versão.</p>'}</div>${d.obs?`<div class="ferias-historico-observacao"><strong>Observações</strong><p>${esc(d.obs)}</p></div>`:''}`;
}
async function abrirHistoricoFerias(id) {
  const docs=await Armazem.consultar('historico_ferias',{onde:[['id','==',id]]});
  docs.sort((a,b)=>b.versao-a.versao);
  const cadastro=E.ferias.find(f=>f.id===id)||docs[0];
  const m=abrirModal({titulo:'Histórico de férias',subtitulo:cadastro?`${nomeBonito(cadastro.nome)} · Matrícula ${cadastro.matricula} · Ciclo ${cadastro.ciclo}`:'Cadastro de férias',largura:'larga historico-ferias-modal',corpo:docs.length?`<div class="ferias-historico"><p class="ferias-historico-resumo">${docs.length} ${docs.length===1?'registro':'registros'} · Mais recentes primeiro · Horário de Brasília</p><ol>${docs.map((d,i)=>{
    const anterior=docs[i+1],alteracoes=diferencasHistoricoFerias(d,anterior);
    const titulo=d.versao===1?'Cadastro inicial':anterior&&d.arquivado!==anterior.arquivado?(d.arquivado?'Colaborador retirado':'Colaborador reativado'):anterior&&d.status==='cancelado'&&anterior.status!=='cancelado'?'Férias canceladas':alteracoes?.some(a=>a.titulo.endsWith('período'))?'Períodos de férias alterados':'Cadastro atualizado';
    const quando=d.atualizadoEm?`${fmtData(d.atualizadoEm)} às ${d.atualizadoEm.slice(11,16)}`:'Data não informada';
    return `<li class="ferias-historico-evento"><header><div><h3>${esc(titulo)}</h3><p>${esc(autorHistoricoFerias(d))}</p></div><div class="ferias-historico-quando"><strong>${esc(quando)}</strong><span>Registro ${d.versao}</span></div></header>${alteracoes?alteracoes.length?`<ul class="ferias-historico-mudancas">${alteracoes.map(a=>`<li><strong>${esc(a.titulo)}</strong><div><span class="antes"><small>Antes</small>${esc(a.de)}</span><span class="depois"><small>Depois</small>${esc(a.para)}</span></div></li>`).join('')}</ul>`:'<p class="nota">Informações do cadastro mantidas.</p>':d.versao===1?'':'<p class="nota">A versão anterior não está disponível para comparação.</p>'}<details ${d.versao===1?'open':''}><summary>Ver cadastro completo deste registro</summary>${fichaHistoricoFerias(d)}</details></li>`;
  }).join('')}</ol></div>`:vazio('calendario','Nenhuma alteração registrada','O histórico será exibido após salvar o cadastro.'),rodape:'<button class="btn" data-fechar>Fechar histórico</button>'});
  return m;
}
