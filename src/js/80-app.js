/* ==========================================================================
   Aplicativo: navegação, eventos globais e inicialização.
   ========================================================================== */

const UI = {
  pagina: "painel",
  tid: null,
  posRender: null,
  cob: { aba: "cobrar", foco: "", regiao: "", busca: "", ordem: "dias", abertos: new Set() },
  us: { aba: "pendentes", status: "todas", regiao: "", tid: "", busca: "", faixa: null, ordem: { campo: "dias", dir: "desc" }, pagina: 1, paginaDev: 1, sel: new Set() },
  es: { regiao: "", status: "", busca: "", bases: false, ordem: { campo: "novasQtd", dir: "desc" }, abertos: new Set() },
  tc: { tipo: "tecnico", localidade: "", regiao: "", busca: "", mostrarSemDados: false, ordem: { campo: "nome", dir: "asc" } },
  ficha: { tid: null, aba: "usadas", pagina: 1 },
  im: { fila: [], processando: false, progresso: "", resultado: null, erro: null },
};

const PAGINAS = {
  painel: { titulo: "Controle operacional", nav: "Visão geral", icone: "painel", render: renderPainel, depois: desenharPainel },
  cobrancas: { titulo: "Cobranças", icone: "sino", render: renderCobrancas },
  usadas: { titulo: "Peças usadas", icone: "retorno", render: renderUsadas },
  consulta: { titulo: "Consulta de peças", nav: "Consulta avançada", icone: "busca", render: renderConsulta },
  inventario: { titulo: "Histórico de inventário", icone: "caixa", render: renderInventario },
  estoque: { titulo: "Estoque de novas", icone: "caixa", render: renderEstoque },
  tecnicos: { titulo: "Técnicos", icone: "pessoas", render: renderTecnicos },
  relatorios: { titulo: "Relatórios", icone: "grafico", render: renderRelatorios },
  importar: { admin: true, titulo: "Importar planilhas", icone: "upload", render: renderImportar },
  config: { admin: true, titulo: "Configurações", icone: "ajustes", render: renderConfig, depois: posRenderConfig },
  usuarios: { admin: true, titulo: "Usuários e permissões", nav: "Cadastro de usuários", icone: "pessoas", render: renderUsuarios },
  conta: { titulo: "Minha conta", icone: "pessoa", render: renderConta },
};

function paginasVizinhas() {
  if (UI.pagina === 'tecnicos' && UI.tid) return { anterior: 'tecnicos', proxima: null };
  const paginas = Object.keys(PAGINAS).filter(id => !PAGINAS[id].admin || podeAdministrar());
  const atual = paginas.indexOf(UI.pagina);
  return { anterior: paginas[atual - 1], proxima: paginas[atual + 1] };
}
function atualizarNavegacaoSecoes() {
  const destinos = paginasVizinhas();
  document.querySelectorAll('[data-navegacao-secoes]').forEach(nav => {
    const compacto = nav.classList.contains('navegacao-secoes-topo');
    nav.hidden = E.status !== 'pronto';
    const chave = `${destinos.anterior || ''}|${destinos.proxima || ''}`;
    if (nav.dataset.destinos === chave) return;
    nav.dataset.destinos = chave;
    nav.innerHTML = ['anterior', 'proxima'].map(direcao => {
      const id = destinos[direcao], nome = id ? PAGINAS[id].nav || PAGINAS[id].titulo : '';
      const anterior = direcao === 'anterior', titulo = id ? `${anterior ? 'Voltar para' : 'Avançar para'} ${nome}` : anterior ? 'Primeira seção' : 'Última seção';
      const seta = icone(anterior ? 'esquerda' : 'direita');
      const rotulo = `<span><small>${anterior ? 'Anterior' : 'Próxima'}</small><strong>${esc(nome || '—')}</strong></span>`;
      return `<button type="button" class="${compacto ? 'btn-icone' : 'btn'}" data-acao="navegar-secao" data-direcao="${direcao}" ${!id ? 'disabled' : ''} aria-label="${esc(titulo)}" title="${esc(titulo)}">${compacto ? seta : anterior ? seta + rotulo : rotulo + seta}</button>`;
    }).join('');
  });
}

