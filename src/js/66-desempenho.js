/* Rankings auditáveis. Os gráficos mantêm valores e ações disponíveis por teclado. */
const UIranking = { tipo: 'usadas', periodo: 'semana', regiao: '' };
function rankLinhas(lista, modo, limite = 5) {
  if (!lista.length) return vazio(modo === 'atraso' ? 'ok' : 'grafico', modo === 'atraso' ? 'Nenhum atraso identificado' : modo === 'pontualidade' ? 'Aguardando devoluções no prazo' : 'Sem uso registrado no período', modo === 'atraso' ? 'Não há peças acima do prazo nos dados deste recorte.' : 'O ranking aparece quando houver registros suficientes.');
  const max = modo === 'atraso' ? lista[0].atrasadas : modo === 'uso' ? lista[0].uso : 1;
  return `<ol class="ranking-lista">${lista.slice(0, limite).map((t, n) => {
    const valor = modo === 'atraso' ? t.atrasadas : modo === 'uso' ? t.uso : t.taxa;
    const legenda = modo === 'atraso' ? `${plural(t.abertas, 'pendente', 'pendentes')} · até ${t.maiorAtraso} dias de atraso` : modo === 'pontualidade' ? `${fmtNum(t.noPrazo)} de ${plural(t.devolvidas, 'peça devolvida', 'peças devolvidas')} no prazo` : `${plural(t.materiais.size, 'material diferente', 'materiais diferentes')}`;
    const materiais = modo === 'uso' ? [...t.materiais.values()].sort((a,b) => b.qtd-a.qtd).slice(0,2) : [];
    return `<li style="--ordem-rank:${n}"><button class="rank-item" data-acao="ranking-detalhe" data-tid="${esc(t.tid)}" data-modo="${modo}" aria-label="${esc(t.nome)}: ${modo === 'pontualidade' ? fmtNum1(valor*100) + '% no prazo' : plural(valor, 'peça', 'peças')}. Ver detalhes">
      <span class="rank-posicao">${String(n+1).padStart(2,'0')}</span><span class="rank-conteudo"><span class="rank-identidade"><strong>${esc(t.nome)}</strong><span>${esc(t.regiao)}</span></span>
      <span class="rank-legenda">${legenda}</span><span class="rank-trilho" aria-hidden="true"><i style="--largura:${Math.max(0, Math.min(100,valor/max*100))}%"></i></span>
      ${materiais.length ? `<span class="rank-materiais">${materiais.map((m) => `<span title="${esc(m.desc)}">${esc(familiaPeca(m.desc))}<b>${fmtNum(m.qtd)}</b></span>`).join('')}</span>` : ''}</span>
      <span class="rank-numero">${modo === 'pontualidade' ? fmtNum1(valor*100) + '<small>%</small>' : fmtNum(valor)}<small>${modo === 'pontualidade' ? 'no prazo' : 'peças'}</small></span>${icone('direita')}
    </button></li>`;
  }).join('')}</ol>${lista.length > limite ? `<button class="btn fantasma rank-ver-todos" data-acao="ranking-completo" data-modo="${modo}">Ver todos · ${plural(lista.length,'técnico','técnicos')}${icone('direita')}</button>` : ''}`;
}
function renderRankings(D) {
  const r = calcularDesempenho(UIranking, D), novas = UIranking.tipo === 'novas';
  const prazo = novas ? Number(D.cfg.prazoNovas) || 7 : D.cfg.prazo;
  const seg = (campo, opcoes) => `<div class="filtros-segmentados" role="group" aria-label="${campo === 'tipo' ? 'Tipo de peça do ranking' : 'Período do ranking'}">${opcoes.map(([v,n]) => `<button type="button" data-acao="ranking-filtro" data-campo="${campo}" data-valor="${v}" class="${UIranking[campo] === v ? 'ativo' : ''}" aria-pressed="${UIranking[campo] === v}">${n}</button>`).join('')}</div>`;
  const totalAtraso = somar(r.atraso, (t) => t.atrasadas), totalDev = somar(r.lista,(t) => t.devolvidas), emDia = somar(r.lista,(t) => t.noPrazo), totalUso = somar(r.uso,(t) => t.uso);
  return `<section class="desempenho" aria-labelledby="titulo-desempenho">
    <header class="desempenho-topo"><div><span class="sobretitulo">DESEMPENHO DA EQUIPE</span><h2 id="titulo-desempenho">Prazos, devoluções e uso de peças</h2><p>${fmtData(r.inicio)} a ${fmtData(r.fim)} · ${novas ? 'Novas · prazo observado' : 'Usadas · prioridade de cobrança'} de ${prazo} dias</p></div>
    <div class="ranking-filtros">${seg('periodo', [['semana','Esta semana'],['mes','Este mês']])}${seg('tipo',[['usadas','Usadas · prioritárias'],['novas','Novas']])}<select data-mudar="ranking-regiao" aria-label="UF dos rankings"><option value="">Todas as UFs</option>${D.regioes.map((uf) => `<option value="${uf}" ${UIranking.regiao === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select></div></header>
    <div class="ranking-grade">
      ${cartao('Maior volume em atraso', `<div class="rank-resumo"><strong>${fmtNum(totalAtraso)}</strong><span>peças acima do prazo<br>com ${plural(r.atraso.length, 'técnico', 'técnicos')}</span>${icone('relogio')}</div>${rankLinhas(r.atraso,'atraso')}`, { sub: 'Pendências e devoluções atrasadas no período.', classe: 'ranking-cartao ranking-atraso' })}
      ${cartao('Devoluções em dia', `<div class="rank-resumo"><strong>${totalDev ? fmtNum1(emDia/totalDev*100) + '<small>%</small>' : '—'}</strong><span>${fmtNum(emDia)} de ${plural(totalDev, 'peça devolvida', 'peças devolvidas')}<br>dentro do prazo</span><svg class="rank-anel" viewBox="0 0 44 44" aria-hidden="true"><circle class="anel-fundo" cx="22" cy="22" r="17"/><circle class="anel-valor" cx="22" cy="22" r="17" pathLength="100" style="--deslocamento:${totalDev ? 100-emDia/totalDev*100 : 100}"/></svg></div>${rankLinhas(r.pontualidade,'pontualidade')}`, { sub: 'Maior pontualidade; volume desempata.', classe: 'ranking-cartao ranking-pontualidade' })}
      ${cartao('Uso por técnico', `<div class="rank-resumo"><strong>${fmtNum(totalUso)}</strong><span>${novas ? 'peças com uso confirmado' : 'peças trocadas por Data FT'}<br>por ${plural(r.uso.length, 'técnico', 'técnicos')}</span>${icone('grafico')}</div>${rankLinhas(r.uso,'uso')}`, { sub: novas ? 'Baixas classificadas como uso em atendimento.' : 'Trocas registradas, com materiais e quantidades.', classe: 'ranking-cartao ranking-uso' })}
    </div>
    <div class="ranking-nota">${icone('info')}<p>${novas ? 'Novas: o prazo conta da primeira observação do material no estoque, não da data de recebimento. Baixas só entram como devolução ou uso após classificação.' : 'Atraso conta peças, sem repetir as fotos diárias. Pontualidade considera somente peças devolvidas. Uso considera a Data FT, sem repetir a peça após a devolução.'}${r.semData ? ` ${plural(r.semData, 'registro sem Data FT fica', 'registros sem Data FT ficam')} fora do indicador de uso.` : ''} Clique em um técnico para conferir as peças. Mostrando os 5 primeiros de cada ranking.</p></div>
    ${novas ? `<div class="ranking-pendencias"><span>${icone('arquivo')}<strong>${plural(somar(r.pendentes,(m) => m.qtd), 'peça com saída a classificar', 'peças com saída a classificar')}</strong><small>Neste período. As baixas começam a ser registradas nas próximas importações.</small></span><button class="btn pequeno" data-acao="consultar-saidas">Conferir saídas${icone('direita')}</button></div>` : ''}
  </section>`;
}
function modalRanking(tid, modo) {
  const r = calcularDesempenho(UIranking), t = r.lista.find((t) => t.tid === tid);
  if (!t || !['atraso','pontualidade','uso'].includes(modo)) return;
  const itens = t.evidencias[modo];
  const titulos = { atraso: 'Peças em atraso', pontualidade: 'Pontualidade das devoluções', uso: 'Materiais utilizados' };
  const total = somar(itens, (i) => i.qtd);
  const materiais = [...agrupar(itens,(i) => i.mat)].map(([mat, lista]) => ({ mat, desc: E.catalogo[mat] || '', qtd: somar(lista,(i) => i.qtd) })).sort((a,b) => b.qtd-a.qtd);
  const max = Math.max(1,...materiais.map((m) => m.qtd));
  abrirModal({ titulo: t.nome, subtitulo: `${titulos[modo]} · ${fmtData(r.inicio)} a ${fmtData(r.fim)}`, largura: 'larga',
    corpo: `<div class="rank-detalhe-resumo">${pill(UIranking.tipo === 'usadas' ? 'crit' : 'info', UIranking.tipo === 'usadas' ? 'Usadas' : 'Novas')}<strong>${plural(total,'peça','peças')}</strong><span>${plural(materiais.length,'material','materiais')} · ${esc(t.regiao)}</span></div>
    <div class="rank-distribuicao">${materiais.map((m) => `<div><span><strong>${esc(m.mat)}</strong> ${esc(m.desc || 'Sem descrição')}</span><b>${fmtNum(m.qtd)}</b><i style="--largura:${m.qtd/max*100}%" aria-hidden="true"></i></div>`).join('')}</div>
    <div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Material</th><th>Chamado</th><th>Qtd.</th><th>Data</th><th>Situação</th></tr></thead><tbody>${itens.map((i) => `<tr><td class="mono">${esc(i.mat)}</td><td>${esc(i.chamado || '—')}</td><td class="num">${fmtNum(i.qtd)}</td><td class="nowrap">${i.data ? fmtData(i.data) : 'Em aberto'}</td><td>${esc(i.detalhe)}${i.atraso ? ` · ${i.atraso} dias` : ''}</td></tr>`).join('')}</tbody></table></div>`,
    rodape: '<button class="btn" data-fechar>Fechar</button>' });
}

function modalRankingCompleto(modo) {
  if (!['atraso','pontualidade','uso'].includes(modo)) return;
  const r = calcularDesempenho(UIranking);
  const nomes = { atraso:'Maior volume em atraso', pontualidade:'Devoluções em dia', uso:'Uso por técnico' };
  const cores = { atraso:'crit', pontualidade:'good', uso:'info' };
  abrirModal({ titulo: nomes[modo], subtitulo: `${plural(r[modo].length,'técnico','técnicos')} · ${fmtData(r.inicio)} a ${fmtData(r.fim)}`,
    corpo: `<div class="rank-completo" style="--rank-cor:var(--${cores[modo]}-ink)">${rankLinhas(r[modo],modo,Infinity)}</div>`, rodape:'<button class="btn" data-fechar>Fechar</button>' });
}
