/* Visão operacional: todos os números vêm das planilhas e previsões existentes. */
const MAPA_BRASIL = /*__MAPA_BRASIL__*/;

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
  return cartao("Prioridades de cobrança", chips + (lista.length ? `<ol class="fila-operacao">${lista.slice(0, 4).map(({ t, qtd, dias }, n) => `<li>
    <span class="fila-ordem">${String(n + 1).padStart(2, "0")}</span>${avatar(t.nome, t.tipo)}
    <div class="fila-pessoa"><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button>
      <span>${regiaoTag(t.regiao)} ${plural(qtd, "peça", "peças")} · ${dias} dias com a mais antiga</span>
      <small class="${t.nPrevVencida ? "txt-crit" : ""}">${t.nPrevVencida ? "Previsão vencida · priorize este contato" : t.ultimaCobranca ? `Último contato: ${fmtQuando(t.ultimaCobranca.em)}` : "Ainda sem cobrança registrada"}</small></div>
    <button class="btn pequeno ${UIpainel.fila === "hoje" ? "" : "prim"}" data-acao="${UIpainel.fila === "hoje" ? "tecnico" : "cobrar"}" data-tid="${esc(t.tid)}" data-aba="${aba}">${UIpainel.fila === "hoje" ? "Conferir" : "Cobrar"}${icone("direita")}</button>
  </li>`).join("")}</ol><button class="rodape-link" data-acao="painel-cobrancas" data-aba="${aba}">Abrir lista completa · ${plural(lista.length, "técnico", "técnicos")}${icone("seta")}</button>` : vazio("ok", ...vazios[UIpainel.fila])), { sub: "Previsões vencidas primeiro. Depois, as peças mais antigas.", classe: "cartao-fila" });
}

function dadosMapa(D) {
  const tipo = UIpainel.mapaModo === "novas" ? "novas" : "usadas";
  return D.frescor.filter((f) => f.tipo === tipo && f.em).map((f) => D.porRegiao.find((r) => r.regiao === f.regiao) || { regiao: f.regiao, no_prazo: 0, vencendo: 0, cobrar: 0, aguardando: 0, total: 0, ideal: 0, acima: 0, excessoNovas: 0, novas: 0 });
}

function riscoEstado(D, r, novas = UIpainel.mapaModo === "novas") {
  const total = novas ? r.ideal + r.acima : r.total;
  const afetadas = novas ? r.acima : somar(D.itens.filter((i) => i.regiao === r.regiao && i.atrasada), (i) => i.qtd);
  const percentual = total ? afetadas / total * 100 : 0;
  const nivel = percentual <= 10 ? "baixo" : percentual <= 25 ? "moderado" : percentual <= 50 ? "alto" : "critico";
  return { total, afetadas, percentual, nivel };
}

