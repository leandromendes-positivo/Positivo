/* Movimento progressivo: conteúdo legível, animações finitas e opt-out. */
const Movimento = {
  rota: "", vistos: new Set(), observador: null,
  reduzido: window.matchMedia("(prefers-reduced-motion: reduce)"),
  animar(el, quadros, duracao = 350) {
    if (!el || this.reduzido.matches || !el.animate) return;
    return el.animate(quadros, { duration: duracao, easing: "cubic-bezier(.22,1,.36,1)" });
  },
  detalhe(el) {
    this.animar(el, [{ opacity: .3, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }]);
  },
  preparar() {
    this.observador?.disconnect();
    const rota = UI.pagina + (UI.tid || "");
    if (rota !== this.rota) {
      this.vistos.clear(); this.rota = rota;
      this.detalhe(document.getElementById("titulo"));
      this.detalhe(document.querySelector("#conteudo > .barra-filtros, #conteudo > .abas, #conteudo > .importar-topo"));
    }
    if (this.reduzido.matches || !window.IntersectionObserver) return;
    this.observador = new IntersectionObserver((entradas) => {
      entradas.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        this.vistos.add(target.dataset.movimento);
        target.classList.add("em-revelacao");
        this.observador.unobserve(target);
      });
    }, { threshold: .08 });
    document.querySelectorAll("#conteudo .operacao-hero, #conteudo .kpi, #conteudo .cartao, #conteudo .cob, #conteudo .boas-vindas, #conteudo > .tabela-rolagem").forEach((el, n) => {
      const chave = el.className + ":" + n;
      if (this.vistos.has(chave)) return;
      el.dataset.movimento = chave;
      el.style.setProperty("--atraso", `${Math.min(n % 4 * 45, 135)}ms`);
      this.observador.observe(el);
    });
  },
};
Movimento.reduzido.addEventListener("change", () => {
  if (Movimento.reduzido.matches) {
    Movimento.observador?.disconnect();
    document.getAnimations().forEach((a) => a.cancel());
  }
});