function irPara(pagina, { tid = null } = {}) {
  MenuLateral.fechar({ restaurarFoco: false });
  if (!PAGINAS[pagina]) pagina = "painel";
  UI.pagina = pagina;
  UI.tid = pagina === "tecnicos" ? tid : null;
  try { history.replaceState(null, "", "#" + pagina); } catch (_) { /* moldura sem histórico */ }
  renderizar(true);
  window.scrollTo({ top: 0 });
  Dica.esconder();
}

let renderPendente = false;
function renderizar(forcar = false) {
  const conteudo = document.getElementById("conteudo");
  if (!conteudo) return;
  const ativo = document.activeElement;
  const seletorFoco = ativo && conteudo.contains(ativo)
    ? [...ativo.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join("") : "";
  // não atrapalha quem está digitando: refaz a tela quando sair do campo
  if (!forcar && (Calendarios.ativo() || (ativo && conteudo.contains(ativo) && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) && ativo.type !== "checkbox"))) {
    renderPendente = true;
    return;
  }
  renderPendente = false;
  atualizarMoldura();
  if (E.status === "carregando" && !E.usadas.length && !E.novas.length) {
    conteudo.innerHTML = `<div class="carregando"><div class="girando"></div><p>Carregando os dados…</p></div>`;
    return;
  }
  if (E.status === "erro") {
    const outraConta = E.erroCodigo === "sem_permissao" && Acesso.modo === "firebase";
    conteudo.innerHTML = vazio("alerta", outraConta ? "Conta sem acesso" : "Não consegui carregar os dados",
      esc(E.erro || "") + (outraConta && Acesso.usuario ? `<br><span class="mono">${esc(Acesso.usuario.email)}</span>` : ""),
      outraConta ? `<button class="btn prim" data-acao="sair">Entrar com outra conta</button>${Acesso.usuario && !Acesso.usuario.verificado ? '<button class="btn" data-acao="verificar-email">Enviar confirmação de e-mail</button><button class="btn" data-acao="recarregar">Já confirmei meu e-mail</button>' : ''}` : `<button class="btn prim" data-acao="recarregar">Tentar de novo</button>`);
    return;
  }
  if (PAGINAS[UI.pagina]?.admin && !podeAdministrar()) UI.pagina = 'painel';
  atualizarNavegacaoSecoes();
  const p = PAGINAS[UI.pagina];
  UI.posRender = null;
  conteudo.dataset.pagina = UI.pagina;
  conteudo.innerHTML = cabecalhoSecao(UI.pagina, derivar()) + p.render();
  Calendarios.preparar(conteudo);
  if (!podeAdministrar()) {
    document.querySelectorAll('[data-acao="editar-tecnico"], [data-acao="editar-prazos"], [data-acao="consulta-classificar"], [data-acao="desfazer-importacao"]').forEach(el=>el.disabled=true);
    document.querySelectorAll('[data-mudar="tipo-tecnico"]').forEach(el=>el.disabled=true);
  }
  if (p.depois) p.depois();
  if (UI.posRender) UI.posRender();
  Movimento.preparar();
  if (seletorFoco && !ativo.isConnected) {
    const substituto = conteudo.querySelector(ativo.localName + seletorFoco);
    if (substituto && !substituto.disabled && substituto.getClientRects().length) substituto.focus({ preventScroll: true });
  }
}

