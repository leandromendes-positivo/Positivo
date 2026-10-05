/* ==========================================================================
   Gráficos em SVG (sem bibliotecas). Cada gráfico é redesenhado na largura
   real do cartão, tem dica ao passar o mouse e uma versão em tabela.
   ========================================================================== */

const COR_STATUS = { ok: "var(--good)", alerta: "var(--warn)", grave: "var(--serious)", crit: "var(--crit)", info: "var(--series-1)", neutro: "var(--muted)" };

const Dica = {
  el: null,
  mostrar(html, x, y) {
    if (!this.el) this.el = document.getElementById("dica");
    if (!this.el) return;
    this.el.innerHTML = html;
    this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    this.el.style.left = Math.max(8, left) + "px";
    this.el.style.top = Math.max(8, top) + "px";
  },
  esconder() { if (this.el) this.el.hidden = true; },
};

function passoBonito(max, alvo = 4) {
  if (max <= 0) return 1;
  const bruto = max / alvo;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= bruto) return m * mag;
  return 10 * mag;
}
function escala(max, alvo = 4) {
  const passo = Math.max(1, passoBonito(max, alvo));
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const ticks = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(Math.round(v));
  return { topo, ticks };
}
/** Retângulo com cantos arredondados só na ponta (raio 4), reto na base. */
function barraVertical(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function barraHorizontal(x, y, w, h, r = 4, pontaArredondada = true) {
  if (w <= 0) return "";
  if (!pontaArredondada) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

/** Liga a dica de cada marca com data-dica. */
function ligarDicas(el) {
  el.querySelectorAll("[data-dica]").forEach((m) => {
    const mostrar = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      Dica.mostrar(m.getAttribute("data-dica"), p.clientX, p.clientY);
    };
    m.addEventListener("pointermove", mostrar);
    m.addEventListener("pointerleave", () => Dica.esconder());
    m.addEventListener("focus", () => { const r = m.getBoundingClientRect(); Dica.mostrar(m.getAttribute("data-dica"), r.right, r.top); });
    m.addEventListener("blur", () => Dica.esconder());
  });
}

// ------------------------------------------------------------- colunas
function graficoColunas(el, { faixas, titulo, aoClicar }) {
  const W = Math.max(280, el.clientWidth || 480);
  const H = 270, m = { t: 30, r: 10, b: 44, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const { topo, ticks } = escala(Math.max(1, ...faixas.map((f) => f.valor)));
  const banda = iw / faixas.length;
  const bw = Math.min(42, banda * 0.6);
  const y = (v) => m.t + ih - (v / topo) * ih;
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="${aoClicar ? "group" : "img"}" aria-label="${esc(titulo || "")}">`;
  for (const t of ticks) {
    svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="grade${t === 0 ? " base" : ""}"/>`;
    svg += `<text x="${m.l - 8}" y="${y(t) + 4}" class="eixo" text-anchor="end">${fmtCompacto(t)}</text>`;
  }
  faixas.forEach((f, i) => {
    const x = m.l + i * banda + (banda - bw) / 2;
    const h = (f.valor / topo) * ih;
    const st = STATUS_FAIXA[f.status] || "";
    svg += `<g class="marca${aoClicar ? " clicavel" : ""}" data-i="${i}" tabindex="0" role="${aoClicar ? "button" : "img"}" aria-label="${esc(`${f.rotulo} dias: ${fmtNum(f.valor)} peças`)}" data-dica="${esc(`<strong>${fmtNum(f.valor)}</strong> ${f.valor === 1 ? "peça" : "peças"}<span>${f.rotulo} dias · ${st}</span>`)}">`;
    svg += `<rect x="${m.l + i * banda}" y="${m.t}" width="${banda}" height="${ih}" fill="transparent"/>`;
    svg += `<rect class="barra-trilho" x="${x}" y="${m.t}" width="${bw}" height="${ih}" rx="6"/>`;
    svg += `<path class="barra-dado" style="--atraso-barra:${i * 65}ms" d="${barraVertical(x, y(f.valor), bw, h, 6)}" fill="${COR_STATUS[f.status]}"/>`;
    if (f.valor > 0) svg += `<text x="${x + bw / 2}" y="${y(f.valor) - 7}" class="valor" text-anchor="middle">${fmtCompacto(f.valor)}</text>`;
    svg += `<text x="${x + bw / 2}" y="${H - m.b + 18}" class="eixo" text-anchor="middle">${esc(f.rotulo)}</text>`;
    svg += `</g>`;
  });
  svg += `<text x="${m.l + iw / 2}" y="${H - 6}" class="eixo titulo-eixo" text-anchor="middle">dias com a peça</text>`;
  svg += `</svg>`;
  el.innerHTML = svg;
  ligarDicas(el);
  if (aoClicar) el.querySelectorAll(".marca").forEach((g) => {
    const ir = () => aoClicar(faixas[+g.dataset.i]);
    g.addEventListener("click", ir);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } });
  });
}
const STATUS_FAIXA = { ok: "no prazo", alerta: "vencendo", grave: "atrasadas", crit: "muito atrasadas" };

