/* Rankings auditáveis. Os gráficos mantêm valores e ações disponíveis por teclado. */
const UIranking = { tipo: 'usadas', periodo: 'semana', regiao: '', inicio: '', fim: '', rascunho: null };
const historicoRanking = { chave: '', pedido: 0, carregando: false, erro: '', devolucoes: [], movimentos: [] };
function limparHistoricoRanking() {
  Object.assign(historicoRanking, { chave: '', pedido: historicoRanking.pedido + 1, carregando: false, erro: '', devolucoes: [], movimentos: [] });
}
function intervaloRanking() { return periodoDesempenho(UIranking.periodo, hojeISO(), UIranking); }
function chaveHistoricoRanking() { return `${intervaloRanking().inicio}|${E.rev}|${hojeISO()}`; }
function precisaHistoricoRanking() { return intervaloRanking().inicio < somaDias(hojeISO(), -120); }
async function carregarHistoricoRanking() {
  const chave = chaveHistoricoRanking(), inicio = intervaloRanking().inicio;
  if (historicoRanking.carregando && historicoRanking.chave === chave) return;
  const pedido = historicoRanking.pedido + 1;
  Object.assign(historicoRanking, { chave, pedido, carregando: true, erro: '' });
  try {
    // Saídas posteriores ao fim também podem ter estado pendentes no intervalo.
    const [devs, movs] = await Promise.all(['devolucoes', 'movimentos'].map(colecao => Armazem.consultar(colecao, { onde: [['data', '>=', inicio]] })));
    if (pedido !== historicoRanking.pedido || E.status !== 'pronto') return;
    historicoRanking.devolucoes = devs.flatMap(d => (d.itens || []).map(l => decodificarDevolucao(l, d.id)));
    historicoRanking.movimentos = movs.flatMap(d => (d.itens || []).map(m => ({ ...m, doc: d.id })));
  } catch (e) {
    if (pedido === historicoRanking.pedido) historicoRanking.erro = erroAmigavel(e).message;
  } finally {
    if (pedido === historicoRanking.pedido) {
      historicoRanking.carregando = false;
      if (UI.pagina === 'painel' && E.status === 'pronto') renderizar(true);
    }
  }
}
function dadosDesempenhoRanking(D = derivar()) {
  if (!precisaHistoricoRanking()) return calcularDesempenho(UIranking, D);
  if (historicoRanking.chave !== chaveHistoricoRanking() || historicoRanking.carregando || historicoRanking.erro) return null;
  return calcularDesempenho({ ...UIranking, historico: historicoRanking }, D);
}
function alterarFiltroRanking(campo, valor) {
  if (campo === 'periodo' && ['semana', 'mes', 'intervalo'].includes(valor)) {
    if (valor === 'intervalo' && !UIranking.inicio) Object.assign(UIranking, intervaloRanking());
    UIranking.periodo = valor;
    UIranking.rascunho = { inicio: UIranking.inicio, fim: UIranking.fim };
  } else if (campo === 'tipo' && ['novas', 'usadas'].includes(valor)) UIranking.tipo = valor;
  renderizar(true);
}
function aplicarIntervaloRanking(form) {
  if (!form.reportValidity()) return;
  const inicio = form.elements.inicio.value, fim = form.elements.fim.value;
  try { periodoDesempenho('intervalo', hojeISO(), { inicio, fim }); }
  catch (e) { form.querySelector('[role="alert"]').textContent = e.message; return; }
  Object.assign(UIranking, { periodo: 'intervalo', inicio, fim, rascunho: { inicio, fim } });
  renderizar(true);
}
function formularioIntervaloRanking() {
  if (UIranking.periodo !== 'intervalo') return '';
  const datas = UIranking.rascunho || UIranking;
  return `<form class="ranking-intervalo" data-form="ranking-intervalo" aria-label="Intervalo de datas dos rankings">
    <label class="campo"><span>Data inicial</span><input type="date" name="inicio" data-ranking-data="inicio" value="${esc(datas.inicio)}" max="${hojeISO()}" required></label>
    <label class="campo"><span>Data final</span><input type="date" name="fim" data-ranking-data="fim" value="${esc(datas.fim)}" max="${hojeISO()}" required></label>
    <button type="submit" class="btn prim">${icone('filtro')}Aplicar intervalo</button><span class="ranking-intervalo-ajuda">As duas datas entram no resultado.</span>
    <p class="ranking-intervalo-erro" role="alert"></p>
  </form>`;
}
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
  const r = dadosDesempenhoRanking(D), intervalo = intervaloRanking(), novas = UIranking.tipo === 'novas';
  if (!r && historicoRanking.chave !== chaveHistoricoRanking()) UI.posRender = carregarHistoricoRanking;
  const registros = precisaHistoricoRanking() && r ? [...historicoRanking.devolucoes, ...historicoRanking.movimentos] : [...E.devolucoes, ...E.movimentos];
  const regioes = [...new Set([...D.regioes, ...registros.map(i => i.regiao), UIranking.regiao].filter(Boolean))].sort();
  const prazo = novas ? Number(D.cfg.prazoNovas) || 7 : D.cfg.prazo;
  const seg = (campo, opcoes) => `<div class="filtros-segmentados" role="group" aria-label="${campo === 'tipo' ? 'Tipo de peça do ranking' : 'Período do ranking'}">${opcoes.map(([v,n]) => `<button type="button" data-acao="ranking-filtro" data-campo="${campo}" data-valor="${v}" class="${UIranking[campo] === v ? 'ativo' : ''}" aria-pressed="${UIranking[campo] === v}">${n}</button>`).join('')}</div>`;
  const cabecalho = `<section class="desempenho" aria-labelledby="titulo-desempenho">
    <header class="desempenho-topo"><div><span class="sobretitulo">DESEMPENHO DA EQUIPE</span><h2 id="titulo-desempenho">Prazos, devoluções e uso de peças</h2><p>${fmtData(intervalo.inicio)} a ${fmtData(intervalo.fim)} · ${novas ? 'Novas · prazo observado' : 'Usadas · prioridade de cobrança'} · prazos por técnico (geral: ${prazo} dias)</p></div>
    <div class="ranking-filtros">${seg('periodo', [['semana','Esta semana'],['mes','Este mês'],['intervalo','Intervalo personalizado']])}${seg('tipo',[['usadas','Usadas · prioritárias'],['novas','Novas']])}<select data-mudar="ranking-regiao" aria-label="UF dos rankings"><option value="">Todas as UFs</option>${regioes.map((uf) => `<option value="${esc(uf)}" ${UIranking.regiao === uf ? 'selected' : ''}>${esc(uf)}</option>`).join('')}</select></div></header>${formularioIntervaloRanking()}`;
  if (!r) return cabecalho + (historicoRanking.erro && historicoRanking.chave === chaveHistoricoRanking()
    ? vazio('alerta', 'Não foi possível consultar o período', esc(historicoRanking.erro), '<button class="btn" data-acao="ranking-recarregar">Tentar novamente</button>')
    : '<div class="carregando" role="status"><div class="girando"></div><p>Consultando registros do período…</p></div>') + '</section>';
  const totalAtraso = somar(r.atraso, (t) => t.atrasadas), totalDev = somar(r.lista,(t) => t.devolvidas), emDia = somar(r.lista,(t) => t.noPrazo), totalUso = somar(r.uso,(t) => t.uso);
  return `${cabecalho}<div class="ranking-grade">
      ${cartao('Maior volume em atraso', `<div class="rank-resumo"><strong>${fmtNum(totalAtraso)}</strong><span>peças acima do prazo<br>com ${plural(r.atraso.length, 'técnico', 'técnicos')}</span>${icone('relogio')}</div>${rankLinhas(r.atraso,'atraso')}`, { sub: 'Pendências e devoluções atrasadas no período.', classe: 'ranking-cartao ranking-atraso' })}
      ${cartao('Devoluções em dia', `<div class="rank-resumo"><strong>${totalDev ? fmtNum1(emDia/totalDev*100) + '<small>%</small>' : '—'}</strong><span>${fmtNum(emDia)} de ${plural(totalDev, 'peça devolvida', 'peças devolvidas')}<br>dentro do prazo</span><svg class="rank-anel" viewBox="0 0 44 44" aria-hidden="true"><circle class="anel-fundo" cx="22" cy="22" r="17"/><circle class="anel-valor" cx="22" cy="22" r="17" pathLength="100" style="--deslocamento:${totalDev ? 100-emDia/totalDev*100 : 100}"/></svg></div>${rankLinhas(r.pontualidade,'pontualidade')}`, { sub: 'Maior pontualidade; volume desempata.', classe: 'ranking-cartao ranking-pontualidade' })}
      ${cartao('Uso por técnico', `<div class="rank-resumo"><strong>${fmtNum(totalUso)}</strong><span>${novas ? 'peças com uso confirmado' : 'peças trocadas por Data FT'}<br>por ${plural(r.uso.length, 'técnico', 'técnicos')}</span>${icone('grafico')}</div>${rankLinhas(r.uso,'uso')}`, { sub: novas ? 'Baixas classificadas como uso em atendimento.' : 'Trocas registradas, com materiais e quantidades.', classe: 'ranking-cartao ranking-uso' })}
    </div>
    <div class="ranking-nota">${icone('info')}<p>${novas ? 'Novas: o prazo conta da primeira observação do material no estoque, não da data de recebimento. Baixas só entram como devolução ou uso após classificação.' : 'Atraso conta peças, sem repetir as fotos diárias. Pontualidade considera somente peças devolvidas. Uso considera a Data FT, sem repetir a peça após a devolução.'}${r.semData ? ` ${plural(r.semData, 'registro sem Data FT fica', 'registros sem Data FT ficam')} fora do indicador de uso.` : ''} Clique em um técnico para conferir as peças. Mostrando os 5 primeiros de cada ranking.</p></div>
    ${novas ? `<div class="ranking-pendencias"><span>${icone('arquivo')}<strong>${plural(somar(r.pendentes,(m) => m.qtd), 'peça com saída a classificar', 'peças com saída a classificar')}</strong><small>Neste período. As baixas começam a ser registradas nas próximas importações.</small></span><button class="btn pequeno" data-acao="consultar-saidas">Conferir saídas${icone('direita')}</button></div>` : ''}
  </section>`;
}
function modalRanking(tid, modo) {
  const r = dadosDesempenhoRanking(), t = r?.lista.find((t) => t.tid === tid);
  if (!t || !['atraso','pontualidade','uso'].includes(modo)) return;
  const itens = t.evidencias[modo];
  const titulos = { atraso: 'Peças em atraso', pontualidade: 'Pontualidade das devoluções', uso: 'Materiais utilizados' };
  const total = somar(itens, (i) => i.qtd);
  const materiais = [...agrupar(itens,(i) => i.mat)].map(([mat, lista]) => ({ mat, desc: E.catalogo[mat] || '', qtd: somar(lista,(i) => i.qtd) })).sort((a,b) => b.qtd-a.qtd);
  const max = Math.max(1,...materiais.map((m) => m.qtd));
  abrirModal({ titulo: t.nome, subtitulo: `${titulos[modo]} · ${fmtData(r.inicio)} a ${fmtData(r.fim)}`, largura: 'larga',
    corpo: `<div class="rank-detalhe-resumo">${pill(UIranking.tipo === 'usadas' ? 'crit' : 'info', UIranking.tipo === 'usadas' ? 'Usadas' : 'Novas')}<strong>${plural(total,'peça','peças')}</strong><span>${plural(materiais.length,'material','materiais')} · ${esc(t.regiao)}</span></div>
    <div class="rank-distribuicao">${materiais.map((m) => `<div><span><strong>${esc(m.mat)}</strong> ${esc(m.desc || 'Sem descrição')}</span><b>${fmtNum(m.qtd)}</b><i style="--largura:${m.qtd/max*100}%" aria-hidden="true"></i></div>`).join('')}</div>
    <div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Material</th><th>Chamado</th><th>Qtd.</th><th>Data</th><th>Situação</th></tr></thead><tbody>${itens.map((i) => `<tr><td class="mono">${esc(i.mat)}</td><td>${esc(i.chamado || '—')}</td><td class="num">${fmtNum(i.qtd)}</td><td class="nowrap">${i.data ? fmtData(i.data) : 'Em aberto'}</td><td>${esc(i.detalhe)}${i.prazo ? `<small class="sub-celula">Prazo aplicado: ${i.prazo} dias</small>` : ''}${i.atraso ? ` · ${i.atraso} dias` : ''}</td></tr>`).join('')}</tbody></table></div>`,
    rodape: '<button class="btn" data-fechar>Fechar</button>' });
}

function modalRankingCompleto(modo) {
  if (!['atraso','pontualidade','uso'].includes(modo)) return;
  const r = dadosDesempenhoRanking();
  if (!r) return;
  const nomes = { atraso:'Maior volume em atraso', pontualidade:'Devoluções em dia', uso:'Uso por técnico' };
  const cores = { atraso:'crit', pontualidade:'good', uso:'info' };
  abrirModal({ titulo: nomes[modo], subtitulo: `${plural(r[modo].length,'técnico','técnicos')} · ${fmtData(r.inicio)} a ${fmtData(r.fim)}`,
    corpo: `<div class="rank-completo" style="--rank-cor:var(--${cores[modo]}-ink)">${rankLinhas(r[modo],modo,Infinity)}</div>`, rodape:'<button class="btn" data-fechar>Fechar</button>' });
}
