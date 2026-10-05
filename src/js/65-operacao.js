/* Visão operacional: todos os números vêm das planilhas e previsões existentes. */
const MAPA_BRASIL = /*__MAPA_BRASIL__*/;

function cabecalhoOperacao(D, vazio = false) {
  const previstas = somar(D.kpi.previsoesHoje, (i) => i.qtd);
  const completas = D.frescor.length && D.frescor.every((f) => f.em && f.dias === 0);
  const titulo = vazio ? "Sua operação começa aqui." : D.kpi.cobrarTecnicos
    ? `${plural(D.kpi.cobrarTecnicos, "técnico precisa", "técnicos precisam")} do seu contato.`
    : "Nenhuma cobrança pendente nesta leitura.";
  const texto = vazio ? "Importe suas planilhas. Encontre as pendências. Acompanhe cada devolução."
    : `${plural(D.kpi.cobrarPecas, "peça para cobrar", "peças para cobrar")}. ${plural(previstas, "peça com devolução prevista", "peças com devolução prevista")} para hoje. Seu próximo passo está aqui.`;
  return `<section class="operacao-hero">
    <div class="hero-texto"><span class="hero-eyebrow">POSITIVO TECNOLOGIA <i></i> CONTROLE DE PEÇAS</span>
      <h2>${titulo}</h2><p>${texto}</p>
      <div class="hero-acoes"><button class="btn prim" data-acao="${vazio ? "ir" : "painel-cobrancas"}" ${vazio ? 'data-pagina="importar"' : `data-aba="${D.kpi.cobrarTecnicos ? "cobrar" : "previsoes"}"`}>${icone(vazio ? "upload" : "seta")}${vazio ? "Importar primeiras planilhas" : D.kpi.cobrarTecnicos ? "Começar cobranças" : "Acompanhar devoluções"}</button>
      <span class="hero-status"><i class="${completas ? "em-dia" : ""}"></i>${vazio ? "Novas e usadas, em um só lugar" : completas ? "Planilhas de hoje importadas" : "Confira a atualização das planilhas"}</span></div>
    </div><div class="hero-imagem" aria-hidden="true">${document.getElementById("imagem-operacao").innerHTML}</div>
  </section>`;
}

function filaDoPainel(D, tipo = UIpainel.fila) {
  return D.tecnicos.map((t) => {
    const itens = tipo === "vencidas" ? t.usadas.filter((i) => i.status === "previsao_vencida")
      : tipo === "hoje" ? t.previsoesHoje : t.itensCobrar;
    return { t, itens, qtd: somar(itens, (i) => i.qtd), dias: Math.max(0, ...itens.map((i) => i.dias)) };
  }).filter((r) => r.itens.length)
    .sort((a, b) => (b.t.nPrevVencida > 0) - (a.t.nPrevVencida > 0) || b.dias - a.dias || b.qtd - a.qtd);
}

function filaHoje(D) {
  const abas = [["cobrar", "A cobrar"], ["vencidas", "Previsões vencidas"], ["hoje", "Previstas hoje"]];
  const lista = filaDoPainel(D);
  const aba = UIpainel.fila === "hoje" ? "previsoes" : UIpainel.fila;
  const chips = `<div class="filtros-segmentados fila-abas" aria-label="Filtrar a fila de trabalho">${abas.map(([id, nome]) => `<button type="button" data-acao="painel-fila" data-fila="${id}" aria-pressed="${UIpainel.fila === id}" class="${UIpainel.fila === id ? "ativo" : ""}">${nome}<span>${filaDoPainel(D, id).length}</span></button>`).join("")}</div>`;
  const vazios = { cobrar: ["Nenhuma cobrança pendente", "A próxima importação atualiza esta fila automaticamente."], vencidas: ["Nenhuma previsão vencida", "As promessas de devolução em atraso aparecerão aqui."], hoje: ["Sem devoluções previstas para hoje", "Registre a data combinada ao cobrar o técnico."] };
  return cartao("Sua fila de hoje", chips + (lista.length ? `<ol class="fila-operacao">${lista.slice(0, 4).map(({ t, qtd, dias }, n) => `<li>
    <span class="fila-ordem">${String(n + 1).padStart(2, "0")}</span>${avatar(t.nome, t.tipo)}
    <div class="fila-pessoa"><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button>
      <span>${regiaoTag(t.regiao)} ${plural(qtd, "peça", "peças")} · ${dias} dias com a mais antiga</span>
      <small class="${t.nPrevVencida ? "txt-crit" : ""}">${t.nPrevVencida ? "Previsão vencida · priorize este contato" : t.ultimaCobranca ? `Último contato: ${fmtQuando(t.ultimaCobranca.em)}` : "Ainda sem cobrança registrada"}</small></div>
    <button class="btn pequeno ${UIpainel.fila === "hoje" ? "" : "prim"}" data-acao="${UIpainel.fila === "hoje" ? "tecnico" : "cobrar"}" data-tid="${esc(t.tid)}" data-aba="${aba}">${UIpainel.fila === "hoje" ? "Conferir" : "Cobrar"}${icone("direita")}</button>
  </li>`).join("")}</ol><button class="rodape-link" data-acao="painel-cobrancas" data-aba="${aba}">Abrir lista completa · ${plural(lista.length, "técnico", "técnicos")}${icone("seta")}</button>` : vazio("ok", ...vazios[UIpainel.fila])), { sub: "Previsões vencidas primeiro. Depois, as peças mais antigas.", classe: "cartao-fila" });
}

