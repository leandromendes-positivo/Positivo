/* Mantém o fundo imóvel e inativo enquanto há um menu, diálogo ou login aberto. */
const Camadas = (() => {
  let posicao = null;
  function ajustarViewport() {
    const v = window.visualViewport, raiz = document.documentElement;
    // Acompanha o teclado virtual sem interferir no zoom por gesto.
    if (v && Math.abs(v.scale - 1) < .01) {
      raiz.style.setProperty('--camada-altura', `${v.height}px`);
      raiz.style.setProperty('--camada-topo', `${v.offsetTop}px`);
    } else {
      raiz.style.removeProperty('--camada-altura'); raiz.style.removeProperty('--camada-topo');
    }
  }
  function atualizar() {
    const login = !document.getElementById('acesso').hidden;
    const modais = [...document.querySelectorAll('.modal-fundo')];
    const menu = innerWidth <= 900 && document.querySelector('.app').classList.contains('menu-aberto');
    const bloquear = login || modais.length > 0 || menu;
    const raiz = document.documentElement;
    if (bloquear && !posicao) {
      posicao = { x: scrollX, y: scrollY };
      raiz.style.setProperty('--pagina-topo', `${-posicao.y}px`);
      raiz.style.setProperty('--pagina-esquerda', `${-posicao.x}px`);
      raiz.style.setProperty('--pagina-barra', `${innerWidth - raiz.clientWidth}px`);
      raiz.classList.add('rolagem-bloqueada');
    } else if (!bloquear && posicao) {
      const anterior = posicao; posicao = null;
      raiz.classList.remove('rolagem-bloqueada');
      for (const nome of ['--pagina-topo', '--pagina-esquerda', '--pagina-barra']) raiz.style.removeProperty(nome);
      window.scrollTo({ left: anterior.x, top: anterior.y, behavior: 'instant' });
    }
    document.querySelector('.principal').inert = Boolean(bloquear);
    document.querySelector('.rail').inert = login || modais.length > 0;
    for (const modal of modais) modal.inert = login || modal !== modais.at(-1);
    if (login) Pesquisas.fechar();
    else if (bloquear) Pesquisas.fechar(document.querySelector('.principal'));
  }
  function iniciar() {
    // Inclui remoções de diálogos causadas por saída da conta ou perda de acesso.
    const observador = new MutationObserver(atualizar);
    observador.observe(document.body, { childList: true });
    observador.observe(document.getElementById('acesso'), { attributes: true, attributeFilter: ['hidden'] });
    window.visualViewport?.addEventListener('resize', ajustarViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', ajustarViewport, { passive: true });
    window.addEventListener('resize', ajustarViewport, { passive: true });
    ajustarViewport();
    atualizar();
  }
  return { iniciar, atualizar };
})();