function mapaOperacao(D) {
  const novas = UIpainel.mapaModo === "novas", dados = dadosMapa(D);
  const metrica = (r) => novas ? r.acima : r.cobrar;
  if (!dados.some((r) => r.regiao === UIpainel.regiao)) UIpainel.regiao = [...dados].sort((a, b) => metrica(b) - metrica(a))[0]?.regiao || "";
  const r = dados.find((x) => x.regiao === UIpainel.regiao);
  const riscos = new Map(dados.map((x) => [x.regiao, riscoEstado(D, x, novas)]));
  const caminho = [...MAPA_BRASIL].sort((a, b) => (a.uf === UIpainel.regiao) - (b.uf === UIpainel.regiao)).map((uf) => {
    const risco = riscos.get(uf.uf), selecionado = UIpainel.regiao === uf.uf;
    const texto = risco ? `${fmtNum1(risco.percentual)}% ${novas ? "dos técnicos acima do limite" : "das peças acima do prazo"}` : "sem planilha importada";
    const dica = `<strong>${esc(UFS[uf.uf])}</strong><span>${texto}</span>`;
    return `<g data-uf="${uf.uf}" data-dica="${esc(dica)}" class="mapa-estado ${risco ? `risco-${risco.nivel}` : "sem-dados"} ${selecionado ? "selecionado" : ""}" ${risco ? `role="button" tabindex="0" data-acao="painel-regiao" data-regiao="${uf.uf}" aria-pressed="${selecionado}"` : 'role="img"'} aria-label="${esc(UFS[uf.uf] + ', ' + texto)}"><title>${esc(UFS[uf.uf] + ': ' + texto)}</title><path d="${uf.d}"/>${risco ? `<text x="${uf.centro[0]}" y="${uf.centro[1]}">${uf.uf}</text>` : ""}${selecionado ? `<circle class="mapa-sinal" cx="${uf.centro[0]}" cy="${uf.centro[1]}" r="13"/>` : ""}</g>`;
  }).join("");
  const seletor = `<div class="filtros-segmentados">${[["usadas", "Usadas"], ["novas", "Novas"]].map(([id, nome]) => `<button type="button" data-acao="painel-mapa-modo" data-modo="${id}" aria-pressed="${UIpainel.mapaModo === id}" class="${UIpainel.mapaModo === id ? "ativo" : ""}">${nome}</button>`).join("")}</div>`;
  const frescor = r && D.frescor.find((f) => f.regiao === r.regiao && f.tipo === UIpainel.mapaModo);
  const risco = r && riscos.get(r.regiao);
  const detalhe = r ? `<span class="mapa-uf">${r.regiao}</span><h3>${esc(UFS[r.regiao] || r.regiao)}</h3><div class="mapa-numero">${fmtNum(metrica(r))}<span>${novas ? `${palavra(metrica(r), "técnico", "técnicos")} acima do limite` : `${palavra(metrica(r), "peça", "peças")} para cobrar`}</span></div>
    <div class="mapa-risco risco-${risco.nivel}"><i></i>${fmtNum1(risco.percentual)}% ${novas ? "acima do limite" : "em atraso"}</div>
    <dl><div><dt>${novas ? "Peças novas" : "Usadas pendentes"}</dt><dd>${fmtNum(novas ? r.novas : r.total)}</dd></div><div><dt>${novas ? "Dentro do limite" : "Vencem em breve"}</dt><dd>${fmtNum(novas ? r.ideal : r.vencendo)}</dd></div><div><dt>${novas ? "Peças em excesso" : "Com previsão"}</dt><dd>${fmtNum(novas ? r.excessoNovas : r.aguardando)}</dd></div></dl>
    <button class="btn pequeno" data-acao="painel-regiao-abrir">${novas ? "Ver estoque" : "Ver peças"}${icone("seta")}</button><small class="mapa-atualizacao">${frescor?.em ? fmtQuando(frescor.em) : "Relatório não importado"}</small>` : vazio("arquivo", "Sem relatório", `Importe as peças ${novas ? "novas" : "usadas"} para acompanhar os estados.`);
  const ranking = [...dados].sort((a, b) => riscos.get(b.regiao).percentual - riscos.get(a.regiao).percentual);
  return cartao("Risco por estado", `<div class="mapa-layout"><div class="mapa-figura"><div class="mapa-cab"><span>BRASIL / ${novas ? "ESTOQUE" : "DEVOLUÇÕES"}</span><strong>${dados.length} UF${dados.length === 1 ? "" : "s"}</strong></div><svg class="mapa-brasil" viewBox="0 0 525 525" role="group" aria-label="Risco por estado. Selecione um estado com dados."><defs><pattern id="mapa-sem-dados" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--mapa-base)"/><path d="M0 5L5 0" stroke="var(--mapa-trama)" stroke-width=".5"/></pattern></defs><g class="mapa-cena" style="transform:${transformacaoMapa()}">${caminho}</g></svg><div class="mapa-controles" aria-label="Zoom do mapa"><button type="button" data-acao="painel-zoom" data-passo="-1" aria-label="Diminuir zoom" ${UIpainel.zoom <= 1 ? "disabled" : ""}>−</button><button type="button" data-acao="painel-zoom" data-passo="1" aria-label="Aproximar estado selecionado" ${UIpainel.zoom >= 2.5 ? "disabled" : ""}>+</button><button type="button" data-acao="painel-zoom" data-passo="0" aria-label="Restaurar visão de todo o Brasil">Brasil</button></div></div><div class="mapa-detalhe">${detalhe}</div></div>
    <div class="mapa-escala" aria-label="Legenda de risco"><span>Taxa ${novas ? "acima do limite" : "de atraso"}</span>${[["baixo", "0–10%"], ["moderado", ">10–25%"], ["alto", ">25–50%"], ["critico", ">50%"]].map(([c,t]) => `<span class="risco-${c}"><i></i>${t}</span>`).join("")}<span class="escala-sem"><i></i>Sem dados</span></div>
    <div class="mapa-regioes" aria-label="Comparar e selecionar estado">${ranking.map((x) => { const v = riscos.get(x.regiao); return `<button class="regiao-comparativo risco-${v.nivel} ${x.regiao === UIpainel.regiao ? "ativo" : ""}" data-acao="painel-regiao" data-regiao="${x.regiao}" aria-pressed="${x.regiao === UIpainel.regiao}"><strong>${x.regiao}</strong><span class="regiao-barra"><i style="width:${v.percentual}%"></i></span><span>${fmtNum1(v.percentual)}%</span></button>`; }).join("")}</div><p class="mapa-instrucao">${icone("info")}<span>Mesma cor, mesma faixa de risco. <span class="mapa-ajuda-mouse">Passe o cursor para ampliar; clique para selecionar.</span><span class="mapa-ajuda-toque">Toque em um estado com dados para selecionar.</span></span></p><p class="mapa-nota">${novas ? "Técnicos acima do limite ÷ técnicos com limite e estoque acompanhado." : "Peças acima do prazo de cada técnico ÷ peças pendentes em cada estado."} Sem localização individual.</p>`, { sub: novas ? "Proporção de técnicos acima do limite máximo de estoque." : "Proporção de peças que excederam o prazo de devolução.", acoes: seletor, classe: "cartao-mapa" });
}