function agendaDoPainel(D) {
  return Array.from({ length: 7 }, (_, n) => {
    const dia = somaDias(D.hoje, n);
    const itens = D.itens.filter((i) => i.previsao === dia);
    return { dia, itens, qtd: somar(itens, (i) => i.qtd), tecnicos: agrupar(itens, (i) => i.tid) };
  });
}

function agendaDevolucoes(D) {
  const dias = agendaDoPainel(D);
  if (!dias.some((d) => d.dia === UIpainel.dia)) UIpainel.dia = D.hoje;
  const atual = dias.find((d) => d.dia === UIpainel.dia);
  const botoes = `<div class="agenda-dias" aria-label="Dias com previsão de devolução">${dias.map((d, n) => `<button type="button" data-acao="painel-dia" data-dia="${d.dia}" aria-pressed="${d.dia === atual.dia}" class="agenda-dia ${d.dia === atual.dia ? "ativo" : ""}">
    <span>${n === 0 ? "Hoje" : SEMANA[new Date(numDia(d.dia) * 86400000).getUTCDay()].slice(0, 3)}</span><strong>${d.dia.slice(8, 10)}</strong><small>${plural(d.qtd, "peça", "peças")}</small><i class="${d.qtd ? "com-previsao" : ""}"></i>
  </button>`).join("")}</div>`;
  const lista = [...atual.tecnicos.entries()].sort((a, b) => somar(b[1], (i) => i.qtd) - somar(a[1], (i) => i.qtd));
  const detalhe = `<div class="agenda-detalhe"><div class="agenda-resumo"><span class="sobretitulo">${fmtData(atual.dia)}</span><strong>${plural(atual.qtd, "peça prevista", "peças previstas")}</strong><p>${lista.length ? `${plural(lista.length, "técnico combinou", "técnicos combinaram")} a devolução para esta data.` : "Nenhum técnico combinou uma devolução para esta data."}</p></div>
    <div class="agenda-tecnicos">${lista.length ? lista.map(([tid, itens]) => `<button class="agenda-tecnico" data-acao="tecnico" data-tid="${esc(tid)}">${avatar(nomeTecnico(tid), "tecnico")}<span><strong>${esc(nomeTecnico(tid))}</strong><small>${[...new Set(itens.map((i) => i.regiao))].map(esc).join(", ")} · ${plural(somar(itens, (i) => i.qtd), "peça", "peças")}</small></span>${icone("direita")}</button>`).join("") : `<div class="agenda-vazia">${icone("calendario")}<span>As datas registradas nas cobranças aparecem aqui automaticamente.</span></div>`}</div></div>`;
  return cartao("Agenda de devoluções", botoes + detalhe + `<p class="agenda-nota">${icone("info")}Previsão é um compromisso. A devolução só é confirmada quando a peça sai da próxima planilha importada.</p>`, { sub: "Os próximos 7 dias, a partir do que foi combinado com cada técnico.", classe: "cartao-agenda" });
}

function dadosMapa(D) {
  const tipo = UIpainel.mapaModo === "novas" ? "novas" : "usadas";
  return D.porRegiao.filter((r) => D.frescor.some((f) => f.regiao === r.regiao && f.tipo === tipo && f.em));
}