// ---------------------------------------------- barras horizontais empilhadas
function graficoEmpilhado(el, { linhas, series, aoClicar, unidade = ["peça", "peças"] }) {
  const W = Math.max(280, el.clientWidth || 480);
  const rotW = 44, valW = 64, alt = 34, bh = 18;
  const H = linhas.length * alt + 8;
  const iw = W - rotW - valW;
  const max = Math.max(1, ...linhas.map((l) => somar(series, (s) => l.partes[s.chave] || 0)));
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  linhas.forEach((l, i) => {
    const y0 = i * alt + (alt - bh) / 2;
    const total = somar(series, (s) => l.partes[s.chave] || 0);
    svg += `<text x="0" y="${y0 + bh / 2 + 5}" class="rotulo-linha">${esc(l.rotulo)}</text>`;
    let x = rotW;
    const visiveis = series.filter((s) => (l.partes[s.chave] || 0) > 0);
    visiveis.forEach((s, j) => {
      const v = l.partes[s.chave];
      const w = Math.max(2, (v / max) * iw - (j < visiveis.length - 1 ? 2 : 0));
      const ultima = j === visiveis.length - 1;
      const dica = `<strong>${fmtNum(v)}</strong> ${v === 1 ? unidade[0] : unidade[1]}<span>${esc(l.rotulo)} · ${esc(s.nome)}</span>`;
      svg += `<path class="marca${aoClicar ? " clicavel" : ""}" tabindex="0" data-linha="${i}" data-serie="${esc(s.chave)}" data-dica="${esc(dica)}" d="${barraHorizontal(x, y0, w, bh, 4, ultima)}" fill="${s.cor}"/>`;
      x += w + 2;
    });
    svg += `<text x="${W}" y="${y0 + bh / 2 + 5}" class="valor" text-anchor="end">${fmtNum(total)}</text>`;
  });
  svg += `</svg>`;
  el.innerHTML = svg;
  ligarDicas(el);
  if (aoClicar) el.querySelectorAll(".marca").forEach((p) => p.addEventListener("click", () => aoClicar(linhas[+p.dataset.linha], p.dataset.serie)));
}
function legendaHTML(series, forma = "barra") {
  return `<div class="legenda">${series.map((s) => `<span><i class="amostra ${forma}" style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join("")}</div>`;
}

// --------------------------------------------------------------- linhas
let graficoSequencia = 0;
function graficoLinhas(el, { datas, series, vazio }) {
  const W = Math.max(280, el.clientWidth || 480);
  const H = 270, m = { t: 20, r: 22, b: 32, l: 42 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  if (!datas.length) { el.innerHTML = `<div class="grafico-vazio">${esc(vazio || "Sem dados ainda.")}</div>`; return; }
  const max = Math.max(1, ...series.flatMap((s) => s.valores.filter((v) => v != null)));
  const { topo, ticks } = escala(max);
  const d0 = numDia(datas[0]), d1 = numDia(datas[datas.length - 1]);
  const intervalo = Math.max(1, d1 - d0);
  const x = (d) => datas.length === 1 ? m.l + iw / 2 : m.l + ((numDia(d) - d0) / intervalo) * iw;
  const y = (v) => m.t + ih - (v / topo) * ih;
  const id = `serie-${++graficoSequencia}`;
  const legenda = `<div class="grafico-legenda">${series.map((s) => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}<strong>${fmtNum(s.valores.at(-1))}</strong></span>`).join("")}</div>`;
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Evolução das peças por dia importado"><defs>${series.map((s, n) => `<linearGradient id="${id}-${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.cor}" stop-opacity=".22"/><stop offset="100%" stop-color="${s.cor}" stop-opacity="0"/></linearGradient>`).join("")}</defs>`;
  for (const t of ticks) {
    svg += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(t)}" y2="${y(t)}" class="grade${t === 0 ? " base" : ""}"/><text x="${m.l - 8}" y="${y(t) + 4}" class="eixo" text-anchor="end">${fmtCompacto(t)}</text>`;
  }
  const nRot = Math.min(datas.length, Math.max(2, Math.floor(iw / 70)));
  const idxRot = new Set(Array.from({ length: nRot }, (_, i) => Math.round((i * (datas.length - 1)) / Math.max(1, nRot - 1))));
  datas.forEach((d, i) => { if (idxRot.has(i)) svg += `<text x="${x(d)}" y="${H - 8}" class="eixo" text-anchor="middle">${fmtData(d, true)}</text>`; });
  series.forEach((s, n) => {
    const pts = datas.map((d, i) => [x(d), s.valores[i]]).filter((p) => p[1] != null);
    if (!pts.length) return;
    const linha = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    if (pts.length > 1) {
      svg += `<path class="area-serie" d="${linha}L${pts.at(-1)[0]},${y(0)}L${pts[0][0]},${y(0)}Z" fill="url(#${id}-${n})"/>`;
      svg += `<path class="linha-serie" pathLength="100" d="${linha}" fill="none" stroke="${s.cor}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (pts.length <= 14) pts.forEach((p) => { svg += `<circle cx="${p[0]}" cy="${y(p[1])}" r="3.5" fill="${s.cor}" stroke="var(--surface)" stroke-width="2"/>`; });
    svg += `<circle class="ponto-serie" data-serie="${n}" cx="${pts.at(-1)[0]}" cy="${y(pts.at(-1)[1])}" r="5" fill="${s.cor}" stroke="var(--surface)" stroke-width="2.5"/>`;
  });
  svg += `<line class="mira" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><rect class="alvo" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" tabindex="0" role="slider" aria-label="Explorar dia do histórico" aria-valuemin="1" aria-valuemax="${datas.length}" aria-valuenow="${datas.length}" aria-valuetext="${esc(fmtDataExtensa(datas.at(-1)))}"/></svg>`;
  el.innerHTML = legenda + svg + `<p class="grafico-ajuda">Passe o cursor ou use ← → no gráfico para consultar cada dia.</p>`;
  const alvo = el.querySelector(".alvo"), mira = el.querySelector(".mira");
  let atual = datas.length - 1;
  function mostrar(indice, px, py) {
    atual = indice;
    const xx = x(datas[atual]);
    mira.setAttribute("x1", xx); mira.setAttribute("x2", xx); mira.setAttribute("visibility", "visible");
    alvo.setAttribute("aria-valuenow", String(atual + 1));
    alvo.setAttribute("aria-valuetext", `${fmtDataExtensa(datas[atual])}. ${series.map((s) => `${s.nome}: ${fmtNum(s.valores[atual])}`).join(". ")}`);
    series.forEach((s, n) => {
      const ponto = el.querySelector(`[data-serie="${n}"]`);
      if (!ponto) return;
      ponto.setAttribute("cx", xx); ponto.setAttribute("cy", y(s.valores[atual]));
    });
    const linhas = series.map((s) => `<div class="dica-serie"><i style="background:${s.cor}"></i><strong>${fmtNum(s.valores[atual])}</strong> ${esc(s.nome)}</div>`).join("");
    Dica.mostrar(`<span>${fmtDataExtensa(datas[atual])}</span>${linhas}`, px, py);
  }
  alvo.addEventListener("pointermove", (ev) => {
    const r = alvo.getBoundingClientRect(), px = m.l + (ev.clientX - r.left) / r.width * iw;
    let melhor = 0, dist = Infinity;
    datas.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < dist) { dist = dd; melhor = i; } });
    mostrar(melhor, ev.clientX, ev.clientY);
  });
  const esconder = () => { mira.setAttribute("visibility", "hidden"); Dica.esconder(); };
  alvo.addEventListener("pointerleave", esconder);
  alvo.addEventListener("blur", esconder);
  alvo.addEventListener("focus", () => { const r = alvo.getBoundingClientRect(); mostrar(atual, r.left + r.width / 2, r.top); });
  alvo.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { esconder(); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const n = ev.key === "Home" ? 0 : ev.key === "End" ? datas.length - 1 : Math.max(0, Math.min(datas.length - 1, atual + (ev.key === "ArrowRight" ? 1 : -1)));
    const r = alvo.getBoundingClientRect(); mostrar(n, r.left + r.width / 2, r.top);
  });
}

