/* Executado antes do CSS para restaurar a preferência sem piscar outro tema. */
const Tema = (() => {
  const chave = "cp-tema";
  const sistema = window.matchMedia("(prefers-color-scheme: dark)");
  const valido = (valor) => valor === "light" || valor === "dark";
  let preferencia = null;
  try {
    const salva = localStorage.getItem(chave);
    if (valido(salva)) preferencia = salva;
  } catch (_) { /* A troca continua funcionando sem armazenamento local. */ }

  function atualizarBotoes() {
    const escuro = document.documentElement.dataset.theme === "dark";
    document.querySelectorAll('[data-acao="tema"]').forEach((botao) => {
      botao.setAttribute("aria-checked", String(escuro));
      botao.title = escuro ? "Ativar modo claro" : "Ativar modo escuro";
      botao.querySelector("[data-tema-rotulo]").textContent = escuro ? "Modo escuro" : "Modo claro";
    });
  }

  function aplicar() {
    const tema = preferencia || (sistema.matches ? "dark" : "light");
    document.documentElement.dataset.theme = tema;
    const cor = document.querySelector('meta[name="theme-color"]');
    if (cor) cor.content = tema === "dark" ? "#050505" : "#ffffff";
    atualizarBotoes();
  }

  function alternar() {
    preferencia = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(chave, preferencia); } catch (_) { /* preferência desta sessão */ }
    aplicar();
  }

  sistema.addEventListener("change", () => { if (!preferencia) aplicar(); });
  window.addEventListener("storage", (ev) => {
    if (ev.key !== chave && ev.key !== null) return;
    preferencia = valido(ev.newValue) ? ev.newValue : null;
    aplicar();
  });
  document.addEventListener("DOMContentLoaded", atualizarBotoes);
  aplicar();
  return { alternar, atualizarBotoes };
})();