function saudePrazos(D) {
  const k = D.kpi, dentro = k.usadas - k.atrasadas;
  const percentual = k.usadas ? dentro / k.usadas * 100 : 0;
  return cartao("Cumprimento do prazo", `<div class="saude-conteudo"><div class="anel-prazos ${k.usadas ? "" : "sem-dados"}" role="img" aria-label="${k.usadas ? `${fmtPct(dentro / k.usadas)} das peças pendentes estão dentro do prazo de cada técnico` : "Sem peças usadas pendentes"}">
    <svg viewBox="0 0 140 140" aria-hidden="true"><circle class="anel-fundo" cx="70" cy="70" r="57"/><circle class="anel-valor" cx="70" cy="70" r="57" pathLength="100" stroke-dasharray="${percentual} 100"/></svg><div><strong>${k.usadas ? `${Math.round(percentual)}%` : "—"}</strong><span>dentro do prazo</span></div></div>
    <dl class="saude-legenda"><div><dt><i></i>Dentro do prazo individual</dt><dd>${fmtNum(dentro)}</dd></div><div class="atraso"><dt><i></i>Acima do prazo individual</dt><dd>${fmtNum(k.atrasadas)}</dd></div></dl></div><div class="saude-rodape">${icone("retorno")}<span><strong>${k.temHistoricoDev ? fmtNum(k.devolvidas7) : "—"}</strong> devolvidas nos últimos 7 dias</span></div>`, { sub: "Considera a idade real das peças ainda pendentes, mesmo com previsão.", classe: "cartao-saude" });
}

