/* ==========================================================================
   Página: Cobranças — a lista de trabalho do dia, um cartão por técnico.
   ========================================================================== */

const ABAS_COB = [
  { id: "cobrar", rotulo: "Cobrar hoje", dica: "Peças com mais de {prazo} dias sem previsão, ou com a previsão vencida" },
  { id: "vencendo", rotulo: "Vencem em breve", dica: "Peças entre {alerta} e {prazo} dias: dá para lembrar o técnico antes de atrasar" },
  { id: "aguardando", rotulo: "Com previsão", dica: "Peças atrasadas com previsão de devolução informada pelo técnico" },
  { id: "previsoes", rotulo: "Previsões de hoje", dica: "Técnicos que prometeram devolver hoje: confira na próxima importação" },
  { id: "todos", rotulo: "Todos com pendência", dica: "Todos os técnicos com peças usadas no relatório" },
];

function itensDaAba(t, aba, hoje) {
  switch (aba) {
    case "cobrar": return t.itensCobrar;
    case "vencendo": return t.itensVencendo;
    case "aguardando": return t.itensAguardando;
    case "previsoes": return t.usadas.filter((i) => i.previsao === hoje);
    default: return t.usadas;
  }
}

function cartaoCobranca(t, aba, D) {
  const itens = itensDaAba(t, aba, D.hoje);
  const qtd = somar(itens, (i) => i.qtd);
  const aberto = UI.cob.abertos.has(t.tid);
  const uc = t.ultimaCobranca;
  const maxDias = itens.length ? Math.max(...itens.map((i) => i.dias)) : 0;
  const sev = t.nPrevVencida ? "crit" : t.nCobrar ? (maxDias > D.cfg.prazo * 2 ? "crit" : "grave") : t.nVencendo ? "alerta" : "ok";
  const rotuloQtd = { cobrar: "para cobrar", vencendo: "vencem em breve", aguardando: "com previsão", previsoes: "previstas p/ hoje", todos: "pendentes" }[aba];
  const infos = [];
  if (t.nPrevVencida) infos.push(pill("crit", `${plural(t.nPrevVencida, "peça", "peças")} com previsão vencida`, "quebra"));
  if (t.proxPrevisao) infos.push(pill("info", `Próxima previsão: ${fmtPrevisao(t.proxPrevisao)}`, "calendario"));
  else if (aba === "cobrar" && !t.nPrevVencida) infos.push(pill("alerta", "Sem previsão", "calendario"));
  infos.push(uc
    ? pill("neutro", `Última cobrança ${fmtQuando(uc.em)} · ${CANAIS[uc.canal] || uc.canal}`, "mensagem")
    : pill("neutro", "Ainda não cobrado", "mensagem"));
  if (t.tipo === "base") infos.push(pill("neutro", "Base / depósito", "base"));
  if (aba !== "todos" && t.nUsadas > qtd) infos.push(`<span class="nota">${fmtNum(t.nUsadas)} pendentes no total</span>`);

  const linhas = itens.slice(0, 25);
  return `<article class="cob sev-${sev}" data-tid="${esc(t.tid)}">
    <div class="cob-cab">
      ${avatar(t.nome, t.tipo)}
      <div class="cob-id">
        <h3><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button></h3>
        <div class="cob-meta">${regiaoTag(t.regiao)}${t.telefone ? `<span class="mono">${esc(fmtTelefone(t.telefone))}</span>` : `<button class="link" data-acao="editar-tecnico" data-tid="${esc(t.tid)}">${icone("telefone")}cadastrar WhatsApp</button>`}</div>
      </div>
      <div class="cob-numeros">
        <div><strong>${fmtNum(qtd)}</strong><span>${palavra(qtd, "peça", "peças")} ${rotuloQtd}</span></div>
        <div><strong>${maxDias}</strong><span>dias (mais antiga)</span></div>
      </div>
      ${reguaPrazo(maxDias, D.cfg)}
    </div>
    <div class="cob-rodape">
      <div class="cob-infos">${infos.join("")}</div>
      <div class="cob-acoes">
        <button class="btn fantasma" data-acao="abrir-cob" data-tid="${esc(t.tid)}" aria-expanded="${aberto}">${icone(aberto ? "cima" : "baixo")}${aberto ? "Esconder peças" : `Ver peças (${itens.length})`}</button>
        <button class="btn" data-acao="previsao-tecnico" data-tid="${esc(t.tid)}" data-aba="${aba}">${icone("calendario")}Previsão</button>
        <button class="btn prim" data-acao="cobrar" data-tid="${esc(t.tid)}" data-aba="${aba}">${icone("mensagem")}${aba === "vencendo" ? "Enviar lembrete" : "Cobrar"}</button>
      </div>
    </div>
    ${aberto ? `<div class="cob-itens">${tabelaItensCurta(linhas, D)}${itens.length > linhas.length ? `<button class="link-mais" data-acao="tecnico" data-tid="${esc(t.tid)}">Ver as ${fmtNum(itens.length)} peças na ficha do técnico ${icone("seta")}</button>` : ""}</div>` : ""}
  </article>`;
}

