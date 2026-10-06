/* ==========================================================================
   Página: Painel (visão geral do dia)
   ========================================================================== */

function historicoAnterior() {
  const hoje = hojeISO();
  const ants = E.historico.filter((h) => h.data < hoje);
  return ants.length ? ants[ants.length - 1] : null;
}
/** Variação desde o dia anterior do histórico: '↓ 664 desde 05/10'. */
function delta(atual, antes, subirEhRuim, dia) {
  if (antes == null || isNaN(antes)) return "";
  const d = atual - antes;
  const desde = dia ? ` desde ${fmtData(dia, true)}` : "";
  if (!d) return `<span class="delta neutro">igual${desde}</span>`;
  const ruim = subirEhRuim ? d > 0 : d < 0;
  return `<span class="delta ${ruim ? "ruim" : "bom"}" title="${d > 0 ? "Aumentou" : "Diminuiu"} ${fmtNum(Math.abs(d))}${desde}">${icone(d > 0 ? "sobe" : "desce")}${fmtNum(Math.abs(d))}${desde}</span>`;
}
function kpi({ rotulo, valor, sub = "", classe = "", acao = "", dica = "", ic = "" }) {
  const tag = acao ? "button" : "div";
  return `<${tag} class="kpi ${classe}" ${acao} ${dica ? `title="${esc(dica)}"` : ""}>
    ${ic ? `<span class="kpi-icone">${icone(ic)}</span>` : ""}<span class="kpi-rotulo">${esc(rotulo)}</span>
    <span class="kpi-valor">${valor}</span>
    <span class="kpi-sub">${sub}</span>
  </${tag}>`;
}

function avisoAtualizacao(D) {
  const pendentes = D.frescor.filter((f) => !f.em || f.dias > 0);
  if (!pendentes.length) return "";
  // agrupa por quando foi a última importação: "PR, RS e SC: ontem às 14:00"
  const grupos = agrupar(pendentes, (f) => (f.em ? fmtQuando(f.em) : "nunca importadas"));
  const juntar = (l) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0]);
  const partes = [...grupos.entries()].map(([quando, fs]) => {
    const porRegiao = agrupar(fs, (f) => f.regiao);
    const nomes = [...porRegiao.entries()].map(([r, x]) => (x.length === 2 ? r : `${r} ${x[0].tipo}`));
    return `${juntar(nomes)}: ${quando}`;
  });
  return `<div class="faixa alerta compacta">${icone("relogio")}<div><strong>Planilhas de hoje ainda não importadas</strong><span>Última importação — ${esc(partes.join(" · "))}</span></div>
    <button class="btn" data-acao="ir" data-pagina="importar">Importar agora</button></div>`;
}

function devolvidasRecentes(D) {
  const recentes = [...E.devolucoes].sort((a, b) => comparar(b.em, a.em)).slice(0, 8);
  if (!recentes.length) {
    return vazio("retorno", "Ainda sem devoluções registradas", "A partir da próxima importação, as peças que saírem do relatório de usadas aparecem aqui como devolvidas.");
  }
  return `<ul class="lista-simples">${recentes.map((d) => `<li>
    <span class="ls-principal"><strong>${esc(nomeTecnico(d.tid))}</strong><span>${esc(E.catalogo[d.mat] || d.mat)}</span></span>
    <span class="ls-lado">${pill(d.dias <= D.cfg.prazo ? "ok" : "grave", `${d.dias} ${d.dias === 1 ? "dia" : "dias"}`, d.dias <= D.cfg.prazo ? "ok" : "relogio")}<small>${fmtQuando(d.em)}</small></span>
  </li>`).join("")}</ul>`;
}

function boasVindas() {
  return `<section class="boas-vindas">
    <div class="bv-texto">
      <span class="sobretitulo">Primeiro passo</span>
      <h2>Importe as planilhas do dia</h2>
      <p>Arraste aqui os relatórios de peças <strong>Novas</strong> e <strong>Usadas</strong> de cada região (por exemplo <span class="mono">PR Usadas.csv</span>). Pode soltar todos de uma vez.</p>
      <ol class="passos">
        <li><strong>Todo dia</strong>, exporte os relatórios do sistema e arraste para esta página.</li>
        <li>O painel calcula há quantos dias cada técnico está com cada peça usada e mostra <strong>quem cobrar</strong>.</li>
        <li>Registre a cobrança e a <strong>previsão de devolução</strong> que o técnico informar. Quando a peça sair do relatório, ela conta como devolvida.</li>
      </ol>
    </div>
    <label class="zona-soltar grande" data-zona>
      ${icone("upload")}
      <strong>Solte as planilhas aqui</strong>
      <span>CSV do sistema ou Excel (.xlsx)</span>
      <span class="btn prim">Escolher arquivos</span>
      <input type="file" multiple accept=".csv,.txt,.xlsx,.xls" data-entrada-arquivos hidden>
    </label>
  </section>`;
}