function atualizarMoldura() {
  Notificacoes.atualizar();
  atualizarNavegacaoSecoes();
  const D = E.status === "pronto" ? derivar() : null;
  document.getElementById("entrada-topo").closest("label").hidden = !podeAdministrar();
  const p = PAGINAS[UI.pagina];
  const titulo = document.getElementById("titulo");
  const grupo = document.getElementById('topo-grupo');
  grupo.textContent = p.admin ? 'Administração' : UI.pagina === 'conta' ? 'Minha conta' : ['consulta', 'inventario', 'relatorios'].includes(UI.pagina) ? 'Análises e consultas' : ['estoque', 'tecnicos'].includes(UI.pagina) ? 'Recursos' : 'Monitoramento';
  const marca = document.getElementById('topo-icone'), simbolo = UI.tid ? 'pessoa' : p.icone;
  if (marca.dataset.icone !== simbolo) { marca.innerHTML = icone(simbolo); marca.dataset.icone = simbolo; }
  const tituloTexto = UI.tid && D && D.mapa.get(UI.tid) ? "Ficha do técnico" : p.titulo;
  if (titulo) titulo.textContent = tituloTexto;
  const sub = document.getElementById("subtitulo");
  if (sub) sub.textContent = fmtDataExtensa(hojeISO()).replace(/^./, (c) => c.toUpperCase());
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const ativo = a.dataset.nav === UI.pagina;
    a.classList.toggle("ativo", ativo);
    if (ativo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const cont = document.getElementById("contador-cobrancas");
  if (cont) {
    const n = D ? D.kpi.cobrarTecnicos : 0;
    cont.textContent = n ? String(n) : "";
    cont.hidden = !n;
  }
  const fr = document.getElementById("rail-frescor");
  if (fr && D) {
    const regioes = [...new Set(D.frescor.map((f) => f.regiao))];
    fr.innerHTML = regioes.length ? `<span class="rail-rotulo">Planilhas</span>${regioes.map((r) => {
      const fs = D.frescor.filter((f) => f.regiao === r);
      const pior = Math.max(...fs.map((f) => (f.dias == null ? 99 : f.dias)));
      const cls = pior === 0 ? "hoje" : pior === 1 ? "ontem" : "velha";
      const quando = pior === 0 ? "hoje" : pior === 1 ? "ontem" : pior >= 99 ? "faltando" : `há ${pior} dias`;
      return `<span class="rail-uf ${cls}" title="${esc(UFS[r] || r)}: ${quando}"><i></i>${esc(r)}<em>${quando}</em></span>`;
    }).join("")}` : "";
  }
  const aviso = document.getElementById("aviso-armazem");
  if (aviso) {
    const soLeitura = Armazem.online && E.usuario.podeEscrever === false;
    aviso.hidden = (Armazem.online && !soLeitura) || E.status === "carregando";
    if (!aviso.hidden) {
      const [titulo, texto] = soLeitura
        ? ["Acesso só de leitura", "Você pode consultar o painel, mas importar planilhas e registrar cobranças fica com quem tem acesso de edição."]
        : textoSemBanco();
      aviso.querySelector("strong").textContent = titulo;
      aviso.querySelector("span").textContent = texto;
    }
  }
  const conta = document.getElementById("rail-conta");
  if (conta) {
    conta.hidden = !(Acesso.modo === "firebase" && Acesso.usuario);
    if (!conta.hidden) {
      conta.innerHTML = `<button class="conta-menu" data-acao="ir" data-pagina="conta" aria-label="Abrir minha conta">${avatar(Acesso.usuario.nome,'tecnico')}<span><strong>${esc(Acesso.usuario.nome)}</strong><small>${esc(Acesso.usuario.email)}</small><em>${esc(PERFIS[Acesso.perfil?.perfil] || 'Sem acesso')}</em></span>${icone('direita')}</button>`;
    }
  }
}

// ------------------------------------------------------------- ações
function itensSelecionados() {
  const D = derivar();
  return D.itens.filter((i) => UI.us.sel.has(i.k));
}

const ACOES = {
  "relatorios-exportar": el => exportarRelatorio(el.dataset.formato),
  "relatorios-pecas": () => modalPecasRelatorio(),
  "relatorios-atualizar": () => { relatorioHistorico.chave = ''; renderizar(true); },
  "relatorios-limpar": () => { UIrelatorios.filtros = filtrosIniciaisRelatorio(); UIrelatorios.rascunho = null; UIrelatorios.pagina = 1; renderizar(true); },
  "relatorios-periodo": el => periodoRapidoRelatorio(el.dataset.periodo),
  notificacoes: () => Notificacoes.abrir(),
  'limpar-foco-cobranca': () => { UI.cob.foco = ''; renderizar(true); },
  "navegar-secao": el => {
    const pagina = paginasVizinhas()[el.dataset.direcao];
    if (!pagina) return;
    irPara(pagina);
    const titulo = document.getElementById('titulo');
    titulo.setAttribute('tabindex', '-1'); titulo.focus({ preventScroll: true });
  },
  "menu-lateral": () => MenuLateral.alternar(),
  "ranking-filtro": (el) => alterarFiltroRanking(el.dataset.campo, el.dataset.valor),
  "ranking-recarregar": () => { limparHistoricoRanking(); renderizar(true); },
  "ranking-detalhe": (el) => modalRanking(el.dataset.tid, el.dataset.modo),
  "ranking-completo": (el) => modalRankingCompleto(el.dataset.modo),
  "consultar-saidas": () => { UIconsulta.filtros = { ...FILTROS_CONSULTA, tipo: 'novas', origem: 'saida', situacao: 'pendente', regiao: UIranking.regiao }; UIconsulta.pagina = 1; UIconsulta.visao = 'pecas'; irPara('consulta'); },
  "consulta-remover": (el) => { UIconsulta.filtros[el.dataset.campo] = FILTROS_CONSULTA[el.dataset.campo]; UIconsulta.pagina = 1; renderizar(true); },
  "consulta-limpar": () => { UIconsulta.filtros = { ...FILTROS_CONSULTA }; UIconsulta.pagina = 1; renderizar(true); },
  "consulta-visao": (el) => { UIconsulta.visao = el.dataset.valor; if (UIconsulta.visao === 'tecnicos' && UIconsulta.ordem === 'material') UIconsulta.ordem = 'tecnico'; UIconsulta.pagina = 1; renderizar(true); },
  "consulta-responsavel": (el) => { UIconsulta.filtros.tid = el.dataset.tid; UIconsulta.visao = 'pecas'; UIconsulta.pagina = 1; renderizar(true); },
  "consulta-exportar": () => exportarConsulta(),
  "consulta-classificar": (el) => modalClassificarSaida(el.dataset.k),
  "painel-usadas": (el) => {
    Object.assign(UI.us, { aba: "pendentes", status: el.dataset.status || "todas", faixa: null, tid: "", regiao: "", busca: "", pagina: 1 });
    UI.us.sel.clear(); irPara("usadas");
  },
  "painel-estoque": () => { Object.assign(UI.es, { regiao: "", status: "", busca: "", bases: false }); irPara("estoque"); },
  "painel-cobrancas": (el) => abrirCobrancasPainel(el.dataset.aba || "cobrar"),
  "painel-zoom": (el) => ajustarZoomMapa(Number(el.dataset.passo)),
  "painel-fila": (el) => atualizarFiltroPainel("fila", el.dataset.fila, `[data-acao="painel-fila"][data-fila="${el.dataset.fila}"]`),
  "painel-dia": (el) => atualizarFiltroPainel("dia", el.dataset.dia, `[data-acao="painel-dia"][data-dia="${el.dataset.dia}"]`),
  "painel-regiao": (el) => atualizarFiltroPainel("regiao", el.dataset.regiao, `.mapa-regioes [data-regiao="${el.dataset.regiao}"]`),
  "painel-mapa-modo": (el) => atualizarFiltroPainel("mapaModo", el.dataset.modo, `[data-acao="painel-mapa-modo"][data-modo="${el.dataset.modo}"]`),
  "painel-periodo": (el) => atualizarFiltroPainel("periodo", Number(el.dataset.periodo), `[data-acao="painel-periodo"][data-periodo="${el.dataset.periodo}"]`),
  "painel-regiao-abrir": () => {
    if (UIpainel.mapaModo === "novas") {
      Object.assign(UI.es, { regiao: UIpainel.regiao, status: "", busca: "", bases: false });
      irPara("estoque");
    } else {
      Object.assign(UI.us, { regiao: UIpainel.regiao, status: "todas", busca: "", faixa: null, tid: "", pagina: 1, aba: "pendentes" });
      irPara("usadas");
    }
  },
  "painel-excesso": () => {
    Object.assign(UI.es, { regiao: "", status: "acima", busca: "", bases: false });
    irPara("estoque");
  },
  tema: () => Tema.alternar(),
  ir: (el) => irPara(el.dataset.pagina),
  recarregar: () => E.status === "erro" ? location.reload() : carregarTudo(),
  sair: () => sairDoFirebase(),
  "verificar-email": async el => { el.disabled=true; try { await Acesso.auth.currentUser.sendEmailVerification();toast('Confira a caixa de entrada e confirme seu e-mail.'); } catch(e) {toast('Não foi possível enviar agora. Aguarde e tente novamente.','erro');el.disabled=false;} },
  "salvar-config-firebase": () => {
    const campo = document.getElementById("config-firebase");
    const cfg = lerTextoConfig(campo && campo.value);
    if (!cfg) { toast("Não encontrei apiKey e projectId no texto colado. Copie o bloco firebaseConfig inteiro.", "erro"); return; }
    if (!salvarConfigLocal(cfg)) { toast("Este navegador não deixou guardar a configuração.", "erro"); return; }
    location.reload();
  },
  "apagar-config-firebase": () => { apagarConfigLocal(); location.reload(); },
  tecnico: (el) => { irPara("tecnicos", { tid: el.dataset.tid }); },
  "voltar-tecnicos": () => irPara("tecnicos"),
  cobrar: (el) => modalCobrar(el.dataset.tid, el.dataset.aba || "cobrar"),
  "inventario-tecnico": el => { UIinventario.tid=el.dataset.tid;UIinventario.tipo='';UIinventario.estado='';UIinventario.busca='';UIinventario.pagina=1;irPara('inventario'); },
  "inventario-atualizar": () => carregarInventario(),
  "inventario-exportar": () => exportarInventario(),
  "novo-usuario": () => modalUsuario(),
  "editar-usuario": el => modalUsuario(el.dataset.email),
  "historico-agenda": el => modalHistoricoAgenda(el.dataset.tid),
  "editar-tecnico": (el) => modalTecnico(el.dataset.tid),
  "editar-prazos": (el) => modalTecnico(el.dataset.tid, true),
  "previsao-tecnico": (el) => {
    const D = derivar();
    const t = D.mapa.get(el.dataset.tid);
    if (!t) return;
    let itens = itensDaAba(t, el.dataset.aba || "cobrar", D.hoje);
    if (!itens.length) itens = t.usadas;
    modalPrevisao(itens, `Previsão de ${t.nome}`);
  },
  "abrir-cob": (el) => { const s = UI.cob.abertos; s.has(el.dataset.tid) ? s.delete(el.dataset.tid) : s.add(el.dataset.tid); renderizar(true); },
  "aba-cob": (el) => { UI.cob.aba = el.dataset.aba; UI.cob.foco = ''; renderizar(true); },
  "regiao-cob": (el) => { UI.cob.regiao = el.dataset.regiao; renderizar(true); },
  "copiar-resumo": () => copiarTexto(resumoTexto()),
  "exportar-cobrancas": () => exportarCobrancas(),
  "filtrar-usadas": (el) => { Object.assign(UI.us, { aba: "pendentes", status: el.dataset.status, faixa: null, pagina: 1 }); irPara("usadas"); },
  "aba-us": (el) => { UI.us.aba = el.dataset.aba; renderizar(true); },
  "status-us": (el) => { UI.us.status = el.dataset.status; UI.us.pagina = 1; renderizar(true); },
  "limpar-faixa": () => { UI.us.faixa = null; renderizar(true); },
  "exportar-usadas": () => exportarUsadas(),
  "lote-previsao": () => modalPrevisao(itensSelecionados()),
  "lote-cobranca": () => {
    const itens = itensSelecionados();
    const porTec = agrupar(itens, (i) => i.tid);
    if (porTec.size !== 1) { toast("Para registrar cobrança, selecione peças de um técnico só.", "info"); return; }
    modalCobrar([...porTec.keys()][0], "selecao", itens);
  },
  "lote-limpar": () => { UI.us.sel.clear(); renderizar(true); },
  pagina: (el) => {
    const alvo = el.dataset.alvo, p = Math.max(1, +el.dataset.p);
    if (alvo === "us") UI.us.pagina = p;
    else if (alvo === "dev") UI.us.paginaDev = p;
    else if (alvo === "ficha") UI.ficha.pagina = p;
    else if (alvo === "consulta") UIconsulta.pagina = p;
    else if (alvo === "inventario") UIinventario.pagina = p;
    else if (alvo === "relatorios") UIrelatorios.pagina = p;
    renderizar(true);
  },
  ordenar: (el) => {
    const mapa = { us: UI.us, es: UI.es, tc: UI.tc };
    const s = mapa[el.dataset.alvo];
    if (!s) return;
    const campo = el.dataset.campo;
    s.ordem = s.ordem.campo === campo ? { campo, dir: s.ordem.dir === "asc" ? "desc" : "asc" } : { campo, dir: ["dias", "novasQtd", "usadas", "atrasadas", "maxDias", "novas", "itens"].includes(campo) ? "desc" : "asc" };
    renderizar(true);
  },
  "status-es": (el) => { UI.es.status = UI.es.status === el.dataset.status && el.dataset.status ? "" : el.dataset.status; UI.es.bases = false; if (UI.pagina !== "estoque") irPara("estoque"); else renderizar(true); },
  "bases-es": (el) => { UI.es.bases = el.dataset.v === "1"; UI.es.status = ""; renderizar(true); },
  "abrir-es": (el) => { const s = UI.es.abertos; s.has(el.dataset.tid) ? s.delete(el.dataset.tid) : s.add(el.dataset.tid); renderizar(true); },
  "exportar-estoque": () => exportarEstoque(),
  "tipo-tc": (el) => { UI.tc.tipo = el.dataset.tipo; renderizar(true); },
  "exportar-tecnicos": () => exportarTecnicos(),
  "aba-ficha": (el) => { UI.ficha.aba = el.dataset.aba; UI.ficha.pagina = 1; renderizar(true); },
  "tentar-importar": () => executarImportacao(),
  "limpar-fila": () => { UI.im.fila = []; renderizar(true); },
  desfazer: async (el) => {
    const imp = E.importacoes.find((i) => i.id === el.dataset.id);
    if (!imp) return;
    const ok = await confirmar({
      titulo: "Desfazer esta importação?",
      texto: `As planilhas de ${fmtDataHora(imp.em)} voltam para a versão anterior e as devoluções registradas nela são apagadas. Previsões e cobranças que você registrou continuam salvas.`,
      ok: "Desfazer importação", perigo: true,
    });
    if (!ok) return;
    try {
      el.disabled = true;
      await desfazerImportacao(imp);
      UI.im.resultado = null;
      toast("Importação desfeita.");
      renderizar(true);
    } catch (e) { toast(erroAmigavel(e).message, "erro"); el.disabled = false; }
  },
  "restaurar-msgs": async () => {
    await salvarConfig({ msgCobranca: PADROES.msgCobranca, msgLembrete: PADROES.msgLembrete });
    toast("Mensagens voltaram ao texto padrão.");
    renderizar(true);
  },
  "exportar-tudo": () => exportarTudo(),
  "preparar-email": el => modalCobrar(el.closest('form').querySelector('[data-email-tecnico]').value, 'cobrar', null, 'email'),
  "alternar-tabela": (el) => { const s = UIpainel.tabelas; s.has(el.dataset.grafico) ? s.delete(el.dataset.grafico) : s.add(el.dataset.grafico); renderizar(true); },
  menu: () => MenuLateral.alternarMovel(),
};

const MUDANCAS = {
  "ranking-regiao": (el) => { UIranking.regiao = el.value; renderizar(true); },
  "consulta-ordem": (el) => { UIconsulta.ordem = el.value; UIconsulta.pagina = 1; renderizar(true); },
  "previsao-item": async (el) => {
    const D = derivar();
    const item = D.itens.find((i) => i.k === el.dataset.k && i.tid === el.dataset.tid);
    if (!item) return;
    try {
      await definirPrevisao([item], el.value || "");
      toast(el.value ? `Previsão ${fmtPrevisao(el.value)} salva.` : "Previsão removida.");
    } catch (e) { toast(erroAmigavel(e).message, "erro"); }
  },
  "obs-item": async (el) => {
    const D = derivar();
    const item = D.itens.find((i) => i.k === el.dataset.k && i.tid === el.dataset.tid);
    if (!item || (item.obs || "") === el.value.trim()) return;
    try { await definirObs(item, el.value.trim()); toast("Observação salva."); } catch (e) { toast(erroAmigavel(e).message, "erro"); }
  },
  "ordem-cob": (el) => { UI.cob.ordem = el.value; renderizar(true); },
  "regiao-us": (el) => { UI.us.regiao = el.value; UI.us.pagina = 1; renderizar(true); },
  "tecnico-us": (el) => { UI.us.tid = el.value; UI.us.pagina = 1; renderizar(true); },
  marcar: (el) => { el.checked ? UI.us.sel.add(el.dataset.k) : UI.us.sel.delete(el.dataset.k); renderizar(true); },
  "marcar-pagina": (el) => {
    document.querySelectorAll('[data-mudar="marcar"]').forEach((c) => { el.checked ? UI.us.sel.add(c.dataset.k) : UI.us.sel.delete(c.dataset.k); });
    renderizar(true);
  },
  "regiao-es": (el) => { UI.es.regiao = el.value; renderizar(true); },
  "inventario-filtro": el => { UIinventario[el.dataset.campo]=el.value;UIinventario.pagina=1;renderizar(true); },
  "localidade-tc": (el) => { UI.tc.localidade = el.value; renderizar(true); },
  "regiao-tc": (el) => { UI.tc.regiao = el.value; renderizar(true); },
  "sem-dados-tc": (el) => { UI.tc.mostrarSemDados = el.checked; renderizar(true); },
  "tipo-tecnico": async (el) => {
    try { await salvarTecnico(el.dataset.tid, { tipo: el.value }); toast(`Tipo alterado para ${TIPOS_TEC[el.value]}.`); } catch (e) { toast(erroAmigavel(e).message, "erro"); }
  },
  "fila-regiao": (el) => { const it = UI.im.fila[+el.dataset.n]; if (it) { it.regiao = el.value; renderizar(true); } },
  "fila-tipo": (el) => { const it = UI.im.fila[+el.dataset.n]; if (it) { it.tipo = el.value; renderizar(true); } },
};

const DIGITACAO = {
  "busca-cob": (v) => { UI.cob.busca = v; },
  "busca-us": (v) => { UI.us.busca = v; UI.us.pagina = 1; },
  "busca-es": (v) => { UI.es.busca = v; },
  "inventario-busca": v => { UIinventario.busca=v;UIinventario.pagina=1; },
  "busca-tc": (v) => { UI.tc.busca = v; },
};
const aplicarBusca = debounce((campo) => {
  const pos = campo.selectionStart;
  const chave = campo.dataset.digitar;
  renderizar(true);
  const novo = document.querySelector(`[data-digitar="${chave}"]`);
  if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (_) {} }
}, 220);