function tabelaItensCurta(itens, D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta">
    <thead><tr><th>Chamado</th><th>Material</th><th>Data FT</th><th class="num">Dias</th><th>Situação</th><th>Previsão</th></tr></thead>
    <tbody>${itens.map((i) => `<tr>
      <td class="mono">${esc(i.chamado || "—")}</td>
      <td><span class="mat"><span class="mono">${esc(i.mat)}</span>${esc(i.desc)}</span></td>
      <td class="mono">${fmtData(i.dataFT)}</td>
      <td class="num"><strong>${i.dias}</strong></td>
      <td>${pillStatus(i, D.cfg)}</td>
      <td>${campoPrevisao(i)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function campoPrevisao(i) {
  return `<input type="date" class="campo-data" value="${esc(i.previsao)}" data-mudar="previsao-item" data-tid="${esc(i.tid)}" data-k="${esc(i.k)}" aria-label="Previsão de devolução">`;
}

function renderCobrancas() {
  const D = derivar();
  if (!E.usadas.length) return vazio("upload", "Sem peças usadas importadas", "Importe as planilhas de peças usadas para ver quem precisa ser cobrado.", `<button class="btn prim" data-acao="ir" data-pagina="importar">Importar planilhas</button>`);
  const s = UI.cob;
  const busca = normBusca(s.busca);
  const contagem = {};
  const porAba = {};
  for (const a of ABAS_COB) {
    porAba[a.id] = D.tecnicos.filter((t) => itensDaAba(t, a.id, D.hoje).length);
    contagem[a.id] = porAba[a.id].length;
  }
  let lista = porAba[s.aba] || [];
  if (s.regiao) lista = lista.filter((t) => t.regiao === s.regiao);
  if (busca) lista = lista.filter((t) => normBusca(t.nome + " " + t.nomeOriginal).includes(busca));
  const maxAba = (t) => Math.max(0, ...itensDaAba(t, s.aba, D.hoje).map((i) => i.dias));
  const qtdAba = (t) => somar(itensDaAba(t, s.aba, D.hoje), (i) => i.qtd);
  if (s.ordem === "pecas") lista = [...lista].sort((a, b) => qtdAba(b) - qtdAba(a));
  else if (s.ordem === "nome") lista = [...lista].sort((a, b) => comparar(a.nome, b.nome));
  else lista = [...lista].sort((a, b) => (s.aba === "cobrar" ? (b.nPrevVencida > 0) - (a.nPrevVencida > 0) : 0) || maxAba(b) - maxAba(a) || qtdAba(b) - qtdAba(a));
  const aba = ABAS_COB.find((a) => a.id === s.aba);
  const dica = aba.dica.replace("{prazo}", D.cfg.prazo).replace("{alerta}", D.cfg.alerta);
  const totalPecas = somar(lista, qtdAba);

  return `
    <div class="abas" role="tablist">${ABAS_COB.map((a) => `<button role="tab" class="aba${a.id === s.aba ? " ativa" : ""}" aria-selected="${a.id === s.aba}" data-acao="aba-cob" data-aba="${a.id}">${esc(a.rotulo)}<span class="contador">${contagem[a.id]}</span></button>`).join("")}</div>
    <div class="barra-filtros">
      <div class="chips">${["", ...D.regioes].map((r) => `<button class="chip${s.regiao === r ? " ativo" : ""}" data-acao="regiao-cob" data-regiao="${esc(r)}">${r ? esc(r) : "Todas as regiões"}</button>`).join("")}</div>
      <label class="busca-campo">${icone("busca")}<input type="search" placeholder="Buscar técnico" value="${esc(s.busca)}" data-digitar="busca-cob" aria-label="Buscar técnico"></label>
      <select data-mudar="ordem-cob" aria-label="Ordenar">
        <option value="dias"${s.ordem === "dias" ? " selected" : ""}>Mais dias primeiro</option>
        <option value="pecas"${s.ordem === "pecas" ? " selected" : ""}>Mais peças primeiro</option>
        <option value="nome"${s.ordem === "nome" ? " selected" : ""}>Nome (A–Z)</option>
      </select>
      <button class="btn" data-acao="exportar-cobrancas">${icone("baixar")}Exportar lista</button>
      <button class="btn" data-acao="copiar-resumo">${icone("copiar")}Copiar resumo</button>
    </div>
    <p class="nota-aba">${icone("info")}<span>${esc(dica)}. ${lista.length ? `<strong>${plural(lista.length, "técnico", "técnicos")}</strong>, ${plural(totalPecas, "peça", "peças")}.` : ""}</span></p>
    <div class="lista-cob" id="lista-cob">
      ${lista.length ? lista.map((t) => cartaoCobranca(t, s.aba, D)).join("") : vazio("ok", "Nada por aqui", s.aba === "cobrar" ? "Nenhum técnico precisa ser cobrado hoje." : "Nenhum técnico nesta lista.")}
    </div>`;
}

/** Texto curto do dia para colar no WhatsApp/e-mail do supervisor. */
function resumoTexto() {
  const D = derivar();
  const linhas = [`*Controle de peças — ${fmtDataExtensa(D.hoje)}*`, ""];
  if (!D.cobrarTec.length) linhas.push("Nenhum técnico com peça usada atrasada.");
  else {
    linhas.push(`Técnicos para cobrar: ${D.cobrarTec.length} (${plural(D.kpi.cobrarPecas, "peça", "peças")})`, "");
    for (const t of D.cobrarTec.slice(0, 40)) {
      linhas.push(`• ${t.nome} (${t.regiao}) — ${plural(t.nCobrar, "peça", "peças")}, mais antiga com ${t.maxDias} dias${t.nPrevVencida ? " — previsão vencida" : ""}`);
    }
    if (D.cobrarTec.length > 40) linhas.push(`• ... e mais ${D.cobrarTec.length - 40}`);
  }
  linhas.push("", `Pendentes: ${fmtNum(D.kpi.usadas)} · Atrasadas: ${fmtNum(D.kpi.atrasadas)}`);
  return linhas.join("\n");
}

async function exportarCobrancas() {
  const D = derivar();
  const linhas = [];
  for (const t of D.cobrarTec) for (const i of t.itensCobrar) {
    linhas.push([t.nome, t.regiao, fmtTelefone(t.telefone), i.chamado, i.mat, i.desc, i.dataFT, i.dias, i.atraso, STATUS[i.status].rotulo, i.previsao, i.ultimaCobranca, i.nCobrancas, i.obs, i.nf, i.remessa]);
  }
  await exportarExcel(`cobrancas-${D.hoje}.xlsx`, [{
    nome: "Cobrar hoje",
    colunas: [
      { titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "WhatsApp", largura: 16 },
      { titulo: "Chamado", largura: 14 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 },
      { titulo: "Data FT", largura: 12, tipo: "data" }, { titulo: "Dias com a peça", largura: 9, tipo: "numero" },
      { titulo: "Dias de atraso", largura: 9, tipo: "numero" }, { titulo: "Situação", largura: 16 },
      { titulo: "Previsão", largura: 12, tipo: "data" }, { titulo: "Última cobrança", largura: 16, tipo: "data" },
      { titulo: "Nº de cobranças", largura: 9, tipo: "numero" }, { titulo: "Observação", largura: 30 },
      { titulo: "Nota fiscal", largura: 12 }, { titulo: "Remessa", largura: 13 },
    ],
    linhas,
  }]);
}
