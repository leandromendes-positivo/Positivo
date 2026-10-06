/* ==========================================================================
   Página: Peças usadas — tabela completa, filtros, seleção em lote e
   histórico de devolvidas.
   ========================================================================== */

const FILTROS_STATUS = [
  { id: "todas", rotulo: "Todas" },
  { id: "cobrar", rotulo: "Cobrar", f: (i) => i.cobrar },
  { id: "atrasadas", rotulo: "Atrasadas", f: (i) => i.atrasada },
  { id: "vencendo", rotulo: "Vencem em breve", f: (i) => i.status === "vencendo" },
  { id: "no_prazo", rotulo: "No prazo", f: (i) => i.status === "no_prazo" },
  { id: "aguardando", rotulo: "Com previsão", f: (i) => !!i.previsao },
  { id: "previsao_vencida", rotulo: "Previsão vencida", f: (i) => i.status === "previsao_vencida" },
];
const POR_PAGINA = 50;

function filtrarUsadas(D) {
  const s = UI.us;
  const fs = FILTROS_STATUS.find((x) => x.id === s.status);
  const busca = normBusca(s.busca);
  return D.itens.filter((i) =>
    (!fs || !fs.f || fs.f(i)) &&
    (!s.regiao || i.regiao === s.regiao) &&
    (!s.tid || i.tid === s.tid) &&
    (!s.faixa || (i.dias >= s.faixa.min && i.dias <= s.faixa.max)) &&
    (!busca || normBusca(`${i.nome} ${i.chamado} ${i.mat} ${i.desc} ${i.nf} ${i.remessa} ${i.obs}`).includes(busca))
  );
}