function estoqueConhecidoPainel(D) {
  const conhecidas = new Set(D.frescor.filter((f) => f.tipo === "novas" && f.em).map((f) => f.regiao));
  const tecnicos = D.tecnicos.filter((t) => t.tipo === "tecnico" && conhecidas.has(t.regiao));
  return { temRelatorio: conhecidas.size > 0, tecnicos, total: somar(tecnicos, (t) => t.novasQtd), dentro: tecnicos.filter((t) => t.statusNovas === "ideal"), acima: tecnicos.filter((t) => t.statusNovas === "acima"), semLimite: tecnicos.filter((t) => t.statusNovas === "sem_meta") };
}

function excessoPainel(D) {
  const estoque = estoqueConhecidoPainel(D);
  if (!estoque.temRelatorio) return cartao("Estoque acima do limite", vazio("caixa", "Falta a planilha de peças novas", "Importe o estoque para identificar quem ultrapassou o limite."), { classe: "cartao-excesso" });
  const lista = estoque.acima.sort((a, b) => b.excessoNovas - a.excessoNovas || comparar(a.nome,b.nome));
  const maiorExcesso = Math.max(1, ...lista.map(t=>t.excessoNovas));
  return cartao("Estoque acima do limite", lista.length ? `<ul class="excesso-lista">${lista.slice(0, 4).map((t) => `<li>${avatar(t.nome, t.tipo)}<div><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button><span>${regiaoTag(t.regiao)} ${fmtNum(t.novasQtd)} peças · limite ${fmtNum(t.meta)}</span><div class="barra-meta"><i style="width:${t.excessoNovas / maiorExcesso * 100}%"></i></div></div><strong>${fmtNum(t.excessoNovas)}<small>em excesso</small></strong></li>`).join("")}</ul><button class="rodape-link" data-acao="painel-excesso">Ver ${plural(lista.length, "técnico acima do limite", "técnicos acima do limite")}${icone("seta")}</button>` : vazio("ok", "Nenhum estoque acima do limite", "Ter menos peças, inclusive zero, está dentro do limite."), { sub: `Recolha ou redistribua o excedente. Limite padrão: ${D.cfg.meta ? `${D.cfg.meta} peças` : 'sem limite'}.`, classe: "cartao-excesso" });
}

function historicoDoPainel() {
  const corte = somaDias(hojeISO(), -(UIpainel.periodo - 1));
  return E.historico.filter((h) => h.data >= corte && h.data <= hojeISO());
}

function transformacaoMapa() {
  const uf = MAPA_BRASIL.find((x) => x.uf === UIpainel.regiao);
  const [x, y] = uf?.centro || [262.5, 262.5];
  const z = UIpainel.zoom;
  return z === 1 ? "translate(0px, 0px) scale(1)" : `translate(${262.5 - x * z}px, ${262.5 - y * z}px) scale(${z})`;
}

function ajustarZoomMapa(passo) {
  document.querySelector(".mapa-brasil")?.dispatchEvent(new Event("mapa-reset"));
  UIpainel.zoom = passo === 0 ? 1 : Math.max(1, Math.min(2.5, UIpainel.zoom + passo * .5));
  const cena = document.querySelector(".mapa-cena");
  if (cena) cena.style.transform = transformacaoMapa();
  document.querySelectorAll('[data-acao="painel-zoom"]').forEach((b) => {
    b.disabled = b.dataset.passo === "-1" ? UIpainel.zoom <= 1 : b.dataset.passo === "1" && UIpainel.zoom >= 2.5;
  });
  Dica.esconder();
}

