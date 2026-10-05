/* ==========================================================================
   Componentes de interface: avisos, janelas, etiquetas e exportação.
   ========================================================================== */

function toast(msg, tipo = "ok", { acao, aoAgir, duracao = 4200 } = {}) {
  const area = document.getElementById("toasts");
  if (!area) return;
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.innerHTML = `${icone(tipo === "erro" ? "alerta" : tipo === "info" ? "info" : "ok")}<span></span>${acao ? `<button class="btn fantasma pequeno"></button>` : ""}<button class="btn-icone fechar-toast" aria-label="Fechar">${icone("fechar")}</button>`;
  el.querySelector("span").textContent = msg;
  if (acao) {
    const b = el.querySelector(".btn");
    b.textContent = acao;
    b.addEventListener("click", () => { aoAgir && aoAgir(); el.remove(); });
  }
  el.querySelector(".fechar-toast").addEventListener("click", () => el.remove());
  area.appendChild(el);
  setTimeout(() => el.classList.add("sair"), duracao);
  setTimeout(() => el.remove(), duracao + 400);
}

/** Janela modal. Devolve {el, fechar}. */
function abrirModal({ titulo, subtitulo = "", corpo = "", rodape = "", largura = "", aoFechar }) {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `<div class="modal ${largura}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
    <header class="modal-topo"><div><h2 id="modal-titulo"></h2>${subtitulo ? `<p class="modal-sub"></p>` : ""}</div>
    <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button></header>
    <div class="modal-corpo">${corpo}</div>
    ${rodape ? `<footer class="modal-rodape">${rodape}</footer>` : ""}
  </div>`;
  fundo.querySelector("#modal-titulo").textContent = titulo;
  if (subtitulo) fundo.querySelector(".modal-sub").textContent = subtitulo;
  const anterior = document.activeElement;
  const fechar = () => {
    fundo.remove();
    document.removeEventListener("keydown", tecla);
    if (anterior && anterior.focus) anterior.focus();
    aoFechar && aoFechar();
  };
  const tecla = (e) => { if (e.key === "Escape") fechar(); };
  document.addEventListener("keydown", tecla);
  fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fechar));
  document.body.appendChild(fundo);
  const foco = fundo.querySelector("[autofocus], .modal-corpo input, .modal-corpo textarea, .modal-corpo select, .modal-rodape .prim");
  if (foco) setTimeout(() => foco.focus(), 30);
  return { el: fundo, fechar };
}

/** Confirmação dentro da página (o navegador do Claude não mostra confirm()). */
function confirmar({ titulo, texto, ok = "Confirmar", perigo = false }) {
  return new Promise((resolver) => {
    let resposta = false;
    const m = abrirModal({
      titulo, corpo: `<p class="texto-modal"></p>`,
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ${perigo ? "perigo" : "prim"}" data-ok>${esc(ok)}</button>`,
      aoFechar: () => resolver(resposta),
    });
    m.el.querySelector(".texto-modal").textContent = texto;
    m.el.querySelector("[data-ok]").addEventListener("click", () => { resposta = true; m.fechar(); });
  });
}