function ligarEventos() {
  document.addEventListener("click", (ev) => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo || alvo.disabled) return;
    const f = ACOES[alvo.dataset.acao];
    if (f) { ev.preventDefault(); Promise.resolve().then(()=>f(alvo, ev)).catch(e=>toast(e.code ? erroAmigavel(e).message : e.message,"erro")); }
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.matches("[data-entrada-arquivos]")) { receberArquivos(el.files).catch(e=>toast(erroAmigavel(e).message,"erro")); el.value = ""; return; }
    const f = el.dataset && MUDANCAS[el.dataset.mudar];
    if (f) Promise.resolve().then(()=>f(el, ev)).catch(e=>toast(e.code ? erroAmigavel(e).message : e.message,"erro"));
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.closest('[data-form="relatorios"]')) {
      UIrelatorios.rascunho = Object.fromEntries(new FormData(el.form));
      el.form.querySelector('[role="alert"]').textContent = '';
      return;
    }
    if (el.dataset.rankingData) {
      UIranking.rascunho = { ...(UIranking.rascunho || UIranking), [el.dataset.rankingData]: el.value };
      el.closest('form').querySelector('[role="alert"]').textContent = '';
      return;
    }
    const f = el.dataset && DIGITACAO[el.dataset.digitar];
    if (f) { f(el.value); aplicarBusca(el); }
  });
  document.addEventListener("submit", (ev) => {
    const form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    if (form.dataset.form === 'consulta') { aplicarConsulta(form); return; }
    if (form.dataset.form === 'relatorios') { aplicarFiltrosRelatorio(form); return; }
    if (form.dataset.form === 'ranking-intervalo') { aplicarIntervaloRanking(form); return; }
    salvarFormulario(form).catch((e) => toast(erroAmigavel(e).message, "erro"));
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const a = document.activeElement;
      const conteudo = document.getElementById("conteudo");
      if (renderPendente && !(a && conteudo && conteudo.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) renderizar();
    }, 50);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && !document.querySelector('.principal').inert && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector(".modal-fundo")) {
      const busca = document.querySelector("#conteudo .busca-campo input");
      if (busca) { ev.preventDefault(); busca.focus(); }
    }
  });

  // arrastar e soltar em qualquer lugar da página
  let profundidade = 0;
  const camada = document.getElementById("soltar");
  const temArquivos = (ev) => ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes("Files");
  window.addEventListener("dragenter", (ev) => { if (!temArquivos(ev)) return; profundidade++; camada.hidden = false; });
  window.addEventListener("dragleave", () => { profundidade = Math.max(0, profundidade - 1); if (!profundidade) camada.hidden = true; });
  window.addEventListener("dragover", (ev) => { if (temArquivos(ev)) ev.preventDefault(); });
  window.addEventListener("drop", (ev) => {
    if (!temArquivos(ev)) return;
    ev.preventDefault();
    profundidade = 0;
    camada.hidden = true;
    receberArquivos(ev.dataTransfer.files).catch(e=>toast(erroAmigavel(e).message,"erro"));
  });

  // gráficos acompanham a largura do cartão
  let largura = 0;
  const redesenhar = debounce(() => {
    const w = document.getElementById("conteudo").clientWidth;
    if (Math.abs(w - largura) < 4) return;
    largura = w;
    const p = PAGINAS[UI.pagina];
    if (p.depois && E.status === "pronto") p.depois();
  }, 120);
  if (window.ResizeObserver) new ResizeObserver(redesenhar).observe(document.getElementById("conteudo"));
  else window.addEventListener("resize", redesenhar);

  // virada do dia com a página aberta: recalcula os prazos
  let dia = hojeISO();
  setInterval(() => { if (hojeISO() !== dia) { dia = hojeISO(); mudou(); } }, 60000);
}

