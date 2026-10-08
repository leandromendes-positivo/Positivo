/* Uma barra acessível acompanha a tabela visível, mesmo em listas compridas. */
const RolagemHorizontal = (() => {
  const tabelas = new Map();
  const altura = 54;
  let barra, controle, anterior, proxima, rotulo, posicao, ativa, preferida, quadro = 0, sequencia = 0;
  let observador;
  const agendar = () => { if (!quadro) quadro = requestAnimationFrame(atualizar); };

  function selecionarTabela(el) {
    if (ativa !== el) ativa?.classList.remove('rolagem-com-controle');
    ativa = el;
    ativa?.classList.add('rolagem-com-controle');
  }

  function deslocar(valor) {
    if (!ativa?.isConnected) return;
    ativa.scrollLeft = Math.max(0, Math.min(ativa.scrollWidth - ativa.clientWidth, valor));
    sincronizar();
  }
  function sincronizar() {
    if (!ativa) return;
    const max = Math.max(0, ativa.scrollWidth - ativa.clientWidth), valor = ativa.scrollLeft;
    controle.max = String(max); controle.value = String(valor);
    const percentual = max ? Math.round(valor / max * 100) : 0;
    controle.setAttribute('aria-valuetext', `${percentual}% da largura da tabela`);
    anterior.disabled = valor <= 1; proxima.disabled = valor >= max - 1;
    posicao.textContent = `${percentual}%`;
    controle.style.setProperty('--alca', `${Math.max(32, controle.clientWidth * ativa.clientWidth / ativa.scrollWidth)}px`);
  }
  function criarBarra() {
    barra = document.createElement('div');
    barra.className = 'rolagem-horizontal'; barra.hidden = true;
    barra.setAttribute('role', 'group'); barra.setAttribute('aria-label', 'Navegar pelas colunas da tabela');
    barra.innerHTML = `<button type="button" class="btn-icone" data-rolagem="anterior" aria-label="Ver colunas à esquerda" title="Ver colunas à esquerda">${icone('esquerda')}</button>
      <div class="rolagem-controle"><div class="rolagem-legenda"><span>Colunas · <span data-rolagem-nome></span></span><span data-rolagem-posicao aria-hidden="true"></span></div><input type="range" min="0" max="100" value="0" step="1" aria-label="Rolagem horizontal da tabela" title="Arraste para ver todas as colunas"></div>
      <button type="button" class="btn-icone" data-rolagem="proxima" aria-label="Ver colunas à direita" title="Ver colunas à direita">${icone('direita')}</button>`;
    controle = barra.querySelector('input'); anterior = barra.querySelector('[data-rolagem="anterior"]'); proxima = barra.querySelector('[data-rolagem="proxima"]');
    rotulo = barra.querySelector('[data-rolagem-nome]'); posicao = barra.querySelector('[data-rolagem-posicao]');
    anterior.addEventListener('click', () => deslocar(ativa.scrollLeft - ativa.clientWidth * .75));
    proxima.addEventListener('click', () => deslocar(ativa.scrollLeft + ativa.clientWidth * .75));
    controle.addEventListener('input', () => deslocar(Number(controle.value)));
    controle.addEventListener('keydown', e => {
      if (!ativa) return;
      const valores = { ArrowLeft: ativa.scrollLeft - 40, ArrowRight: ativa.scrollLeft + 40, PageUp: ativa.scrollLeft - ativa.clientWidth, PageDown: ativa.scrollLeft + ativa.clientWidth, Home: 0, End: ativa.scrollWidth };
      if (e.key in valores) { e.preventDefault(); deslocar(valores[e.key]); }
    });
    barra.addEventListener('wheel', e => {
      if (!ativa || e.ctrlKey) return;
      const antes = ativa.scrollLeft, escala = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? ativa.clientWidth : 1;
      deslocar(antes + (e.deltaX || e.deltaY) * escala);
      if (ativa.scrollLeft !== antes) e.preventDefault();
    }, { passive: false });
  }
  function registrar() {
    for (const [el, dados] of tabelas) if (!el.isConnected) {
      observador?.unobserve(el); if (dados.tabela) observador?.unobserve(dados.tabela);
      dados.reserva.remove(); tabelas.delete(el);
    }
    document.querySelectorAll('.tabela-rolagem').forEach(el => {
      if (!tabelas.has(el)) {
        const reserva = document.createElement('div'); reserva.className = 'rolagem-reserva'; reserva.hidden = true; reserva.setAttribute('aria-hidden', 'true');
        el.after(reserva); tabelas.set(el, { reserva }); observador?.observe(el);
        if (!el.id) el.id = `tabela-rolavel-${++sequencia}`;
      }
      const dados = tabelas.get(el), tabela = el.querySelector('table');
      if (dados.tabela !== tabela) {
        if (dados.tabela) observador?.unobserve(dados.tabela);
        dados.tabela = tabela; if (tabela) observador?.observe(tabela);
      }
      const larga = el.scrollWidth > el.clientWidth + 1;
      dados.reserva.hidden = !larga;
      if (larga) {
        el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Tabela com rolagem horizontal');
      } else { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
    });
  }
  function atualizar() {
    quadro = 0;
    registrar();
    const modal = [...document.querySelectorAll('.modal-fundo')].at(-1)?.querySelector('.modal');
    const area = modal?.querySelector('.modal-corpo') || document.getElementById('conteudo');
    const destino = modal || document.querySelector('.principal');
    // Dentro da janela, o controle participa da navegação por teclado do diálogo.
    if (barra.parentElement !== destino) destino.appendChild(barra);
    const viewport = window.visualViewport;
    const topo = viewport?.offsetTop || 0, fim = topo + (viewport?.height || innerHeight);
    const caixaArea = area.getBoundingClientRect();
    const menu = innerWidth <= 900 ? document.querySelector('.rail').getBoundingClientRect().bottom : topo;
    const limites = { topo: Math.max(topo, modal ? caixaArea.top : menu), fim: Math.min(fim, modal ? caixaArea.bottom : fim) - 8 };
    const candidatos = [];
    for (const [el, dados] of tabelas) {
      if (!area.contains(el) || dados.reserva.hidden || el.closest('details:not([open])') || !el.getClientRects().length) continue;
      // A elegibilidade usa o conteúdo, sem a altura da barra nativa que será substituída.
      const caixa = el.getBoundingClientRect(), fimConteudo = caixa.top + el.clientTop + el.clientHeight;
      const visivel = Math.min(fimConteudo, limites.fim) - Math.max(caixa.top, limites.topo);
      if (visivel < Math.min(40, el.clientHeight) || limites.fim - Math.max(caixa.top, limites.topo) < altura) continue;
      candidatos.push({ el, dados, caixa, visivel });
    }
    const focoNaBarra = barra.contains(document.activeElement);
    const alvo = candidatos.find(c => c.el === (focoNaBarra ? ativa : preferida)) || candidatos.sort((a,b) => b.visivel - a.visivel)[0];
    if (!alvo || E.status !== 'pronto') { barra.hidden = true; selecionarTabela(null); return; }
    selecionarTabela(alvo.el);
    const esquerda = Math.max(8, alvo.caixa.left), direita = Math.min(document.documentElement.clientWidth - 8, alvo.caixa.right);
    const y = Math.min(alvo.dados.reserva.getBoundingClientRect().top, limites.fim - altura);
    barra.style.left = `${esquerda}px`; barra.style.top = `${y}px`; barra.style.width = `${Math.max(0, direita - esquerda)}px`;
    barra.hidden = false;
    const nome = ativa.closest('.cartao')?.querySelector('h2')?.textContent || modal?.querySelector('h2')?.textContent || document.getElementById('titulo').textContent;
    if (rotulo.textContent !== nome) rotulo.textContent = nome;
    controle.setAttribute('aria-controls', ativa.id);
    sincronizar();
  }
  function iniciar() {
    criarBarra();
    observador = window.ResizeObserver ? new ResizeObserver(agendar) : null;
    new MutationObserver(mudancas => {
      if (mudancas.some(m => !m.target.closest?.('.rolagem-horizontal'))) agendar();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('scroll', agendar, { capture: true, passive: true });
    window.addEventListener('resize', agendar, { passive: true });
    window.visualViewport?.addEventListener('resize', agendar, { passive: true });
    window.visualViewport?.addEventListener('scroll', agendar, { passive: true });
    for (const evento of ['pointerover', 'focusin']) document.addEventListener(evento, e => {
      const tabela = e.target.closest?.('.tabela-rolagem');
      if (tabela && tabela !== preferida) { preferida = tabela; agendar(); }
    });
    document.fonts?.ready.then(agendar);
    agendar();
  }
  return { iniciar };
})();
