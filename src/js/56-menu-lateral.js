/* Menu móvel com rolagem própria e preferência de recolhimento no computador. */
const MenuLateral = (() => {
  const desktop = window.matchMedia('(min-width: 901px)');
  let fundo;
  const estaAberto = () => document.querySelector('.app').classList.contains('menu-aberto');
  function fechar({ restaurarFoco = true } = {}) {
    if (!estaAberto()) return;
    document.querySelector('.app').classList.remove('menu-aberto');
    const rail = document.querySelector('.rail');
    rail.removeAttribute('role'); rail.removeAttribute('aria-modal'); rail.removeAttribute('aria-label');
    const botao = document.querySelector('.btn-menu');
    botao.setAttribute('aria-expanded', 'false'); botao.setAttribute('aria-label', 'Abrir menu');
    fundo.hidden = true;
    Camadas.atualizar();
    if (restaurarFoco && !desktop.matches) botao.focus({ preventScroll: true });
  }
  function alternarMovel() {
    if (desktop.matches) return;
    if (estaAberto()) { fechar(); return; }
    const rail = document.querySelector('.rail');
    rail.style.setProperty('--menu-cabecalho', `${rail.getBoundingClientRect().height}px`);
    document.querySelector('.app').classList.add('menu-aberto');
    rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true'); rail.setAttribute('aria-label', 'Menu de navegação');
    const botao = document.querySelector('.btn-menu');
    botao.setAttribute('aria-expanded', 'true'); botao.setAttribute('aria-label', 'Fechar menu');
    fundo.hidden = false;
    Camadas.atualizar();
    Dica.esconder();
    const atual = document.querySelector('#nav a.ativo') || document.querySelector('#nav a');
    atual?.focus({ preventScroll: true }); atual?.scrollIntoView({ block: 'nearest' });
  }
  function atualizar() {
    const recolhido = desktop.matches && document.documentElement.classList.contains('menu-recolhido');
    document.querySelectorAll('[data-acao="menu-lateral"]').forEach(el => el.setAttribute('aria-expanded', String(!recolhido)));
  }
  function iniciar() {
    try { document.documentElement.classList.toggle('menu-recolhido', localStorage.getItem('cp-menu-recolhido') === '1'); }
    catch (_) { /* A navegação funciona sem armazenamento local. */ }
    fundo = document.createElement('div'); fundo.className = 'menu-fundo'; fundo.hidden = true; fundo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fundo); fundo.addEventListener('click', () => fechar());
    // Alguns navegadores suprimem o click após um arraste. Reconhece o toque
    // diretamente, sem fechar por um gesto de rolagem nem gerar clique no fundo.
    let toque = null;
    fundo.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      e.preventDefault(); toque = { id: e.pointerId, x: e.clientX, y: e.clientY, arrastou: false };
    });
    fundo.addEventListener('pointermove', e => {
      if (toque?.id === e.pointerId && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 10) toque.arrastou = true;
    });
    fundo.addEventListener('pointerup', e => {
      if (toque?.id !== e.pointerId) return;
      const fecharPorToque = !toque.arrastou; toque = null;
      if (fecharPorToque) { e.preventDefault(); fechar(); }
    });
    fundo.addEventListener('pointercancel', () => { toque = null; });
    atualizar();
    desktop.addEventListener('change', () => { fechar({ restaurarFoco: false }); atualizar(); });
    new ResizeObserver(() => {
      const rail = document.querySelector('.rail');
      if (!desktop.matches) rail.style.setProperty('--menu-cabecalho', `${rail.getBoundingClientRect().height}px`);
    }).observe(document.querySelector('.rail'));
    document.addEventListener('keydown', e => {
      if (!estaAberto() || document.querySelector('.modal-fundo')) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      if (e.key !== 'Tab') return;
      const focaveis = [...document.querySelectorAll('.rail button, .rail a')].filter(el => !el.disabled && el.getClientRects().length);
      const primeiro = focaveis[0], ultimo = focaveis.at(-1);
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  }
  function alternar() {
    if (!desktop.matches) return;
    const recolhido = document.documentElement.classList.toggle('menu-recolhido');
    try { localStorage.setItem('cp-menu-recolhido', recolhido ? '1' : '0'); } catch (_) { /* preferência nesta aba */ }
    atualizar();
    document.querySelector(recolhido ? '.btn-mostrar-menu' : '.btn-recolher-menu')?.focus({ preventScroll: true });
    Dica.esconder();
  }
  return { iniciar, alternar, alternarMovel, fechar };
})();