function renderUsadas() {
  const D = derivar();
  const s = UI.us;
  if (!E.usadas.length && s.aba === "pendentes") {
    return vazio("upload", "Sem peças usadas importadas", "Importe as planilhas de peças usadas para acompanhar os prazos.", `<button class="btn prim" data-acao="ir" data-pagina="importar">Importar planilhas</button>`);
  }
  const abas = `<div class="abas" role="tablist">
    <button role="tab" class="aba${s.aba === "pendentes" ? " ativa" : ""}" data-acao="aba-us" data-aba="pendentes">Pendentes<span class="contador">${fmtNum(D.kpi.usadas)}</span></button>
    <button role="tab" class="aba${s.aba === "devolvidas" ? " ativa" : ""}" data-acao="aba-us" data-aba="devolvidas">Devolvidas (últimos 120 dias)<span class="contador">${fmtNum(somar(E.devolucoes, (d) => d.qtd))}</span></button>
  </div>`;
  const tecnicosComPeca = D.tecnicos.filter((t) => t.usadas.length || E.devolucoes.some((d) => d.tid === t.tid));
  const filtros = `<div class="barra-filtros">
    ${s.aba === "pendentes" ? `<div class="chips">${FILTROS_STATUS.map((f) => {
      const n = somar(f.f ? D.itens.filter(f.f) : D.itens, (i) => i.qtd);
      return `<button class="chip${s.status === f.id ? " ativo" : ""}" data-acao="status-us" data-status="${f.id}">${esc(f.rotulo)} <span>${fmtNum(n)}</span></button>`;
    }).join("")}</div>` : ""}
    <select data-mudar="regiao-us" aria-label="Região"><option value="">Todas as regiões</option>${D.regioes.map((r) => `<option value="${esc(r)}"${s.regiao === r ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>
    <select data-mudar="tecnico-us" aria-label="Técnico"><option value="">Todos os técnicos</option>${tecnicosComPeca.map((t) => `<option value="${esc(t.tid)}"${s.tid === t.tid ? " selected" : ""}>${esc(t.nome)}</option>`).join("")}</select>
    <label class="busca-campo">${icone("busca")}<input type="search" placeholder="Chamado, material, descrição, NF…" value="${esc(s.busca)}" data-digitar="busca-us" aria-label="Buscar"></label>
    ${s.faixa ? `<button class="chip ativo" data-acao="limpar-faixa">${esc(s.faixa.rotulo)} dias ${icone("fechar")}</button>` : ""}
    <button class="btn" data-acao="exportar-usadas">${icone("baixar")}Exportar</button>
  </div>`;
  return `${abas}${filtros}<div id="area-usadas">${s.aba === "pendentes" ? tabelaUsadas(D) : tabelaDevolvidas(D)}</div>`;
}

function tabelaUsadas(D) {
  const s = UI.us;
  const lista = ordenarLista(filtrarUsadas(D), s.ordem, {
    nome: (i) => i.nome, dias: (i) => i.dias, dataFT: (i) => i.dataFT, previsao: (i) => i.previsao || null,
    status: (i) => ["previsao_vencida", "atrasada", "aguardando", "vencendo", "no_prazo"].indexOf(i.status),
  });
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (s.pagina > paginas) s.pagina = paginas;
  const pagina = lista.slice((s.pagina - 1) * POR_PAGINA, s.pagina * POR_PAGINA);
  const sel = s.sel;
  for (const k of [...sel]) if (!D.itens.some((i) => i.k === k)) sel.delete(k);
  const todosMarcados = pagina.length && pagina.every((i) => sel.has(i.k));
  const barraLote = sel.size ? `<div class="barra-lote">
      <strong>${plural(sel.size, "peça selecionada", "peças selecionadas")}</strong>
      <button class="btn pequeno prim" data-acao="lote-previsao">${icone("calendario")}Definir previsão</button>
      <button class="btn pequeno" data-acao="lote-cobranca">${icone("mensagem")}Registrar cobrança</button>
      <button class="btn pequeno fantasma" data-acao="lote-limpar">Limpar seleção</button>
    </div>` : "";
  if (!lista.length) return barraLote + vazio("filtro", "Nenhuma peça com estes filtros", "Mude os filtros acima para ver outras peças.");
  return `${barraLote}<div class="tabela-rolagem"><table class="tabela">
    <thead><tr>
      <th class="col-sel"><input type="checkbox" data-mudar="marcar-pagina" ${todosMarcados ? "checked" : ""} aria-label="Selecionar página"></th>
      ${thOrdenavel("Técnico", "nome", s.ordem, "us")}
      <th>UF</th>
      ${thOrdenavel("Chamado", "chamado", s.ordem, "us")}
      ${thOrdenavel("Material", "mat", s.ordem, "us")}
      <th class="num">Qtd</th>
      ${thOrdenavel("Data FT", "dataFT", s.ordem, "us")}
      ${thOrdenavel("Dias", "dias", s.ordem, "us", "num")}
      ${thOrdenavel("Situação", "status", s.ordem, "us")}
      ${thOrdenavel("Previsão", "previsao", s.ordem, "us")}
      <th>Observação</th>
    </tr></thead>
    <tbody>${pagina.map((i) => `<tr class="${sel.has(i.k) ? "selecionada" : ""}">
      <td class="col-sel"><input type="checkbox" data-mudar="marcar" data-k="${esc(i.k)}" ${sel.has(i.k) ? "checked" : ""} aria-label="Selecionar"></td>
      <td class="col-tec"><button class="link-forte" data-acao="tecnico" data-tid="${esc(i.tid)}">${esc(i.nome)}</button>${i.tipoTec === "base" ? ` <span class="tag">BASE</span>` : ""}</td>
      <td>${regiaoTag(i.regiao)}</td>
      <td class="mono">${esc(i.chamado || "—")}</td>
      <td><span class="mat"><span class="mono">${esc(i.mat)}</span>${esc(i.desc)}</span></td>
      <td class="num">${fmtNum(i.qtd)}</td>
      <td class="mono nowrap">${fmtData(i.dataFT)}</td>
      <td class="num"><strong>${i.dias}</strong></td>
      <td>${pillStatus(i, D.cfg)}${i.nCobrancas ? `<small class="sub-celula">${plural(i.nCobrancas, "cobrança", "cobranças")}, última ${fmtQuando(i.ultimaCobranca)}</small>` : ""}</td>
      <td>${campoPrevisao(i)}</td>
      <td><input type="text" class="campo-obs" value="${esc(i.obs)}" placeholder="Anotar…" maxlength="300" data-mudar="obs-item" data-tid="${esc(i.tid)}" data-k="${esc(i.k)}" aria-label="Observação"></td>
    </tr>`).join("")}</tbody></table></div>
    ${paginacao(lista.length, s.pagina, POR_PAGINA, "us")}`;
}

function tabelaDevolvidas(D) {
  const s = UI.us;
  const busca = normBusca(s.busca);
  let lista = E.devolucoes.filter((d) =>
    (!s.regiao || d.regiao === s.regiao) && (!s.tid || d.tid === s.tid) &&
    (!busca || normBusca(`${nomeTecnico(d.tid)} ${d.chamado} ${d.mat} ${E.catalogo[d.mat] || ""}`).includes(busca)));
  lista = [...lista].sort((a, b) => comparar(b.em, a.em));
  if (!lista.length) {
    return vazio("retorno", "Nenhuma devolução registrada", "Quando uma peça usada sumir do relatório numa importação, ela aparece aqui com a data e quantos dias ficou com o técnico.");
  }
  const pag = Math.max(1, Math.min(s.paginaDev || 1, Math.ceil(lista.length / POR_PAGINA)));
  const pagina = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const noPrazo = somar(lista.filter((d) => d.dias <= D.cfg.prazo), (d) => d.qtd);
  const total = somar(lista, (d) => d.qtd);
  return `<p class="nota-aba">${icone("info")}<span>${plural(total, "peça devolvida", "peças devolvidas")}, ${fmtPct(noPrazo / Math.max(1, total))} dentro do prazo de ${D.cfg.prazo} dias. Tempo médio com o técnico: ${fmtNum1(somar(lista, (d) => d.dias * d.qtd) / Math.max(1, total))} dias.</span></p>
  <div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>Técnico</th><th>UF</th><th>Chamado</th><th>Material</th><th>Data FT</th><th>Saiu do relatório</th><th class="num">Dias com o técnico</th><th>Prazo</th></tr></thead>
    <tbody>${pagina.map((d) => `<tr>
      <td class="col-tec"><button class="link-forte" data-acao="tecnico" data-tid="${esc(d.tid)}">${esc(nomeTecnico(d.tid))}</button></td>
      <td>${regiaoTag(d.regiao)}</td>
      <td class="mono">${esc(d.chamado || "—")}</td>
      <td><span class="mat"><span class="mono">${esc(d.mat)}</span>${esc(E.catalogo[d.mat] || "")}</span></td>
      <td class="mono nowrap">${fmtData(d.dataFT)}</td>
      <td class="nowrap">${fmtDataHora(d.em)}</td>
      <td class="num"><strong>${d.dias}</strong></td>
      <td>${d.dias <= D.cfg.prazo ? pill("ok", "No prazo", "ok") : pill("grave", `${d.dias - D.cfg.prazo} dias após`, "relogio")}</td>
    </tr>`).join("")}</tbody></table></div>
    ${paginacao(lista.length, pag, POR_PAGINA, "dev")}`;
}

async function exportarUsadas() {
  const D = derivar();
  if (UI.us.aba === "devolvidas") {
    const linhas = [...E.devolucoes].sort((a, b) => comparar(b.em, a.em)).map((d) => [nomeTecnico(d.tid), d.regiao, d.chamado, d.mat, E.catalogo[d.mat] || "", d.dataFT, d.em, d.dias, d.dias <= D.cfg.prazo ? "No prazo" : "Atrasada", d.qtd]);
    return exportarExcel(`pecas-devolvidas-${D.hoje}.xlsx`, [{
      nome: "Devolvidas",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Chamado", largura: 14 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 }, { titulo: "Data FT", largura: 12, tipo: "data" }, { titulo: "Saiu do relatório", largura: 16, tipo: "data" }, { titulo: "Dias com o técnico", largura: 10, tipo: "numero" }, { titulo: "Prazo", largura: 10 }, { titulo: "Qtd", largura: 6, tipo: "numero" }],
      linhas,
    }]);
  }
  const lista = filtrarUsadas(D).sort((a, b) => b.dias - a.dias);
  await exportarExcel(`pecas-usadas-${D.hoje}.xlsx`, [{
    nome: "Peças usadas",
    colunas: [
      { titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Chamado", largura: 14 },
      { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 }, { titulo: "Data FT", largura: 12, tipo: "data" },
      { titulo: "Dias com a peça", largura: 9, tipo: "numero" }, { titulo: "Situação", largura: 16 },
      { titulo: "Previsão", largura: 12, tipo: "data" }, { titulo: "Observação", largura: 30 },
      { titulo: "Nº de cobranças", largura: 9, tipo: "numero" }, { titulo: "Última cobrança", largura: 16, tipo: "data" },
      { titulo: "Qtd", largura: 6, tipo: "numero" }, { titulo: "Nota fiscal", largura: 12 }, { titulo: "Remessa", largura: 13 },
      { titulo: "Na lista desde", largura: 12, tipo: "data" },
    ],
    linhas: lista.map((i) => [i.nome, i.regiao, i.chamado, i.mat, i.desc, i.dataFT, i.dias, STATUS[i.status].rotulo, i.previsao, i.obs, i.nCobrancas, i.ultimaCobranca, i.qtd, i.nf, i.remessa, i.desde]),
  }]);
}
