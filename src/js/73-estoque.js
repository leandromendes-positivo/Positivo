/* ==========================================================================
   Página: Estoque de peças novas — cada técnico contra a meta.
   ========================================================================== */

function renderEstoque() {
  const D = derivar();
  const s = UI.es;
  if (!E.novas.length) {
    return vazio("caixa", "Sem peças novas importadas", "Importe as planilhas de peças novas para comparar o estoque de cada técnico com a meta.", `<button class="btn prim" data-acao="ir" data-pagina="importar">Importar planilhas</button>`);
  }
  const cfg = D.cfg;
  const busca = normBusca(s.busca);
  const base = D.tecnicos.filter((t) => t.tipo === (s.bases ? "base" : "tecnico") && (t.novasLinhas.length || t.usadas.length));
  let lista = base.filter((t) =>
    (!s.regiao || t.regiao === s.regiao) &&
    (!s.status || t.statusNovas === s.status) &&
    (!busca || normBusca(t.nome + " " + t.nomeOriginal).includes(busca)));
  lista = ordenarLista(lista, s.ordem, { nome: (t) => t.nome, novasQtd: (t) => t.novasQtd, dif: (t) => t.difNovas, itens: (t) => t.novasItens });
  const tipos = D.tiposEnvio;
  const k = D.kpi;
  const contagem = (st) => base.filter((t) => (!s.regiao || t.regiao === s.regiao) && t.statusNovas === st).length;

  const kpis = s.bases ? "" : `<div class="kpis kpis-4">
    ${kpi({ rotulo: "Peças novas com técnicos", valor: fmtNum(k.novas), sub: `${plural(k.novasTecnicos, "técnico", "técnicos")} com estoque` })}
    ${kpi({ rotulo: "Média por técnico", valor: fmtNum1(k.mediaNovas), sub: `meta de ${cfg.meta} (faixa ${Math.max(0, cfg.meta - cfg.tolerancia)} a ${Number(cfg.meta) + Number(cfg.tolerancia)})` })}
    ${kpi({ rotulo: "Abaixo da meta", valor: fmtNum(k.abaixo), classe: k.abaixo ? "alerta" : "", sub: "precisam de reposição", acao: `data-acao="status-es" data-status="abaixo"` })}
    ${kpi({ rotulo: "Acima da meta", valor: fmtNum(k.acima), classe: k.acima ? "grave" : "", sub: "excesso para recolher ou redistribuir", acao: `data-acao="status-es" data-status="acima"` })}
  </div>`;

  const filtros = `<div class="barra-filtros">
    <div class="chips">
      <button class="chip${!s.bases ? " ativo" : ""}" data-acao="bases-es" data-v="0">Técnicos</button>
      <button class="chip${s.bases ? " ativo" : ""}" data-acao="bases-es" data-v="1">Bases e depósitos <span>${fmtNum(D.tecnicos.filter((t) => t.tipo === "base" && t.temDados).length)}</span></button>
    </div>
    ${!s.bases ? `<div class="chips">
      <button class="chip${!s.status ? " ativo" : ""}" data-acao="status-es" data-status="">Todos</button>
      <button class="chip${s.status === "abaixo" ? " ativo" : ""}" data-acao="status-es" data-status="abaixo">Abaixo <span>${contagem("abaixo")}</span></button>
      <button class="chip${s.status === "ideal" ? " ativo" : ""}" data-acao="status-es" data-status="ideal">Na meta <span>${contagem("ideal")}</span></button>
      <button class="chip${s.status === "acima" ? " ativo" : ""}" data-acao="status-es" data-status="acima">Acima <span>${contagem("acima")}</span></button>
    </div>` : ""}
    <select data-mudar="regiao-es" aria-label="Região"><option value="">Todas as regiões</option>${D.regioes.map((r) => `<option value="${esc(r)}"${s.regiao === r ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>
    <label class="busca-campo">${icone("busca")}<input type="search" placeholder="Buscar técnico" value="${esc(s.busca)}" data-digitar="busca-es" aria-label="Buscar técnico"></label>
    <button class="btn" data-acao="exportar-estoque">${icone("baixar")}Exportar</button>
  </div>`;

  const tabela = lista.length ? `<div class="tabela-rolagem"><table class="tabela tabela-estoque">
    <thead><tr>
      ${thOrdenavel(s.bases ? "Base / depósito" : "Técnico", "nome", s.ordem, "es")}
      <th>UF</th>
      ${thOrdenavel("Peças novas", "novasQtd", s.ordem, "es")}
      ${thOrdenavel("Itens", "itens", s.ordem, "es", "num")}
      ${tipos.map((t) => `<th class="num">${esc(t)}</th>`).join("")}
      ${s.bases ? "" : `<th class="num">Meta</th>${thOrdenavel("Diferença", "dif", s.ordem, "es", "num")}<th>Situação</th>`}
      <th></th>
    </tr></thead>
    <tbody>${lista.map((t) => {
      const aberto = s.abertos.has(t.tid);
      return `<tr class="${aberto ? "aberta" : ""}">
        <td><span class="celula-tec">${avatar(t.nome, t.tipo)}<button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button></span></td>
        <td>${regiaoTag(t.regiao)}</td>
        <td>${s.bases ? `<strong>${fmtNum(t.novasQtd)}</strong>` : medidorEstoque(t)}</td>
        <td class="num">${fmtNum(t.novasItens)}</td>
        ${tipos.map((tp) => `<td class="num">${t.porTipo[tp] ? fmtNum(t.porTipo[tp]) : `<span class="apagado">—</span>`}</td>`).join("")}
        ${s.bases ? "" : `<td class="num">${t.meta}${t.metaPropria != null ? `<small class="sub-celula">própria</small>` : ""}</td>
        <td class="num ${t.difNovas > 0 ? "txt-grave" : t.difNovas < 0 ? "txt-alerta" : ""}">${t.difNovas > 0 ? "+" : ""}${fmtNum(t.difNovas)}</td>
        <td>${pillNovas(t)}</td>`}
        <td><button class="btn-icone" data-acao="abrir-es" data-tid="${esc(t.tid)}" aria-expanded="${aberto}" aria-label="Ver peças">${icone(aberto ? "cima" : "baixo")}</button></td>
      </tr>${aberto ? `<tr class="detalhe"><td colspan="${5 + tipos.length + (s.bases ? 0 : 3)}">${tabelaLinhasNovas(t)}</td></tr>` : ""}`;
    }).join("")}</tbody></table></div>` : vazio("filtro", "Ninguém com estes filtros", "Mude os filtros acima.");

  return `${kpis}${filtros}${tabela}`;
}

function tabelaLinhasNovas(t) {
  const linhas = [...t.novasLinhas].sort((a, b) => b.qtd - a.qtd);
  if (!linhas.length) return `<p class="nota">Sem peças novas no relatório.</p>`;
  return `<table class="tabela compacta interna">
    <thead><tr><th>Material</th><th>Tipo</th><th class="num">Qtd</th><th class="num">Linhas</th><th>No relatório desde</th></tr></thead>
    <tbody>${linhas.slice(0, 200).map((n) => `<tr class="${n.conta ? "" : "apagado"}">
      <td><span class="mat"><span class="mono">${esc(n.mat)}</span>${esc(n.desc)}</span></td>
      <td>${tagTipoEnvio(n.tipoEnvio)}${n.conta ? "" : ` <small>não conta na meta</small>`}</td>
      <td class="num"><strong>${fmtNum(n.qtd)}</strong></td>
      <td class="num">${fmtNum(n.linhas)}</td>
      <td class="nowrap">${fmtData(n.desde)}${n.dias ? ` <small>(${n.dias} dias)</small>` : ""}</td>
    </tr>`).join("")}</tbody></table>${linhas.length > 200 ? `<p class="nota">Mostrando 200 de ${fmtNum(linhas.length)} materiais. Exporte para ver todos.</p>` : ""}`;
}

async function exportarEstoque() {
  const D = derivar();
  const tipos = D.tiposEnvio;
  const tecs = D.tecnicos.filter((t) => t.novasLinhas.length || (t.tipo === "tecnico" && t.temDados));
  const resumo = tecs.map((t) => [t.nome, TIPOS_TEC[t.tipo], t.regiao, t.novasQtd, t.novasItens, ...tipos.map((tp) => t.porTipo[tp] || 0), t.tipo === "tecnico" ? t.meta : "", t.tipo === "tecnico" ? t.difNovas : "", t.tipo === "tecnico" ? STATUS_NOVAS[t.statusNovas].rotulo : ""]);
  const linhas = [];
  for (const t of tecs) for (const n of t.novasLinhas) linhas.push([t.nome, t.regiao, n.mat, n.desc, n.tipoEnvio, n.qtd, n.linhas, n.desde]);
  await exportarExcel(`estoque-novas-${D.hoje}.xlsx`, [
    {
      nome: "Por técnico",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "Tipo", largura: 14 }, { titulo: "UF", largura: 5 }, { titulo: "Peças novas (conta na meta)", largura: 12, tipo: "numero" }, { titulo: "Itens", largura: 8, tipo: "numero" },
        ...tipos.map((tp) => ({ titulo: tp, largura: 11, tipo: "numero" })), { titulo: "Meta", largura: 7, tipo: "numero" }, { titulo: "Diferença", largura: 9, tipo: "numero" }, { titulo: "Situação", largura: 16 }],
      linhas: resumo,
    },
    {
      nome: "Materiais",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 42 }, { titulo: "Tipo", largura: 12 }, { titulo: "Qtd", largura: 7, tipo: "numero" }, { titulo: "Linhas no relatório", largura: 9, tipo: "numero" }, { titulo: "No relatório desde", largura: 12, tipo: "data" }],
      linhas,
    },
  ]);
}