function mapaOperacao(D) {
  const novas = UIpainel.mapaModo === "novas";
  const dados = dadosMapa(D);
  const metrica = (r) => novas ? r.abaixo + r.acima : r.cobrar;
  if (!dados.some((r) => r.regiao === UIpainel.regiao)) UIpainel.regiao = [...dados].sort((a, b) => metrica(b) - metrica(a))[0]?.regiao || "";
  const r = dados.find((r) => r.regiao === UIpainel.regiao);
  const caminho = MAPA_BRASIL.map((uf) => {
    const d = dados.find((x) => x.regiao === uf.uf);
    const pend = d && metrica(d);
    const label = `${UFS[uf.uf]}, ${d ? `${fmtNum(pend)} ${novas ? "técnicos fora da meta" : "peças para cobrar"}` : "sem planilha importada"}`;
    return `<g class="mapa-estado ${d ? pend ? "com-pendencia" : "em-dia" : "sem-dados"} ${UIpainel.regiao === uf.uf ? "selecionado" : ""}" ${d ? `role="button" tabindex="0" data-acao="painel-regiao" data-regiao="${uf.uf}" aria-pressed="${UIpainel.regiao === uf.uf}"` : 'role="img"'} aria-label="${esc(label)}"><title>${esc(label)}</title><path d="${uf.d}"/>${d ? `<text x="${uf.centro[0]}" y="${uf.centro[1]}">${uf.uf}</text>` : ""}</g>`;
  }).join("");
  const seletor = `<div class="filtros-segmentados">${[["usadas", "Usadas"], ["novas", "Novas"]].map(([id, nome]) => `<button type="button" data-acao="painel-mapa-modo" data-modo="${id}" aria-pressed="${UIpainel.mapaModo === id}" class="${UIpainel.mapaModo === id ? "ativo" : ""}">${nome}</button>`).join("")}</div>`;
  const frescor = r && D.frescor.find((f) => f.regiao === r.regiao && f.tipo === UIpainel.mapaModo);
  const detalhe = r ? `<span class="mapa-uf">${r.regiao}</span><h3>${esc(UFS[r.regiao] || r.regiao)}</h3><div class="mapa-numero">${fmtNum(metrica(r))}<span>${novas ? "técnicos fora da meta" : "peças para cobrar"}</span></div>
    <dl><div><dt>${novas ? "Peças com técnicos" : "Usadas pendentes"}</dt><dd>${fmtNum(novas ? r.novas : r.total)}</dd></div><div><dt>${novas ? "Abaixo da meta" : "Vencem em breve"}</dt><dd>${fmtNum(novas ? r.abaixo : r.vencendo)}</dd></div><div><dt>${novas ? "Na meta" : "Atrasadas com previsão"}</dt><dd>${fmtNum(novas ? r.ideal : r.aguardando)}</dd></div></dl>
    <button class="btn pequeno" data-acao="painel-regiao-abrir">${novas ? "Ver estoque" : "Ver peças"}${icone("seta")}</button><small class="mapa-atualizacao">Relatório ${frescor?.em ? fmtQuando(frescor.em) : "não importado"}</small>` : `<div class="vazio">${icone("arquivo")}<h3>Sem relatório de ${novas ? "novas" : "usadas"}</h3><p>Importe uma planilha para acompanhar os estados.</p></div>`;
  return cartao("Sua operação pelo Brasil", `<div class="mapa-layout"><div class="mapa-figura"><svg class="mapa-brasil" viewBox="0 0 525 525" role="group" aria-label="Estados brasileiros. Selecione um estado com dados para ver seus indicadores.">${caminho}</svg><div class="mapa-legenda"><span><i class="pendente"></i>${novas ? "Fora da meta" : "A cobrar"}</span><span><i class="em-dia"></i>${novas ? "Na faixa" : "Sem cobrança"}</span><span><i></i>Sem dados</span></div></div><div class="mapa-detalhe">${detalhe}</div></div>
    <div class="mapa-regioes" aria-label="Selecionar estado">${dados.map((x) => `<button class="chip ${x.regiao === UIpainel.regiao ? "ativo" : ""}" data-acao="painel-regiao" data-regiao="${x.regiao}" aria-pressed="${x.regiao === UIpainel.regiao}">${x.regiao} <span>${fmtNum(metrica(x))}</span></button>`).join("")}</div><p class="mapa-nota">Dados por estado das planilhas, sem localização individual de técnicos.</p>`, { sub: "Selecione um estado para explorar suas pendências.", acoes: seletor, classe: "cartao-mapa" });
}