const UIpainel = { tabelas: new Set(), fila: "cobrar", dia: "", mapaModo: "usadas", regiao: "", periodo: 30, zoom: 1 };

function renderPainel() {
  const D = derivar();
  if (!E.usadas.length && !E.novas.length && !E.devolucoes.length && !E.movimentos.length) return leituraOperacional(D) + boasVindas();
  const k = D.kpi, cfg = D.cfg;
  const ant = historicoAnterior(), at = ant && ant.tot;
  const previstas = somar(k.previsoesHoje, (i) => i.qtd);
  const estoque = estoqueConhecidoPainel(D);
  const operacao = indicadoresOperacionais(D);
  const agenda = agendaDoPainel(D);
  const indicadores = [
    kpiOperacional({ tipo: "usadas", rotulo: "Peças usadas pendentes", valor: fmtNum(k.usadas), unidade: "peças em aberto", sub: at ? delta(k.usadas, at.usadas, true, ant.data) : `Prazo de devolução: ${cfg.prazo} dias`, legenda: "Peças por prazo", partes: [{ nome: "No prazo", valor: k.usadas - k.atrasadas, cor: "good" }, { nome: "Em atraso", valor: k.atrasadas, cor: "crit" }], rodape: "Consultar pendências", acao: 'data-acao="painel-usadas" data-status="todas"', icone: "retorno" }),
    kpiOperacional({ tipo: "cobrancas", rotulo: "Técnicos para cobrar", valor: fmtNum(k.cobrarTecnicos), unidade: "técnicos na fila", sub: `${plural(k.cobrarPecas, "peça exige", "peças exigem")} acompanhamento`, legenda: "Contatos da fila de hoje", partes: [{ nome: "Sem contato", valor: operacao.semContatoHoje, cor: "crit" }, { nome: "Contatados", valor: k.cobrarTecnicos - operacao.semContatoHoje, cor: "good" }], rodape: "Abrir cobranças", acao: 'data-acao="painel-cobrancas" data-aba="cobrar"', icone: "sino" }),
    kpiOperacional({ tipo: "devolucoes", rotulo: "Devoluções previstas hoje", valor: fmtNum(previstas), unidade: "peças previstas", sub: `${plural(new Set(k.previsoesHoje.map((i) => i.tid)).size, "técnico com compromisso", "técnicos com compromisso")}`, legenda: "Peças na agenda de 7 dias", partes: [{ nome: "Hoje", valor: previstas, cor: "warn" }, { nome: "Próximos dias", valor: somar(agenda.slice(1), (d) => d.qtd), cor: "series-1" }], rodape: "Conferir previsões", acao: 'data-acao="painel-cobrancas" data-aba="previsoes"', icone: "calendario" }),
    kpiOperacional({ tipo: "estoque", rotulo: "Peças novas com técnicos", valor: estoque.temRelatorio ? fmtNum(estoque.total) : "—", unidade: "peças em estoque", sub: estoque.temRelatorio ? `${plural(estoque.tecnicos.length, "técnico acompanhado", "técnicos acompanhados")}` : "Importe a planilha de peças novas", legenda: estoque.temRelatorio ? "Técnicos por faixa de estoque" : "Sem relatório de estoque", partes: [{ nome: "Abaixo", valor: estoque.temRelatorio ? estoque.abaixo.length : null, cor: "warn" }, { nome: "Na faixa", valor: estoque.temRelatorio ? estoque.tecnicos.filter((t) => t.statusNovas === "ideal").length : null, cor: "good" }, { nome: "Acima", valor: estoque.temRelatorio ? estoque.tecnicos.filter((t) => t.statusNovas === "acima").length : null, cor: "serious" }], rodape: "Analisar estoque", acao: 'data-acao="painel-estoque"', icone: "caixa" }),
  ];
  const botaoTabela = (id) => `<button class="btn fantasma pequeno" data-acao="alternar-tabela" data-grafico="${id}">${icone(UIpainel.tabelas.has(id) ? "grafico" : "tabela")}${UIpainel.tabelas.has(id) ? "Gráfico" : "Tabela"}</button>`;
  const tab = (id, corpo, tabela) => UIpainel.tabelas.has(id) ? tabela : corpo;
  const periodo = `<div class="filtros-segmentados">${[7, 30].map((dias) => `<button type="button" class="${UIpainel.periodo === dias ? "ativo" : ""}" data-acao="painel-periodo" data-periodo="${dias}" aria-pressed="${UIpainel.periodo === dias}">${dias} dias</button>`).join("")}</div>`;
  const hist = historicoDoPainel();
  const evolucao = hist.length > 1 ? `<div class="grafico" data-grafico="evolucao"></div>` : `<div class="historico-inicial">${icone("grafico")}<strong>${hist.length ? "Histórico iniciado" : "Ainda sem importações neste período"}</strong><p>A evolução será exibida após a importação de relatórios em dias diferentes.</p>${hist.length ? `<span>${fmtData(hist[0].data)} · ${plural(hist[0].tot.usadas, "peça pendente", "peças pendentes")}</span>` : ""}</div>`;
  return `<div class="painel-operacao">
    ${leituraOperacional(D)}
    <div class="kpis kpis-4 indicadores-operacao">${indicadores.join("")}</div>
    ${faixaGestao(D)}${barraPrioridade(D)}${avisoAtualizacao(D)}
    <div class="grade-operacao">${filaHoje(D)}${mapaOperacao(D)}</div>
    ${agendaDevolucoes(D)}
    ${renderRankings(D)}
    <div class="grade-analise">${saudePrazos(D)}${cartao("Evolução das pendências", tab("evolucao", evolucao, tabelaEvolucao()), { sub: "Peças pendentes e atrasadas nas importações do período.", acoes: periodo + botaoTabela("evolucao"), classe: "cartao-evolucao" })}</div>
    <div class="grade-2">${cartao("Onde o atraso se concentra", tab("idade", `<div class="grafico" data-grafico="idade"></div>`, tabelaFaixas(D)), { sub: "Clique em uma faixa para abrir as peças correspondentes.", acoes: botaoTabela("idade") })}${reposicaoPainel(D)}</div>
    ${cartao("Devoluções confirmadas", devolvidasRecentes(D), { sub: "Peças que saíram do relatório após uma nova importação.", classe: "cartao-devolucoes" })}
  </div>`;
}