function atualizarFiltroPainel(chave, valor, seletor) {
  const transformacaoAnterior = document.querySelector(".mapa-cena")?.style.transform;
  UIpainel[chave] = valor;
  const alvos = { regiao: [".cartao-mapa", mapaOperacao], mapaModo: [".cartao-mapa", mapaOperacao], fila: [".cartao-fila", filaHoje] };
  if (alvos[chave] && document.querySelector(alvos[chave][0])) {
    const [alvo, montar] = alvos[chave];
    document.querySelector(alvo).outerHTML = montar(derivar());
    if (alvo === ".cartao-mapa") {
      ligarMapaPainel();
      Movimento.animar(document.querySelector(".mapa-cena"), [{ transform: transformacaoAnterior }, { transform: transformacaoMapa() }], 600);
      Movimento.detalhe(document.querySelector(".mapa-detalhe"));
    } else Movimento.detalhe(document.querySelector(alvo + " .fila-operacao"));
  } else {
    renderizar(true);
    Movimento.detalhe(document.querySelector(".cartao-evolucao .grafico"));
  }
  Dica.esconder();
  document.querySelector(seletor)?.focus({ preventScroll: true });
}

function abrirCobrancasPainel(aba = "cobrar") {
  Object.assign(UI.cob, { aba, foco: "", regiao: "", busca: "", ordem: "dias" });
  irPara("cobrancas");
}

function ligarMapaPainel() {
  const mapa = document.querySelector(".mapa-brasil");
  if (!mapa || mapa.dataset.ligado) return;
  mapa.dataset.ligado = "1";
  ligarDicas(mapa);
  // A cópia ampliada não recebe eventos: a área de seleção original fica estável.
  let destaque = null, origem = null;
  function recolher(imediato = false) {
    const anterior = destaque;
    destaque = null; origem = null;
    if (!anterior) return;
    const inicio = getComputedStyle(anterior).transform;
    anterior.style.transform = "scale(1)"; anterior.style.opacity = "0";
    const animacao = !imediato && Movimento.animar(anterior, [{ transform: inicio, opacity: 1 }, { transform: "scale(1)", opacity: 0 }], 180);
    if (animacao) animacao.finished.then(() => anterior.remove(), () => anterior.remove());
    else anterior.remove();
  }
  function ampliar(el) {
    if (Movimento.reduzido.matches || origem === el) return;
    recolher(true);
    mapa.querySelectorAll(".mapa-destaque").forEach((e) => e.remove());
    const caixa = el.querySelector("path").getBBox();
    const fator = 1 + Math.min(.55, 38 / Math.max(caixa.width, caixa.height));
    destaque = document.createElementNS("http://www.w3.org/2000/svg", "g");
    destaque.setAttribute("class", "mapa-destaque " + [...el.classList].filter((c) => c.startsWith("risco-") || c === "sem-dados").join(" "));
    destaque.setAttribute("aria-hidden", "true");
    destaque.dataset.uf = el.dataset.uf;
    el.querySelectorAll(":scope > path, :scope > text").forEach((parte) => destaque.append(parte.cloneNode(true)));
    destaque.style.transformOrigin = `${caixa.x + caixa.width / 2}px ${caixa.y + caixa.height / 2}px`;
    destaque.style.transform = `scale(${fator})`;
    mapa.querySelector(".mapa-cena").append(destaque);
    origem = el;
    Movimento.animar(destaque, [{ transform: "scale(1)", opacity: .65 }, { transform: `scale(${fator})`, opacity: 1 }], 320);
  }
  mapa.addEventListener("mapa-reset", () => recolher(true));
  mapa.querySelectorAll(".mapa-estado").forEach((el) => {
    el.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "touch" && ponteiroPreciso.matches) ampliar(el); });
    el.addEventListener("pointerleave", () => { if (origem === el && !el.matches(":focus-visible")) recolher(); });
    el.addEventListener("focus", () => { if (el.matches(":focus-visible")) ampliar(el); });
    el.addEventListener("blur", () => { if (origem === el) recolher(); });
  });
  mapa.querySelectorAll('.mapa-estado[role="button"]').forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { recolher(); Dica.esconder(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    });
  });
}