function montarMoldura() {
  document.getElementById("nav").innerHTML = Object.entries(PAGINAS).filter(([,p])=>!p.admin || podeAdministrar()).map(([id, p]) =>
    `${id === "painel" ? '<span class="nav-grupo">Monitoramento</span>' : id === "estoque" ? '<span class="nav-grupo">Recursos</span>' : id === "importar" ? '<span class="nav-grupo">Administração</span>' : ""}<a href="#${id}" data-nav="${id}" data-acao="ir" data-pagina="${id}">${icone(p.icone)}<span>${esc(p.nav || p.titulo)}</span>${id === "cobrancas" ? `<b class="nav-contador" id="contador-cobrancas" hidden></b>` : ""}</a>`
  ).join("");
}

async function iniciar() {
  MenuLateral.iniciar();
  Camadas.iniciar();
  RolagemHorizontal.iniciar();
  montarMoldura();
  ligarEventos();
  Notificacoes.iniciar();
  aoMudar.add(debounce(() => renderizar(), 40));
  const inicial = (location.hash || "").replace("#", "");
  if (PAGINAS[inicial]) UI.pagina = inicial;
  renderizar(true);
  try { await Armazem.iniciar(); }
  catch (e) { E.status = 'erro'; E.erro = 'Não foi possível conectar com segurança. Confira a conexão e tente novamente.'; mudou(); return; }
  montarMoldura();
  if (Acesso.modo === 'firebase' && !Acesso.perfil) { bloquearSessao(Acesso.negado); return; }
  if (Acesso.modo === "firebase" && Acesso.usuario) {
    E.usuario.id = Acesso.usuario.uid;
    E.usuario.email = Acesso.usuario.email;
  } else {
    try {
      const u = window.claude && window.claude.use ? await window.claude.use("user") : null;
      if (u) {
        E.usuario.id = await u.id();
        E.usuario.podeEscrever = await u.can("data.write");
      }
    } catch (_) { /* sem identidade: segue sem */ }
  }
  await carregarTudo();
  if (!E.usadas.length && !E.novas.length && UI.pagina === "painel") renderizar(true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
