/* Preferência visual local; o menu móvel continua independente. */
const MenuLateral = (() => {
  const desktop = window.matchMedia('(min-width: 901px)');
  function atualizar() {
    const recolhido = desktop.matches && document.documentElement.classList.contains('menu-recolhido');
    document.querySelectorAll('[data-acao="menu-lateral"]').forEach(el => el.setAttribute('aria-expanded', String(!recolhido)));
  }
  function iniciar() {
    try { document.documentElement.classList.toggle('menu-recolhido', localStorage.getItem('cp-menu-recolhido') === '1'); }
    catch (_) { /* A navegação funciona sem armazenamento local. */ }
    atualizar();
    desktop.addEventListener('change', atualizar);
  }
  function alternar() {
    if (!desktop.matches) return;
    const recolhido = document.documentElement.classList.toggle('menu-recolhido');
    try { localStorage.setItem('cp-menu-recolhido', recolhido ? '1' : '0'); } catch (_) { /* preferência nesta aba */ }
    atualizar();
    document.querySelector(recolhido ? '.btn-mostrar-menu' : '.btn-recolher-menu')?.focus({ preventScroll: true });
    Dica.esconder();
  }
  return { iniciar, alternar };
})();