function tabelaFaixas(D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Dias com a peça</th><th class="num">Peças</th></tr></thead><tbody>
    ${D.faixas.map((f) => `<tr><td>${esc(f.rotulo)} dias</td><td class="num">${fmtNum(f.valor)}</td></tr>`).join("")}</tbody></table></div>`;
}
function tabelaEvolucao() {
  const h = historicoDoPainel();
  if (!h.length) return `<p class="nota">Sem histórico ainda.</p>`;
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Dia</th><th class="num">Pendentes</th><th class="num">Atrasadas</th><th class="num">Técnicos a cobrar</th></tr></thead><tbody>
    ${[...h].reverse().map((x) => `<tr><td>${fmtData(x.data)}</td><td class="num">${fmtNum(x.tot.usadas)}</td><td class="num">${fmtNum(x.tot.atrasadas)}</td><td class="num">${fmtNum(x.tot.cobrarTec)}</td></tr>`).join("")}</tbody></table></div>`;
}
function desenharPainel() {
  ligarMapaPainel();
  const D = derivar();
  const el = (id) => document.querySelector(`.grafico[data-grafico="${id}"]`);
  if (el("idade")) graficoColunas(el("idade"), {
    faixas: D.faixas, titulo: "Idade das peças usadas",
    aoClicar: (f) => { Object.assign(UI.us, { regiao: "", tid: "", busca: "", status: "todas", faixa: { min: f.min, max: f.max, rotulo: f.rotulo }, pagina: 1, aba: "pendentes" }); irPara("usadas"); },
  });
  if (el("evolucao")) {
    const h = historicoDoPainel();
    graficoLinhas(el("evolucao"), {
      datas: h.map((x) => x.data),
      series: [
        { nome: "Pendentes", cor: "var(--series-1)", valores: h.map((x) => x.tot.usadas) },
        { nome: "Atrasadas", cor: "var(--crit)", tracejado: true, valores: h.map((x) => x.tot.atrasadas) },
      ],
      vazio: "O gráfico ganha forma a cada dia importado.",
    });
  }
}
