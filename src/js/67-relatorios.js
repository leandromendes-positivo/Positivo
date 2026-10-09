/* Relatório gerencial: saldo atual separado das saídas observadas no período. */
function filtrosIniciaisRelatorio() {
  return { inicio: hojeISO().slice(0, 7) + '-01', fim: hojeISO(), tipo: '', regiao: '', tid: '' };
}
const UIrelatorios = { filtros: filtrosIniciaisRelatorio(), rascunho: null, pagina: 1, exportando: '' };
const relatorioHistorico = { chave: '', pedido: 0, carregando: false, erro: '', devolucoes: [], movimentos: [] };
function limparHistoricoRelatorio() {
  Object.assign(relatorioHistorico, { chave: '', pedido: relatorioHistorico.pedido + 1, carregando: false, erro: '', devolucoes: [], movimentos: [] });
  UIrelatorios.filtros = filtrosIniciaisRelatorio(); UIrelatorios.rascunho = null; UIrelatorios.pagina = 1;
}
function chaveHistoricoRelatorio() { return `${Acesso.modo}|${Acesso.usuario?.uid || ''}|${E.rev}|${hojeISO()}`; }
function relatorioPronto() { return relatorioHistorico.chave === chaveHistoricoRelatorio() && !relatorioHistorico.carregando && !relatorioHistorico.erro; }
async function carregarHistoricoRelatorio() {
  const chave = chaveHistoricoRelatorio();
  if (relatorioHistorico.chave === chave && relatorioHistorico.carregando) return;
  const pedido = ++relatorioHistorico.pedido;
  Object.assign(relatorioHistorico, { chave, carregando: true, erro: '', devolucoes: [], movimentos: [] });
  try {
    // O acervo completo evita perder saídas anteriores ao cache operacional de 120 dias.
    const [devs, movs] = await Promise.all(['devolucoes', 'movimentos'].map(c => Armazem.consultar(c)));
    if (pedido !== relatorioHistorico.pedido || E.status !== 'pronto' || chave !== chaveHistoricoRelatorio()) return;
    relatorioHistorico.devolucoes = devs.flatMap(d => (d.itens || []).map(l => decodificarDevolucao(l, d.id)));
    relatorioHistorico.movimentos = movs.flatMap(d => (d.itens || []).map(m => ({ ...m, doc: d.id })));
  } catch (e) {
    if (pedido === relatorioHistorico.pedido) relatorioHistorico.erro = erroAmigavel(e).message;
  } finally {
    if (pedido === relatorioHistorico.pedido) {
      relatorioHistorico.carregando = false;
      if (UI.pagina === 'relatorios' && E.status === 'pronto') renderizar(true);
    }
  }
}
function aplicarFiltrosRelatorio(form) {
  if (!form.reportValidity()) return;
  const f = Object.fromEntries(new FormData(form));
  try { periodoDesempenho('intervalo', hojeISO(), f); }
  catch (e) { form.querySelector('[role="alert"]').textContent = e.message; return; }
  UIrelatorios.filtros = f; UIrelatorios.rascunho = null; UIrelatorios.pagina = 1;
  renderizar(true);
}
function periodoRapidoRelatorio(periodo) {
  const intervalo = periodo === '30dias' ? { inicio: somaDias(hojeISO(), -29), fim: hojeISO() } : periodoDesempenho(periodo);
  UIrelatorios.filtros = { ...(UIrelatorios.rascunho || UIrelatorios.filtros), inicio: intervalo.inicio, fim: intervalo.fim };
  UIrelatorios.rascunho = null; UIrelatorios.pagina = 1; renderizar(true);
}
const CORES_RELATORIO = ['#138573', '#D54B5D', '#3B79D1', '#B77919', '#8862C4', '#438995', '#7C8491'];
const NOTAS_RELATORIO = [
  'Estoque e atrasos em aberto representam a última planilha disponível, avaliados na data de emissão. O intervalo filtra somente as movimentações e a pontualidade das devoluções.',
  'Todos os responsáveis são técnicos de campo, inclusive identificadores numéricos. Quantidades são peças, não número de linhas.',
  'Usadas que saem da planilha são tratadas como devolvidas. Novas só entram em devoluções ou uso após classificação; saídas a classificar ficam separadas.',
  'Atrasos respeitam o prazo individual. Devoluções preservam o prazo registrado na saída. Nas novas, a idade conta da primeira observação no inventário.',
  'O limite de novas é um teto: ficar abaixo dele é adequado. Tipos de envio excluídos nas configurações não contam para o limite, mas aparecem no saldo físico. Limite zero significa sem limite.',
  'As datas das saídas indicam quando a mudança foi observada na importação. Sem movimentação registrada, não é possível reconstruir eventos anteriores ao início do acompanhamento.'
];
function calcularRelatorio(f = UIrelatorios.filtros, H = relatorioHistorico, D = derivar()) {
  const intervalo = periodoDesempenho('intervalo', D.hoje, f);
  const permitido = i => (!f.tid || i.tid === f.tid) && (!f.regiao || i.regiao === f.regiao)
    && (!f.tipo || i.tipo === f.tipo);
  const completar = i => ({ ...i, nome: nomeTecnico(i.tid), desc: E.catalogo[i.mat] || 'Sem descrição', localidade: LOCALIDADES[E.cadastro[i.tid]?.localidade || ''] || 'Não informada' });
  const estoque = linhasConsulta(D).filter(i => i.origem === 'atual' && permitido(i)).map(completar);
  const emPeriodo = i => i.em && i.em.slice(0, 10) >= intervalo.inicio && i.em.slice(0, 10) <= intervalo.fim;
  const saidas = [
    ...H.devolucoes.map(i => ({ ...i, tipo: 'usadas', destino: 'devolucao' })),
    ...H.movimentos.map(i => ({ ...i, tipo: 'novas', destino: i.destino || 'pendente' })),
  ].filter(i => permitido(i) && emPeriodo(i)).map(i => {
    const prazo = prazoDaDevolucao(i, i.tipo, D.cfg);
    const dias = Number.isFinite(i.dias) ? i.dias : null;
    return completar({ ...i, prazo, dias, pontual: i.destino === 'devolucao' && dias !== null ? dias <= prazo : null });
  }).sort((a, b) => comparar(b.em, a.em) || comparar(a.nome, b.nome));
  const qtd = lista => somar(lista, i => i.qtd);
  const devolucoes = saidas.filter(i => i.destino === 'devolucao'), avaliadas = devolucoes.filter(i => i.pontual !== null);
  const k = {
    estoque: qtd(estoque), usadas: qtd(estoque.filter(i => i.tipo === 'usadas')), novas: qtd(estoque.filter(i => i.tipo === 'novas')),
    atrasadas: qtd(estoque.filter(i => i.atrasada)), devolvidas: qtd(devolucoes), avaliadas: qtd(avaliadas),
    noPrazo: qtd(avaliadas.filter(i => i.pontual)), uso: f.tipo === 'usadas' ? null : qtd(saidas.filter(i => i.destino === 'uso')),
    classificar: qtd(saidas.filter(i => i.destino === 'pendente')), transferidas: qtd(saidas.filter(i => i.destino === 'transferencia')),
  };
  k.pontualidade = k.avaliadas ? k.noPrazo / k.avaliadas : null;
  const mapa = new Map();
  const tecnico = i => {
    if (!mapa.has(i.tid)) mapa.set(i.tid, { tid: i.tid, nome: nomeTecnico(i.tid), regiao: i.regiao, localidade: completar(i).localidade, usadas: 0, novas: 0, computaveis: 0, atrasadas: 0, devolvidas: 0, noPrazo: 0, avaliadas: 0, uso: 0, classificar: 0, limite: null, excesso: null });
    return mapa.get(i.tid);
  };
  // Cadastrados com saldo zero continuam visíveis; ausência de planilha não vira zero conhecido.
  D.tecnicos.filter(t => permitido({ ...t, tipo: f.tipo })).forEach(t => {
    const r = tecnico(t);
    if (f.tipo !== 'usadas' && t.estoqueConhecido) r.limite = t.meta;
    r.semPlanilha = f.tipo !== 'usadas' && !t.estoqueConhecido;
  });
  estoque.forEach(i => { const t = tecnico(i); t[i.tipo] += i.qtd; if (i.atrasada) t.atrasadas += i.qtd; if (i.tipo === 'novas' && i.conta) t.computaveis += i.qtd; });
  saidas.forEach(i => {
    const t = tecnico(i);
    if (i.destino === 'devolucao') { t.devolvidas += i.qtd; if (i.pontual !== null) t.avaliadas += i.qtd; if (i.pontual) t.noPrazo += i.qtd; }
    if (i.destino === 'uso') t.uso += i.qtd;
    if (i.destino === 'pendente') t.classificar += i.qtd;
  });
  const tecnicos = [...mapa.values()].map(t => ({ ...t, excesso: t.limite === null ? null : t.limite ? Math.max(0, t.computaveis - t.limite) : 0, taxa: t.avaliadas ? t.noPrazo / t.avaliadas : null }))
    .sort((a, b) => b.atrasadas - a.atrasadas || comparar(a.nome, b.nome));
  k.excesso = f.tipo === 'usadas' || !tecnicos.some(t => t.limite !== null) ? null : somar(tecnicos, t => t.excesso || 0);
  k.tecnicos = tecnicos.length; k.cobrar = tecnicos.filter(t => t.atrasadas > 0).length;
  // O código identifica a peça. Uma descrição igual não funde códigos diferentes.
  const porPeca = [...agrupar(estoque, i => String(i.mat))].map(([codigo, itens]) => ({ codigo, descricao: itens[0].desc, valor: qtd(itens), usadas: qtd(itens.filter(i => i.tipo === 'usadas')), novas: qtd(itens.filter(i => i.tipo === 'novas')) }))
    .sort((a, b) => b.valor - a.valor || comparar(a.codigo, b.codigo));
  const mensal = diffDias(intervalo.inicio, intervalo.fim) > 62, chaveData = d => d.slice(0, mensal ? 7 : 10);
  const fluxo = new Map();
  for (let dia = intervalo.inicio; dia <= intervalo.fim;) {
    const chave = chaveData(dia); fluxo.set(chave, { data: chave, usadas: 0, novas: 0 });
    if (mensal) { const dt = new Date(dia + 'T12:00:00Z'); dt.setUTCMonth(dt.getUTCMonth() + 1, 1); dia = dt.toISOString().slice(0, 10); }
    else dia = somaDias(dia, 1);
  }
  devolucoes.forEach(i => { const b = fluxo.get(chaveData(i.em)); if (b) b[i.tipo] += i.qtd; });
  const regioesTecnico = new Set([...estoque, ...saidas, ...(f.tid && D.mapa.has(f.tid) ? [D.mapa.get(f.tid)] : [])].map(i => i.regiao));
  const frescor = D.frescor.filter(i => (!f.regiao || i.regiao === f.regiao) && (!f.tipo || i.tipo === f.tipo) && (!f.tid || regioesTecnico.has(i.regiao)));
  const filtros = [f.tipo === 'usadas' ? 'Peças usadas' : f.tipo === 'novas' ? 'Peças novas' : 'Novas e usadas', f.regiao || 'Todas as UFs', f.tid ? nomeTecnico(f.tid) : 'Todos os técnicos'];
  return { filtros: { ...f }, filtrosTexto: filtros.join(' · '), ...intervalo, emitido: agoraISO(), hoje: D.hoje, k, estoque, saidas, tecnicos, fluxo: [...fluxo.values()], mensal, porPeca, frescor, notas: [...NOTAS_RELATORIO] };
}
function indicadoresRelatorio(r) {
  const k = r.k;
  return [
    { titulo: 'Peças no inventário', valor: k.estoque, detalhe: `${fmtNum(k.usadas)} usadas · ${fmtNum(k.novas)} novas`, escopo: 'Posição atual', icone: 'caixa', cor: 2 },
    { titulo: 'Acima do prazo', valor: k.atrasadas, detalhe: `${plural(k.cobrar, 'técnico', 'técnicos')} com atraso`, escopo: 'Posição atual', icone: 'relogio', cor: 1 },
    { titulo: 'Peças devolvidas', valor: k.devolvidas, detalhe: 'Saídas identificadas / confirmadas', escopo: 'No período', icone: 'retorno', cor: 0 },
    { titulo: 'Devoluções no prazo', valor: k.pontualidade, percentual: true, detalhe: `${fmtNum(k.noPrazo)} de ${fmtNum(k.avaliadas)} peças avaliadas`, escopo: 'No período', icone: 'ok', cor: 0 },
    { titulo: 'Novas em atendimento', valor: k.uso, detalhe: k.uso === null ? 'Selecione novas para consultar' : 'Uso confirmado pelo operador', escopo: 'No período', icone: 'ferramenta', cor: 4 },
    { titulo: 'Novas acima do limite', valor: k.excesso, detalhe: k.excesso === null ? 'Sem saldo de novas aplicável' : 'Quantidade excedente a recolher', escopo: 'Posição atual', icone: 'alerta', cor: 3 },
  ];
}
function valorIndicadorRelatorio(i) { return i.valor === null ? '—' : i.percentual ? fmtPct(i.valor) : fmtNum(i.valor); }
function graficosRelatorio(r) {
  const top = r.tecnicos.filter(t => t.atrasadas).slice(0, 6);
  const pecas = r.porPeca.slice(0, 5), qtdTop = somar(pecas, i => i.valor);
  return [
    { titulo: 'Situação do inventário', sub: 'Peças em aberto · prazo individual', tipo: 'doughnut', categorias: ['Dentro do prazo', 'Acima do prazo'], series: [{ nome: 'Peças', valores: [r.k.estoque - r.k.atrasadas, r.k.atrasadas], cor: CORES_RELATORIO[0] }], cores: CORES_RELATORIO.slice(0, 2) },
    { titulo: 'Atrasos por técnico', sub: '6 maiores saldos em atraso · posição atual', tipo: 'bar', categorias: top.map(t => t.nome), series: [{ nome: 'Peças em atraso', valores: top.map(t => t.atrasadas), cor: CORES_RELATORIO[1] }] },
    { titulo: 'Devoluções no período', sub: `${r.mensal ? 'Agrupadas por mês' : 'Evolução diária'} · data da saída observada`, tipo: 'line', categorias: r.fluxo.map(i => r.mensal ? i.data.slice(5) + '/' + i.data.slice(0, 4) : fmtData(i.data).slice(0, 5)), series: ['usadas', 'novas'].filter(t => !r.filtros.tipo || r.filtros.tipo === t).map((t, n) => ({ nome: t === 'usadas' ? 'Usadas' : 'Novas', valores: r.fluxo.map(i => i[t]), cor: CORES_RELATORIO[t === 'usadas' ? 2 : 0] })) },
    { titulo: 'Peças com maior estoque', sub: '5 maiores saldos · código e descrição da peça', tipo: 'bar', categorias: pecas.map(i => i.codigo), descricoes: pecas.map(i => i.descricao), series: [{ nome: 'Peças', valores: pecas.map(i => i.valor), cor: CORES_RELATORIO[2] }],
      nota: `${pecas.length} de ${r.porPeca.length} códigos · ${r.k.estoque ? fmtPct(qtdTop / r.k.estoque) : '0%'} do estoque. Demais códigos: ${fmtNum(r.k.estoque - qtdTop)} peças.` },
  ];
}