// --------------------------------------------------- medidor de estoque
/** Barra de estoque: faixa ideal sombreada, marca da meta e a quantidade. */
function medidorEstoque(t) {
  const fim = Math.max(t.meta * 2, t.metaMax + 2, 10);
  const pct = (v) => Math.max(0, Math.min(100, (v / fim) * 100));
  const passou = t.novasQtd > fim;
  const cor = { abaixo: "var(--warn)", ideal: "var(--good)", acima: "var(--serious)", sem_meta: "var(--muted)" }[t.statusNovas];
  return `<div class="medidor" title="${esc(`${fmtNum(t.novasQtd)} peças · meta ${t.meta} (faixa ${t.metaMin}–${t.metaMax})`)}">
    <div class="medidor-trilho">
      ${t.meta ? `<span class="medidor-faixa" style="left:${pct(t.metaMin)}%;width:${pct(t.metaMax) - pct(t.metaMin)}%"></span>` : ""}
      <span class="medidor-barra" style="width:${pct(t.novasQtd)}%;background:${cor}"></span>
      ${t.meta ? `<span class="medidor-meta" style="left:${pct(t.meta)}%"></span>` : ""}
    </div>
    <span class="medidor-num">${fmtNum(t.novasQtd)}${passou ? `<b class="passou" aria-label="acima da escala">›</b>` : ""}</span>
  </div>`;
}

// ---------------------------------------------------------- régua de prazo
/** Régua de 0 a 2×prazo dias: verde, âmbar a partir do alerta, vermelho após o prazo. */
function reguaPrazo(dias, cfg) {
  const prazo = cfg.prazo, alerta = Math.min(cfg.alerta, prazo), fim = prazo * 2;
  const pct = (v) => (Math.min(v, fim) / fim) * 100;
  const pos = pct(dias);
  return `<div class="regua" aria-label="${dias} dias com a peça; prazo de ${prazo} dias">
    <div class="regua-trilho">
      <span style="left:0;width:${pct(alerta)}%" class="r-ok"></span>
      <span style="left:${pct(alerta)}%;width:${pct(prazo + 0.0001) - pct(alerta)}%" class="r-alerta"></span>
      <span style="left:${pct(prazo)}%;width:${100 - pct(prazo)}%" class="r-crit"></span>
      <i class="regua-prazo" style="left:${pct(prazo)}%"></i>
      <b class="regua-marca${dias > fim ? " alem" : ""}" style="left:${pos}%"></b>
    </div>
    <div class="regua-escala"><span>0</span><span style="left:${pct(prazo)}%">${prazo}d</span><span class="fim">${fim}d+</span></div>
  </div>`;
}