function saudePrazos(D) {
  const k = D.kpi, dentro = k.usadas - k.atrasadas;
  const percentual = k.usadas ? dentro / k.usadas * 100 : 0;
  return cartao("Cumprimento do prazo", `<div class="saude-conteudo"><div class="anel-prazos ${k.usadas ? "" : "sem-dados"}" role="img" aria-label="${k.usadas ? `${fmtPct(dentro / k.usadas)} das peças pendentes estão dentro do prazo de ${D.cfg.prazo} dias` : "Sem peças usadas pendentes"}">
    <svg viewBox="0 0 140 140" aria-hidden="true"><circle class="anel-fundo" cx="70" cy="70" r="57"/><circle class="anel-valor" cx="70" cy="70" r="57" pathLength="100" stroke-dasharray="${percentual} 100"/></svg><div><strong>${k.usadas ? `${Math.round(percentual)}%` : "—"}</strong><span>dentro do prazo</span></div></div>
    <dl class="saude-legenda"><div><dt><i></i>Até ${D.cfg.prazo} dias</dt><dd>${fmtNum(dentro)}</dd></div><div class="atraso"><dt><i></i>Mais de ${D.cfg.prazo} dias</dt><dd>${fmtNum(k.atrasadas)}</dd></div></dl></div><div class="saude-rodape">${icone("retorno")}<span><strong>${k.temHistoricoDev ? fmtNum(k.devolvidas7) : "—"}</strong> devolvidas nos últimos 7 dias</span></div>`, { sub: "Considera a idade real das peças ainda pendentes, mesmo com previsão.", classe: "cartao-saude" });
}

function estoqueConhecidoPainel(D) {
  const conhecidas = new Set(D.frescor.filter((f) => f.tipo === "novas" && f.em).map((f) => f.regiao));
  const tecnicos = D.tecnicos.filter((t) => t.tipo === "tecnico" && t.temDados && conhecidas.has(t.regiao));
  return { temRelatorio: conhecidas.size > 0, tecnicos, total: somar(tecnicos, (t) => t.novasQtd), abaixo: tecnicos.filter((t) => t.statusNovas === "abaixo") };
}

function reposicaoPainel(D) {
  const estoque = estoqueConhecidoPainel(D);
  if (!estoque.temRelatorio) return cartao("Estoque que merece atenção", vazio("caixa", "Falta a planilha de peças novas", "Importe o estoque para identificar quem precisa de reposição."), { classe: "cartao-reposicao" });
  const lista = estoque.abaixo
    .sort((a, b) => a.difNovas - b.difNovas);
  return cartao("Estoque que merece atenção", lista.length ? `<ul class="reposicao-lista">${lista.slice(0, 4).map((t) => `<li>${avatar(t.nome, t.tipo)}<div><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button><span>${regiaoTag(t.regiao)} ${fmtNum(t.novasQtd)} de ${fmtNum(t.meta)} peças da meta</span><div class="barra-meta"><i style="width:${Math.max(0, Math.min(100, t.novasQtd / t.meta * 100))}%"></i></div></div><strong>+${fmtNum(t.meta - t.novasQtd)}<small>para a meta</small></strong></li>`).join("")}</ul><button class="rodape-link" data-acao="painel-reposicao">Ver ${plural(lista.length, "técnico abaixo da meta", "técnicos abaixo da meta")}${icone("seta")}</button>` : vazio("caixa", "Estoque dentro da faixa", "Nenhum técnico com dados está abaixo da faixa configurada."), { sub: `Prioridade de reposição até a meta de cada técnico. Padrão: ${D.cfg.meta} peças.`, classe: "cartao-reposicao" });
}

function historicoDoPainel() {
  const corte = somaDias(hojeISO(), -(UIpainel.periodo - 1));
  return E.historico.filter((h) => h.data >= corte && h.data <= hojeISO());
}

function atualizarFiltroPainel(chave, valor, seletor) {
  UIpainel[chave] = valor;
  renderizar(true);
  document.querySelector(seletor)?.focus({ preventScroll: true });
}

function abrirCobrancasPainel(aba = "cobrar") {
  Object.assign(UI.cob, { aba, regiao: "", busca: "", ordem: "dias" });
  irPara("cobrancas");
}

function ligarMapaPainel() {
  document.querySelectorAll('.mapa-estado[role="button"]').forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    });
  });
}