/* A mesma imagem de cada gráfico preserva a diagramação no Excel e no PDF. */
function svgGraficoRelatorio(g, impressao = false) {
  const ink = impressao ? '#17202A' : 'var(--ink)', muted = impressao ? '#596675' : 'var(--muted)', grid = impressao ? '#E4E9ED' : 'var(--line)';
  const total = somar(g.series, s => somar(s.valores));
  const texto = (x, y, t, attrs = '') => `<text x="${x}" y="${y}" fill="${ink}" font-family="Arial, sans-serif" font-size="13" ${attrs}>${esc(t)}</text>`;
  let corpo = '';
  if (!total) corpo = `<circle cx="280" cy="112" r="38" fill="none" stroke="${grid}" stroke-width="12"/>${texto(280, 117, '0', 'style="font-size:23px" text-anchor="middle"')}${texto(280, 184, 'Sem registros neste recorte', 'text-anchor="middle"')}`;
  else if (g.tipo === 'doughnut') {
    let soma = 0;
    corpo = g.series[0].valores.map((v, n) => {
      const tamanho = v / total * 100, inicio = soma; soma += tamanho;
      return `<circle class="rel-anel" cx="145" cy="131" r="78" pathLength="100" fill="none" stroke="${g.cores[n]}" stroke-width="25" stroke-dasharray="${tamanho} ${100 - tamanho}" stroke-dashoffset="${-inicio}" transform="rotate(-90 145 131)"><title>${esc(g.categorias[n])}: ${fmtNum(v)}</title></circle>`;
    }).join('') + texto(145, 129, fmtNum(total), 'text-anchor="middle" style="font-size:30px;font-weight:700"') + texto(145, 151, 'peças em aberto', `text-anchor="middle" style="fill:${muted};font-size:12px"`);
    g.categorias.forEach((c, n) => { corpo += `<circle cx="280" cy="${95 + n * 78}" r="5" fill="${g.cores[n]}"/>${texto(295, 100 + n * 78, c)}${texto(295, 126 + n * 78, `${fmtNum(g.series[0].valores[n])}  ·  ${fmtPct(g.series[0].valores[n] / total)}`, 'style="font-size:20px;font-weight:700"')}`; });
  } else if (g.tipo === 'bar') {
    const max = Math.max(1, ...g.series[0].valores), passo = 238 / Math.max(1, g.categorias.length);
    g.categorias.forEach((c, n) => {
      const y = 20 + n * passo, valor = g.series[0].valores[n], largura = valor / max * 470;
      const descricao = g.descricoes?.[n], barraY = y + (descricao ? 24 : 7);
      corpo += texto(12, y, c.length > 52 ? c.slice(0, 49) + '…' : c, descricao ? 'font-weight="700"' : '') + texto(548, y, fmtNum(valor), 'text-anchor="end" font-weight="700"');
      if (descricao) corpo += texto(12, y + 16, descricao.length > 58 ? descricao.slice(0, 55) + '…' : descricao, `style="fill:${muted};font-size:12px"`);
      corpo += `<rect x="12" y="${barraY}" width="536" height="7" rx="3.5" fill="${grid}"/><rect class="rel-barra" x="12" y="${barraY}" width="${largura}" height="7" rx="3.5" fill="${g.series[0].cor}"><title>${esc(c)}${descricao ? ' · ' + esc(descricao) : ''}: ${fmtNum(valor)}</title></rect>`;
    });
  } else {
    const max = Math.max(1, ...g.series.flatMap(s => s.valores)), teto = max <= 4 ? Math.ceil(max) : Math.ceil(max / 4) * 4;
    const x = n => 40 + n / Math.max(1, g.categorias.length - 1) * 500, y = v => 210 - v / teto * 170;
    for (let n = 0; n <= 4; n++) { const v = teto * n / 4; corpo += `<path d="M40 ${y(v)}H540" stroke="${grid}"/>${texto(30, y(v) + 4, fmtNum1(v), 'text-anchor="end" style="font-size:11px"')}`; }
    g.series.forEach(s => {
      const pontos = s.valores.map((v, n) => `${x(n)},${y(v)}`).join(' ');
      corpo += `<polyline class="rel-linha" points="${pontos}" fill="none" stroke="${s.cor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (s.valores.length <= 62) s.valores.forEach((v, n) => { corpo += `<circle cx="${x(n)}" cy="${y(v)}" r="3" fill="${s.cor}"><title>${esc(g.categorias[n])} · ${esc(s.nome)}: ${fmtNum(v)}</title></circle>`; });
    });
    [...new Set([0, Math.floor((g.categorias.length - 1) / 2), g.categorias.length - 1])].forEach(n => { corpo += texto(x(n), 233, g.categorias[n], 'text-anchor="middle" style="font-size:11px"'); });
    g.series.forEach((s, n) => { corpo += `<circle cx="${50 + n * 160}" cy="258" r="4" fill="${s.cor}"/>${texto(62 + n * 160, 262, s.nome)}`; });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 280" width="560" height="280" role="img" aria-label="${esc(g.titulo)}"><title>${esc(g.titulo)} — ${esc(g.sub)}</title>${corpo}</svg>`;
}
function tabelaGraficoRelatorio(g) {
  return `<details class="rel-dados-grafico"><summary>Ver dados do gráfico</summary><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>${g.descricoes ? 'Código / descrição' : 'Categoria'}</th>${g.series.map(s => `<th>${esc(s.nome)}</th>`).join('')}</tr></thead><tbody>${g.categorias.map((c, n) => `<tr><th scope="row">${esc(c)}${g.descricoes ? `<small class="sub-celula">${esc(g.descricoes[n])}</small>` : ''}</th>${g.series.map(s => `<td class="num">${fmtNum(s.valores[n])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
function graficoPecasRelatorio(r) {
  const pecas = r.porPeca.slice(0, 5), max = pecas[0]?.valor || 1;
  if (!pecas.length) return `<div class="rel-grafico">${svgGraficoRelatorio(graficosRelatorio(r)[3])}</div>`;
  return `<ol class="rel-pecas-top" aria-label="Cinco peças com maior saldo">${pecas.map(i => `<li><div><strong class="mono">${esc(i.codigo)}</strong><span><b>${fmtNum(i.valor)}</b><small>peças</small></span></div><p title="${esc(i.descricao)}">${esc(i.descricao)}</p><div class="rel-peca-trilho" aria-hidden="true"><i style="--parte:${i.valor / max * 100}%"></i></div></li>`).join('')}</ol>`;
}
function modalPecasRelatorio() {
  if (!relatorioPronto()) return;
  const r = calcularRelatorio(), todas = r.porPeca;
  const m = abrirModal({ titulo: 'Estoque por peça', subtitulo: 'Código identifica a peça · filtros aplicados ao relatório', largura: 'larga', corpo: '<label class="campo"><span>Buscar código ou descrição</span><input type="search" data-rel-peca-busca placeholder="Ex.: 11176614 ou PL SUB KEY" autofocus></label><div data-rel-pecas-lista></div>', rodape: '<button class="btn" data-fechar>Fechar</button>' });
  let pagina = 1;
  function desenhar() {
    const termos = normBusca(m.el.querySelector('input').value).split(/\s+/).filter(Boolean);
    const lista = todas.filter(i => termos.every(t => normBusca(`${i.codigo} ${i.descricao}`).includes(t)));
    const paginas = Math.max(1, Math.ceil(lista.length / 20)); pagina = Math.min(pagina, paginas);
    m.el.querySelector('[data-rel-pecas-lista]').innerHTML = `<p class="nota">${plural(lista.length, 'código', 'códigos')} · ${fmtNum(somar(lista, i => i.valor))} peças</p><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Código / descrição</th><th>Usadas</th><th>Novas</th><th>Total</th></tr></thead><tbody>${lista.slice((pagina - 1) * 20, pagina * 20).map(i => `<tr><td><strong class="mono">${esc(i.codigo)}</strong><small class="sub-celula">${esc(i.descricao)}</small></td><td class="num">${fmtNum(i.usadas)}</td><td class="num">${fmtNum(i.novas)}</td><td class="num">${fmtNum(i.valor)}</td></tr>`).join('') || '<tr><td colspan="4">Nenhuma peça encontrada.</td></tr>'}</tbody></table></div><div class="paginacao"><span>${pagina} / ${paginas}</span><div><button class="btn pequeno" data-rel-passo="-1" ${pagina === 1 ? 'disabled' : ''}>Anterior</button><button class="btn pequeno" data-rel-passo="1" ${pagina === paginas ? 'disabled' : ''}>Próxima</button></div></div>`;
  }
  m.el.querySelector('input').addEventListener('input', () => { pagina = 1; desenhar(); });
  Pesquisas.registrar(m.el.querySelector('input'), {
    nome: 'Buscar código ou descrição', tipos: ['peca'],
    linhas: () => todas.map(i => ({ mat: i.codigo, desc: i.descricao })),
    executar: () => { pagina = 1; desenhar(); },
  });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-rel-passo]'); if (b && !b.disabled) { pagina += Number(b.dataset.relPasso); desenhar(); } });
  desenhar();
}
function renderRelatorios() {
  if (relatorioHistorico.chave !== chaveHistoricoRelatorio()) UI.posRender = carregarHistoricoRelatorio;
  const pronto = relatorioPronto(), f = UIrelatorios.rascunho || UIrelatorios.filtros, D = derivar();
  const tids = [...new Set([...D.tecnicos, ...relatorioHistorico.devolucoes, ...relatorioHistorico.movimentos].map(i => i.tid))];
  const tecnicos = tids.map(tid => ({ tid, nome: nomeTecnico(tid) })).sort((a, b) => comparar(a.nome, b.nome));
  const regioes = [...new Set([...D.regioes, ...relatorioHistorico.devolucoes.map(i => i.regiao), ...relatorioHistorico.movimentos.map(i => i.regiao)].filter(Boolean))].sort();
  const select = (campo, titulo, opcoes) => `<label class="campo"><span>${titulo}</span><select name="${campo}">${opcoes.map(([v, t]) => `<option value="${esc(v)}" ${f[campo] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const formatos = [
    ['simples', 'Exportação simples', 'Excel · dados completos, sem gráficos', 'tabela'],
    ['indicadores', 'Exportação com indicadores', 'Excel · resumo visual em 2 abas', 'grafico'],
    ['pdf', 'Exportar PDF', 'Resumo executivo em 2 páginas', 'arquivo'],
  ];
  const cabecalho = `<section class="relatorios" aria-label="Relatórios gerenciais"><header class="rel-intro"><div><span class="sobretitulo">INFORMAÇÃO GERENCIAL</span><h2>Relatórios da operação</h2><p>Indicadores para decidir. Dados completos quando você precisar aprofundar.</p></div>${imagemCabecalho()}</header><div class="rel-exportacoes">${formatos.map(([formato, titulo, sub, ic]) => `<button class="btn rel-exportar ${formato === 'indicadores' ? 'prim' : ''}" data-acao="relatorios-exportar" data-formato="${formato}" ${!pronto || UIrelatorios.exportando ? 'disabled' : ''}>${icone(ic)}<span><strong>${UIrelatorios.exportando === formato ? 'Preparando…' : titulo}</strong><small>${sub}</small></span>${icone('baixar')}</button>`).join('')}</div>
    <form class="rel-filtros" data-form="relatorios" aria-label="Filtros dos relatórios"><div class="rel-filtros-topo"><strong>${icone('filtro')}Defina o recorte</strong><div class="rel-atalhos">${[['semana', 'Esta semana'], ['mes', 'Este mês'], ['30dias', 'Últimos 30 dias']].map(([v, t]) => `<button type="button" class="btn pequeno" data-acao="relatorios-periodo" data-periodo="${v}">${t}</button>`).join('')}</div></div><div class="rel-campos">
    <label class="campo"><span>Saídas a partir de</span><input type="date" name="inicio" required max="${hojeISO()}" value="${esc(f.inicio)}"></label><label class="campo"><span>Até</span><input type="date" name="fim" required max="${hojeISO()}" value="${esc(f.fim)}"></label>
    ${select('tipo', 'Tipo de peça', [['', 'Novas e usadas'], ['usadas', 'Usadas'], ['novas', 'Novas']])}${select('regiao', 'Estado', [['', 'Todas as UFs'], ...regioes.map(uf => [uf, uf])])}${select('tid', 'Técnico', [['', 'Todos os técnicos'], ...tecnicos.map(t => [t.tid, t.nome])])}</div>
    <div class="rel-aplicar"><span>Datas filtram as saídas. O inventário mostra a posição atual.</span><button type="button" class="btn fantasma" data-acao="relatorios-limpar">Limpar filtros</button><button class="btn prim" type="submit">Aplicar filtros${icone('direita')}</button></div><p class="rel-erro" role="alert"></p></form>`;
  if (!pronto) return cabecalho + (relatorioHistorico.erro && relatorioHistorico.chave === chaveHistoricoRelatorio()
    ? vazio('alerta', 'Não foi possível consultar o histórico', `${esc(relatorioHistorico.erro)} Nenhum arquivo parcial será gerado.`, '<button class="btn" data-acao="relatorios-atualizar">Tentar novamente</button>')
    : '<div class="carregando" role="status"><div class="girando"></div><p>Consolidando estoque e histórico de movimentações…</p></div>') + '</section>';
  const r = calcularRelatorio(), graficos = graficosRelatorio(r), atrasadas = r.frescor.filter(i => !i.em || i.dias > 0);
  UIrelatorios.pagina = Math.min(UIrelatorios.pagina, Math.max(1, Math.ceil(r.tecnicos.length / 20)));
  const linhas = r.tecnicos.slice((UIrelatorios.pagina - 1) * 20, UIrelatorios.pagina * 20);
  return cabecalho + `<div class="rel-recorte"><span>${icone('calendario')}<strong>${fmtData(r.inicio)} a ${fmtData(r.fim)}</strong><span>${esc(r.filtrosTexto)}</span></span><small>Estoque avaliado em ${fmtData(r.hoje)}</small></div>
    ${atrasadas.length || !r.frescor.length ? `<div class="rel-aviso">${icone('info')}<span>${r.frescor.length ? `${atrasadas.length} de ${r.frescor.length} planilhas deste recorte não foram atualizadas hoje. O saldo usa a última importação disponível.` : 'Ainda não há planilhas importadas para este recorte. Os saldos não confirmam ausência de estoque.'}</span></div>` : ''}
    <div class="rel-kpis">${indicadoresRelatorio(r).map(i => `<article class="rel-kpi" style="--rel-cor:${CORES_RELATORIO[i.cor]}"><div><span>${i.escopo}</span>${icone(ICONES[i.icone] ? i.icone : 'grafico')}</div><h3>${i.titulo}</h3><strong>${valorIndicadorRelatorio(i)}</strong><p>${i.detalhe}</p></article>`).join('')}</div>
    <div class="rel-graficos">${graficos.map((g, n) => cartao(g.titulo, `${n === 3 ? graficoPecasRelatorio(r) : `<div class="rel-grafico">${svgGraficoRelatorio(g)}</div>`}${g.nota ? `<div class="rel-nota-pecas"><p>${esc(g.nota)}</p><button class="btn pequeno" data-acao="relatorios-pecas">Ver todas as peças${icone('direita')}</button></div>` : ''}${tabelaGraficoRelatorio(g)}`, { sub: esc(g.sub), classe: `rel-cartao rel-grafico-${n}`, acoes: `<span class="rel-numero">0${n + 1}</span>` })).join('')}</div>
    <div class="rel-faixa"><div>${icone('arquivo')}<span><strong>${fmtNum(r.k.classificar)}</strong> novas com saída a classificar</span></div><div><strong>${fmtNum(r.k.transferidas)}</strong><span>peças transferidas / ajustadas</span></div><p>Essas saídas ficam separadas das devoluções e do uso confirmado.</p></div>
    ${cartao('Consolidado por técnico', `<div class="tabela-rolagem"><table class="tabela rel-tabela"><thead><tr><th>Técnico / localidade</th><th class="num">Usadas<br><small>Em aberto</small></th><th class="num">Novas<br><small>Saldo físico</small></th><th class="num">Em atraso<br><small>Atual</small></th><th class="num">Devolvidas<br><small>Período</small></th><th class="num">No prazo<br><small>Devoluções</small></th><th class="num">Uso de novas<br><small>Confirmado</small></th><th class="num">Excesso<br><small>Novas</small></th></tr></thead><tbody>${linhas.map(t => `<tr><td><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button><small class="sub-celula">${esc(t.regiao)} · ${esc(t.localidade)}${t.semPlanilha ? ' · sem planilha de novas' : ''}</small></td><td class="num">${r.filtros.tipo === 'novas' ? '—' : fmtNum(t.usadas)}</td><td class="num">${r.filtros.tipo === 'usadas' || t.semPlanilha ? '—' : fmtNum(t.novas)}</td><td class="num ${t.atrasadas ? 'rel-critico' : ''}">${fmtNum(t.atrasadas)}</td><td class="num">${fmtNum(t.devolvidas)}</td><td class="num">${t.taxa === null ? '—' : fmtPct(t.taxa)}</td><td class="num">${r.filtros.tipo === 'usadas' ? '—' : fmtNum(t.uso)}</td><td class="num">${t.excesso === null ? '—' : fmtNum(t.excesso)}</td></tr>`).join('') || '<tr><td colspan="8">Nenhum técnico corresponde aos filtros aplicados.</td></tr>'}</tbody></table></div>${paginacao(r.tecnicos.length, UIrelatorios.pagina, 20, 'relatorios')}`, { sub: 'Estoque atual e resultados do período. Use a exportação simples para consultar todas as linhas do recorte.', classe: 'rel-consolidado' })}
    <details class="rel-metodologia"><summary>${icone('info')}Como os indicadores são calculados e o que será exportado</summary><p><strong>Exportação simples:</strong> inventário e movimentações completos, em tabelas sem gráficos, prontos para você montar suas análises. <strong>Com indicadores:</strong> duas abas com os totais, gráficos e até 8 técnicos prioritários. Os gráficos são imagens para preservar a apresentação. <strong>PDF:</strong> o mesmo resumo em duas páginas. Todos usam os filtros aplicados; os totais consideram o recorte inteiro, mesmo quando o gráfico mostra apenas os primeiros colocados.</p>${r.notas.map(n => `<p>${esc(n)}</p>`).join('')}<ul>${r.frescor.map(i => `<li>${esc(i.regiao)} / ${esc(i.tipo)}: ${i.em ? esc(fmtDataHora(i.em)) : 'Sem importação'}</li>`).join('')}</ul></details><p class="rel-privacidade">${icone('cadeado')}Exportações geradas no seu navegador, com os dados aos quais sua conta tem acesso.</p></section>`;
}
