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
function kpi({ rotulo, valor, sub = "", classe = "", acao = "", dica = "" }) {
  const tag = acao ? "button" : "div";
  return `<${tag} class="kpi ${classe}" ${acao} ${dica ? `title="${esc(dica)}"` : ""}>
    <span class="kpi-rotulo">${esc(rotulo)}</span>
    <span class="kpi-valor">${valor}</span>
    <span class="kpi-sub">${sub}</span>
  </${tag}>`;
}

function faixaDoDia(D) {
  const k = D.kpi;
  if (k.cobrarTecnicos) {
    return `<div class="faixa crit">
      ${icone("sino")}
      <div><strong>Hoje você precisa cobrar ${plural(k.cobrarTecnicos, "técnico", "técnicos")}</strong>
      <span>${plural(k.cobrarPecas, "peça usada passou", "peças usadas passaram")} do prazo de ${D.cfg.prazo} dias${k.prevVencida ? ` · ${plural(k.prevVencida, "peça", "peças")} com previsão vencida` : ""}.</span></div>
      <button class="btn prim" data-acao="ir" data-pagina="cobrancas">Abrir lista de cobrança ${icone("seta")}</button>
    </div>`;
  }
  return `<div class="faixa ok">${icone("ok")}<div><strong>Nenhum técnico para cobrar hoje</strong><span>Todas as peças usadas estão dentro do prazo de ${D.cfg.prazo} dias ou com previsão de devolução.</span></div></div>`;
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

function listaPrioridades(D, limite = 7) {
  const lista = D.cobrarTec.slice(0, limite);
  if (!lista.length) return vazio("ok", "Ninguém para cobrar", "Quando uma peça usada passar do prazo, o técnico aparece aqui.");
  return `<ul class="prioridades">${lista.map((t) => {
    const uc = t.ultimaCobranca;
    const situacao = t.nPrevVencida
      ? pill("crit", "Previsão vencida", "quebra")
      : uc && diffDias(uc.em.slice(0, 10), D.hoje) <= 1
        ? pill("neutro", `Cobrado ${fmtQuando(uc.em)}`, "mensagem")
        : pill("alerta", "Sem previsão", "calendario");
    return `<li>
      <button class="prioridade" data-acao="tecnico" data-tid="${esc(t.tid)}">
        ${avatar(t.nome, t.tipo)}
        <span class="prioridade-id"><strong>${esc(t.nome)}</strong>
        <span>${regiaoTag(t.regiao)} ${plural(t.nCobrar, "peça", "peças")} · mais antiga com ${t.maxDias} dias</span></span>
        ${situacao}
      </button>
      <button class="btn-icone whats" data-acao="cobrar" data-tid="${esc(t.tid)}" title="Cobrar ${esc(t.nome)}" aria-label="Cobrar ${esc(t.nome)}">${icone("mensagem")}</button>
    </li>`;
  }).join("")}</ul>
  ${D.cobrarTec.length > limite ? `<button class="link-mais" data-acao="ir" data-pagina="cobrancas">Ver os ${D.cobrarTec.length} técnicos ${icone("seta")}</button>` : ""}`;
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

const UIpainel = { tabelas: new Set() };

function renderPainel() {
  const D = derivar();
  if (!E.usadas.length && !E.novas.length) return boasVindas();
  const k = D.kpi, cfg = D.cfg;
  const ant = historicoAnterior();
  const at = ant && ant.tot;
  const pctAtr = k.usadas ? k.atrasadas / k.usadas : 0;
  const kpis = [
    kpi({ rotulo: "Peças usadas pendentes", valor: fmtNum(k.usadas), sub: `com ${plural(k.usadasTecnicos, "técnico", "técnicos")} ${at ? delta(k.usadas, at.usadas, true, ant.data) : ""}`, acao: `data-acao="ir" data-pagina="usadas"` }),
    kpi({ rotulo: `Atrasadas (mais de ${cfg.prazo} dias)`, valor: fmtNum(k.atrasadas), classe: k.atrasadas ? "crit" : "", sub: `${fmtPct(pctAtr)} das pendentes · mais antiga com ${k.maisAntiga} dias ${at ? delta(k.atrasadas, at.atrasadas, true, ant.data) : ""}`, acao: `data-acao="filtrar-usadas" data-status="atrasadas"` }),
    kpi({ rotulo: "Técnicos para cobrar hoje", valor: fmtNum(k.cobrarTecnicos), classe: k.cobrarTecnicos ? "alerta" : "", sub: `${plural(k.cobrarPecas, "peça", "peças")}${k.aguardando ? ` · ${fmtNum(k.aguardando)} aguardando previsão` : ""}`, acao: `data-acao="ir" data-pagina="cobrancas"` }),
    kpi({ rotulo: "Devolvidas nos últimos 7 dias", valor: k.temHistoricoDev ? fmtNum(k.devolvidas7) : "—", sub: k.temHistoricoDev ? (k.devolvidas7 ? `${fmtPct(k.devolvidas7NoPrazo / k.devolvidas7)} dentro do prazo` : "nenhuma devolução registrada") : "começa a contar na próxima importação" }),
    kpi({ rotulo: "Peças novas com técnicos", valor: fmtNum(k.novas), sub: `média de ${fmtNum1(k.mediaNovas)} por técnico · meta ${cfg.meta}`, acao: `data-acao="ir" data-pagina="estoque"` }),
    kpi({ rotulo: "Técnicos fora da meta de novas", valor: fmtNum(k.abaixo + k.acima), sub: `<span class="tendencia">${icone("desce")}${fmtNum(k.abaixo)} abaixo</span> <span class="tendencia">${icone("sobe")}${fmtNum(k.acima)} acima</span> · ${fmtNum(k.ideal)} na meta`, acao: `data-acao="ir" data-pagina="estoque"` }),
  ];
  const botaoTabela = (id) => `<button class="btn fantasma pequeno" data-acao="alternar-tabela" data-grafico="${id}">${icone(UIpainel.tabelas.has(id) ? "grafico" : "tabela")}${UIpainel.tabelas.has(id) ? "Gráfico" : "Tabela"}</button>`;
  const seriesRegiao = [
    { chave: "no_prazo", nome: "No prazo", cor: "var(--good)" },
    { chave: "vencendo", nome: "Vence em breve", cor: "var(--warn)" },
    { chave: "aguardando", nome: "Atrasada com previsão", cor: "var(--series-1)" },
    { chave: "cobrar", nome: "Cobrar", cor: "var(--crit)" },
  ];
  const seriesEstoque = [
    { chave: "abaixo", nome: "Abaixo da meta", cor: "var(--warn)" },
    { chave: "ideal", nome: "Na meta", cor: "var(--good)" },
    { chave: "acima", nome: "Acima da meta", cor: "var(--serious)" },
  ];
  const tab = (id, corpo, tabela) => (UIpainel.tabelas.has(id) ? tabela : corpo);
  return `
    ${faixaDoDia(D)}
    ${avisoAtualizacao(D)}
    <div class="kpis">${kpis.join("")}</div>
    <div class="grade-2">
      ${cartao("Quem cobrar hoje", listaPrioridades(D), { sub: "Ordem: previsão vencida primeiro, depois a peça mais antiga", acoes: `<button class="btn pequeno" data-acao="ir" data-pagina="cobrancas">Lista completa</button>` })}
      ${cartao("Idade das peças usadas", tab("idade", `<div class="grafico" data-grafico="idade"></div>`, tabelaFaixas(D)), { sub: "Quantidade de peças por dias com o técnico. Clique numa coluna para ver as peças.", acoes: botaoTabela("idade") })}
    </div>
    <div class="grade-2">
      ${cartao("Situação por região", tab("regioes", legendaHTML(seriesRegiao) + `<div class="grafico" data-grafico="regioes"></div>`, tabelaRegioes(D)), { sub: "Peças usadas pendentes em cada estado", acoes: botaoTabela("regioes") })}
      ${cartao("Evolução", tab("evolucao", `<div class="grafico" data-grafico="evolucao"></div>`, tabelaEvolucao()), { sub: "Peças usadas pendentes e atrasadas em cada dia importado", acoes: botaoTabela("evolucao") })}
    </div>
    <div class="grade-2">
      ${cartao("Estoque de peças novas", tab("estoque", legendaHTML(seriesEstoque) + `<div class="grafico" data-grafico="estoque"></div>`, tabelaEstoqueRegiao(D)), { sub: `Técnicos por situação em relação à meta de ${cfg.meta} peças (faixa ${Math.max(0, cfg.meta - cfg.tolerancia)} a ${Number(cfg.meta) + Number(cfg.tolerancia)})`, acoes: botaoTabela("estoque") })}
      ${cartao("Devolvidas recentemente", devolvidasRecentes(D), { sub: "Peças que saíram do relatório de usadas" })}
    </div>`;
}

function tabelaFaixas(D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Dias com a peça</th><th class="num">Peças</th></tr></thead><tbody>
    ${D.faixas.map((f) => `<tr><td>${esc(f.rotulo)} dias</td><td class="num">${fmtNum(f.valor)}</td></tr>`).join("")}</tbody></table></div>`;
}
function tabelaRegioes(D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Região</th><th class="num">No prazo</th><th class="num">Vence em breve</th><th class="num">Com previsão</th><th class="num">Cobrar</th><th class="num">Total</th></tr></thead><tbody>
    ${D.porRegiao.map((r) => `<tr><td>${esc(r.regiao)}</td><td class="num">${fmtNum(r.no_prazo)}</td><td class="num">${fmtNum(r.vencendo)}</td><td class="num">${fmtNum(r.aguardando)}</td><td class="num">${fmtNum(r.cobrar)}</td><td class="num">${fmtNum(r.total)}</td></tr>`).join("")}</tbody></table></div>`;
}
function tabelaEvolucao() {
  const h = E.historico.slice(-30);
  if (!h.length) return `<p class="nota">Sem histórico ainda.</p>`;
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Dia</th><th class="num">Pendentes</th><th class="num">Atrasadas</th><th class="num">Técnicos a cobrar</th></tr></thead><tbody>
    ${[...h].reverse().map((x) => `<tr><td>${fmtData(x.data)}</td><td class="num">${fmtNum(x.tot.usadas)}</td><td class="num">${fmtNum(x.tot.atrasadas)}</td><td class="num">${fmtNum(x.tot.cobrarTec)}</td></tr>`).join("")}</tbody></table></div>`;
}
function tabelaEstoqueRegiao(D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Região</th><th class="num">Abaixo</th><th class="num">Na meta</th><th class="num">Acima</th><th class="num">Peças novas</th></tr></thead><tbody>
    ${D.porRegiao.map((r) => `<tr><td>${esc(r.regiao)}</td><td class="num">${fmtNum(r.abaixo)}</td><td class="num">${fmtNum(r.ideal)}</td><td class="num">${fmtNum(r.acima)}</td><td class="num">${fmtNum(r.novas)}</td></tr>`).join("")}</tbody></table></div>`;
}

function desenharPainel() {
  const D = derivar();
  const el = (id) => document.querySelector(`.grafico[data-grafico="${id}"]`);
  if (el("idade")) graficoColunas(el("idade"), {
    faixas: D.faixas, titulo: "Idade das peças usadas",
    aoClicar: (f) => { Object.assign(UI.us, { status: "todas", faixa: { min: f.min, max: f.max, rotulo: f.rotulo }, pagina: 1, aba: "pendentes" }); irPara("usadas"); },
  });
  if (el("regioes")) graficoEmpilhado(el("regioes"), {
    linhas: D.porRegiao.filter((r) => r.total).map((r) => ({ rotulo: r.regiao, partes: r })),
    series: [
      { chave: "no_prazo", nome: "No prazo", cor: "var(--good)" },
      { chave: "vencendo", nome: "Vence em breve", cor: "var(--warn)" },
      { chave: "aguardando", nome: "Atrasada com previsão", cor: "var(--series-1)" },
      { chave: "cobrar", nome: "Cobrar", cor: "var(--crit)" },
    ],
    aoClicar: (l) => { Object.assign(UI.us, { regiao: l.rotulo, status: "todas", faixa: null, pagina: 1, aba: "pendentes" }); irPara("usadas"); },
  });
  if (el("evolucao")) {
    const h = E.historico.slice(-30);
    graficoLinhas(el("evolucao"), {
      datas: h.map((x) => x.data),
      series: [
        { nome: "Pendentes", cor: "var(--series-1)", valores: h.map((x) => x.tot.usadas) },
        { nome: "Atrasadas", cor: "var(--crit)", valores: h.map((x) => x.tot.atrasadas) },
      ],
      vazio: "O gráfico ganha forma a cada dia importado.",
    });
  }
  if (el("estoque")) graficoEmpilhado(el("estoque"), {
    linhas: D.porRegiao.filter((r) => r.abaixo + r.ideal + r.acima).map((r) => ({ rotulo: r.regiao, partes: r })),
    series: [
      { chave: "abaixo", nome: "Abaixo da meta", cor: "var(--warn)" },
      { chave: "ideal", nome: "Na meta", cor: "var(--good)" },
      { chave: "acima", nome: "Acima da meta", cor: "var(--serious)" },
    ],
    unidade: ["técnico", "técnicos"],
    aoClicar: (l, serie) => { Object.assign(UI.es, { regiao: l.rotulo, status: serie }); irPara("estoque"); },
  });
}