function pill(classe, texto, ic) {
  return `<span class="pill ${classe}">${ic ? icone(ic) : ""}${esc(texto)}</span>`;
}
function pillStatus(i, cfg) {
  const s = STATUS[i.status];
  let texto = s.rotulo;
  if (i.status === "atrasada") texto = `Atrasada · ${i.atraso} ${i.atraso === 1 ? "dia" : "dias"}`;
  else if (i.status === "vencendo") texto = i.venceEm <= 0 ? "Vence hoje" : `Vence em ${i.venceEm} ${i.venceEm === 1 ? "dia" : "dias"}`;
  else if (i.status === "aguardando") texto = `Previsão ${fmtPrevisao(i.previsao)}`;
  else if (i.status === "previsao_vencida") texto = `Previsão vencida (${fmtData(i.previsao, true)})`;
  return pill(s.classe, texto, s.icone);
}
function pillNovas(t) {
  const s = STATUS_NOVAS[t.statusNovas];
  let texto = s.rotulo;
  if (t.statusNovas === "abaixo") texto = `Repor ${t.meta - t.novasQtd}`;
  else if (t.statusNovas === "acima") texto = `Excesso de ${fmtNum(t.novasQtd - t.meta)}`;
  return pill(s.classe, texto, s.icone);
}
function avatar(nome, tipo) {
  return `<span class="avatar${tipo === "base" ? " base" : ""}" aria-hidden="true">${tipo === "base" ? icone("base") : esc(iniciais(nome))}</span>`;
}
function tagTipoEnvio(t) {
  return `<span class="tag">${esc(t)}</span>`;
}
function regiaoTag(r) {
  return r ? `<span class="uf" title="${esc(UFS[r] || r)}">${esc(r)}</span>` : "";
}
function vazio(icon, titulo, texto, botao = "") {
  return `<div class="vazio">${icone(icon)}<h3>${esc(titulo)}</h3><p>${texto}</p>${botao}</div>`;
}
function cartao(titulo, corpo, { acoes = "", classe = "", sub = "" } = {}) {
  return `<section class="cartao ${classe}"><header class="cartao-topo"><div><h2>${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${acoes ? `<div class="cartao-acoes">${acoes}</div>` : ""}</header>${corpo}</section>`;
}
function paginacao(total, pagina, porPagina, alvo) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return `<div class="paginacao"><span>${fmtNum(total)} ${total === 1 ? "linha" : "linhas"}</span></div>`;
  const ini = (pagina - 1) * porPagina + 1, fim = Math.min(total, pagina * porPagina);
  return `<div class="paginacao"><span>${fmtNum(ini)}–${fmtNum(fim)} de ${fmtNum(total)}</span>
    <div><button class="btn pequeno" data-acao="pagina" data-alvo="${alvo}" data-p="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
    <span class="pag-num">${pagina} / ${paginas}</span>
    <button class="btn pequeno" data-acao="pagina" data-alvo="${alvo}" data-p="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""}>Próxima</button></div></div>`;
}
function thOrdenavel(rotulo, campo, ordem, alvo, classe = "") {
  const ativo = ordem.campo === campo;
  return `<th class="${classe}${ativo ? " ordenado" : ""}"><button class="th-btn" data-acao="ordenar" data-alvo="${alvo}" data-campo="${campo}">${esc(rotulo)}${ativo ? icone(ordem.dir === "asc" ? "cima" : "baixo") : ""}</button></th>`;
}
function ordenarLista(lista, ordem, extrair) {
  const f = extrair[ordem.campo] || ((x) => x[ordem.campo]);
  const s = ordem.dir === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => s * comparar(f(a), f(b)));
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast("Mensagem copiada.");
    return true;
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? "Mensagem copiada." : "Não consegui copiar. Selecione o texto e copie manualmente.", ok ? "ok" : "erro");
    return ok;
  }
}

/** Link do WhatsApp com a mensagem pronta. Sem telefone: o WhatsApp pergunta o contato. */
function linkWhatsApp(telefone, texto) {
  const tel = telefoneWhats(telefone);
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

// --------------------------------------------------------------- Excel
/**
 * Gera e oferece uma planilha .xlsx.
 * abas: [{nome, colunas: [{titulo, largura, tipo: "texto"|"numero"|"data"}], linhas: [[...]]}]
 */
async function exportarExcel(nomeArquivo, abas) {
  let XLSX;
  try { XLSX = await carregarSheetJS(); } catch (e) {
    toast("Não consegui carregar o gerador de Excel. Verifique a internet e tente de novo.", "erro");
    return;
  }
  const livro = XLSX.utils.book_new();
  for (const aba of abas) {
    const dados = [aba.colunas.map((c) => c.titulo)];
    for (const l of aba.linhas) {
      dados.push(l.map((v, i) => {
        const tipo = aba.colunas[i] && aba.colunas[i].tipo;
        if (v == null || v === "") return null;
        if (tipo === "data" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          const [a, m, d] = v.slice(0, 10).split("-").map(Number);
          const hh = /\s(\d{2}):(\d{2})/.exec(v);
          return new Date(a, m - 1, d, hh ? +hh[1] : 0, hh ? +hh[2] : 0);
        }
        return v;
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet(dados, { cellDates: true, dateNF: "dd/mm/yyyy" });
    ws["!cols"] = aba.colunas.map((c) => ({ wch: c.largura || 14 }));
    if (aba.linhas.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aba.linhas.length, c: aba.colunas.length - 1 } }) };
    XLSX.utils.book_append_sheet(livro, ws, aba.nome.slice(0, 31));
  }
  const buf = XLSX.write(livro, { bookType: "xlsx", type: "array", compression: true });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  let downloads = null;
  try { downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (_) { downloads = null; }
  if (downloads) {
    try {
      await downloads.save({ filename: nomeArquivo, data: blob });
      toast("Planilha pronta.");
    } catch (e) {
      const code = e && e.code;
      if (code === "declined") return;
      if (code === "extension_not_enabled") toast("Esta visualização não permite baixar planilhas Excel.", "erro");
      else if (code === "rate_limited") toast("Já há um download aguardando confirmação.", "info");
      else toast("Não foi possível baixar a planilha.", "erro");
    }
    return;
  }
  // fora do Claude (ex.: teste local): download comum do navegador
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
