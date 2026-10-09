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

let sequenciaModal = 0;
const modaisAdministrativos = new Set();
function fecharModaisAdministrativos() {
  for (const fechar of [...modaisAdministrativos]) fechar();
}
/** Janela modal. Devolve {el, fechar}. */
function abrirModal({ titulo, subtitulo = "", corpo = "", rodape = "", largura = "", aoFechar, administrativo = false }) {
  if (administrativo) exigirAdministrador();
  Pesquisas.fechar();
  const fundo = document.createElement("div");
  const idTitulo = `modal-titulo-${++sequenciaModal}`;
  fundo.className = "modal-fundo";
  fundo.innerHTML = `<div class="modal ${largura}" role="dialog" aria-modal="true" aria-labelledby="${idTitulo}" tabindex="-1">
    <header class="modal-topo"><div><h2 id="${idTitulo}"></h2>${subtitulo ? `<p class="modal-sub"></p>` : ""}</div>
    <button class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>${largura.split(/\s+/).includes('calendario') ? '' : imagemCabecalho()}</header>
    <div class="modal-corpo">${corpo}</div>
    ${rodape ? `<footer class="modal-rodape">${rodape}</footer>` : ""}
  </div>`;
  fundo.querySelector("h2").textContent = titulo;
  if (subtitulo) fundo.querySelector(".modal-sub").textContent = subtitulo;
  const anterior = document.activeElement;
  const janelaAtual = () => [...document.querySelectorAll(".modal-fundo")].at(-1);
  const fechar = () => {
    modaisAdministrativos.delete(fechar);
    if (!fundo.isConnected) return;
    Pesquisas.fechar(fundo);
    fundo.remove();
    Camadas.atualizar();
    document.removeEventListener("keydown", tecla);
    const substituto = anterior?.dataset?.acao && document.querySelector(`#conteudo [data-acao="${CSS.escape(anterior.dataset.acao)}"]`);
    const destino = anterior?.isConnected ? anterior : substituto;
    if (destino && (!janelaAtual() || janelaAtual().contains(destino))) destino.focus({ preventScroll: true });
    aoFechar && aoFechar();
  };
  const tecla = (e) => {
    if (janelaAtual() !== fundo) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(); return; }
    if (e.key !== "Tab") return;
    const focaveis = [...fundo.querySelectorAll('button, a[href], input, textarea, select, [tabindex]')]
      .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    const primeiro = focaveis[0], ultimo = focaveis.at(-1);
    if (!primeiro) { e.preventDefault(); fundo.querySelector(".modal").focus(); }
    else if (!fundo.contains(document.activeElement) || (e.shiftKey && document.activeElement === primeiro) || (!e.shiftKey && document.activeElement === ultimo)) {
      e.preventDefault(); (e.shiftKey ? ultimo : primeiro).focus();
    }
  };
  document.addEventListener("keydown", tecla);
  fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fechar));
  document.body.appendChild(fundo);
  if (administrativo) modaisAdministrativos.add(fechar);
  Camadas.atualizar();
  Calendarios.preparar(fundo);
  Pesquisas.preparar(fundo);
  setTimeout(() => {
    // A aba inicial pode ocultar campos. Não roube o foco de quem já começou a editar.
    if (!fundo.isConnected || janelaAtual() !== fundo || fundo.contains(document.activeElement)) return;
    const visivel = el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const foco = [...fundo.querySelectorAll('[autofocus]')].find(visivel)
      || [...fundo.querySelectorAll('.modal-corpo input, .modal-corpo textarea, .modal-corpo select, .seletor-data-botao, .modal-rodape .prim')].find(visivel)
      || fundo.querySelector('[data-fechar]');
    foco.focus();
  }, 30);
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
  if (t.statusNovas === "acima") texto = `Excesso de ${fmtNum(t.excessoNovas)}`;
  return pill(s.classe, texto, s.icone);
}
function avatar(nome) {
  return `<span class="avatar" aria-hidden="true">${esc(iniciais(nome))}</span>`;
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
  return `<section class="cartao cartao-separado ${classe}"><header class="cartao-topo"><div><h2>${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${acoes ? `<div class="cartao-acoes">${acoes}</div>` : ""}${imagemCabecalho()}</header><div class="cartao-corpo">${corpo}</div></section>`;
}

/** Camada decorativa compartilhada, sem interferir nos controles ou na leitura assistiva. */
function imagemCabecalho() {
  return '<span class="cabecalho-imagem" aria-hidden="true"><span class="cabecalho-arte"></span></span>';
}
function paginacao(total, pagina, porPagina, alvo) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return `<div class="paginacao"><span>${fmtNum(total)} ${total === 1 ? "linha" : "linhas"}</span></div>`;
  const ini = (pagina - 1) * porPagina + 1, fim = Math.min(total, pagina * porPagina);
  return `<div class="paginacao"><span>${fmtNum(ini)}–${fmtNum(fim)} de ${fmtNum(total)}</span>
    <div><button class="btn pequeno" data-acao="pagina" data-alvo="${alvo}" data-p="${pagina - 1}" aria-label="Página anterior da lista" ${pagina <= 1 ? "disabled" : ""}>${icone('esquerda')}Anterior</button>
    <span class="pag-num">${pagina} / ${paginas}</span>
    <button class="btn pequeno" data-acao="pagina" data-alvo="${alvo}" data-p="${pagina + 1}" aria-label="Próxima página da lista" ${pagina >= paginas ? "disabled" : ""}>Próxima${icone('direita')}</button></div></div>`;
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
