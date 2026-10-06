/* Indicadores de gestão: quantidades do relatório, nunca projeções simuladas. */
function indicadoresOperacionais(D) {
  const k = D.kpi;
  const estoque = estoqueConhecidoPainel(D);
  const prazo = Number(D.cfg.prazo);
  return {
    noPrazo: k.usadas ? (k.usadas - k.atrasadas) / k.usadas : null,
    idadeMedia: k.usadas ? somar(D.itens, (i) => i.dias * i.qtd) / k.usadas : null,
    criticas: somar(D.itens.filter((i) => i.dias > prazo * 2), (i) => i.qtd),
    semContatoHoje: D.cobrarTec.filter((t) => !t.ultimaCobranca || t.ultimaCobranca.em.slice(0, 10) !== D.hoje).length,
    agendadas: somar(D.itens.filter((i) => i.previsao && i.previsao >= D.hoje), (i) => i.qtd),
    reposicao: somar(estoque.abaixo, (t) => Math.max(0, t.meta - t.novasQtd)),
    excesso: somar(estoque.tecnicos.filter((t) => t.statusNovas === "acima"), (t) => Math.max(0, t.novasQtd - t.meta)),
    estoque,
  };
}

function kpiOperacional({ tipo, rotulo, valor, sub, rodape, acao, icone: ic }) {
  return `<button type="button" class="kpi kpi-operacional kpi-${tipo}" ${acao}>
    <span class="kpi-arte" aria-hidden="true"></span><span class="kpi-reflexo" aria-hidden="true"></span>
    <span class="kpi-rotulo"><span class="kpi-icone">${icone(ic)}</span>${esc(rotulo)}</span>
    <span class="kpi-valor">${valor}</span><span class="kpi-sub">${sub}</span>
    <span class="kpi-rodape">${rodape}<span class="kpi-abrir" aria-hidden="true">${icone("seta")}</span></span>
  </button>`;
}

function leituraOperacional(D) {
  const fs = D.frescor, atuais = fs.filter((f) => f.em && f.dias === 0).length;
  const ultima = fs.filter((f) => f.em).map((f) => f.em).sort().at(-1);
  return `<div class="leitura-operacional"><span>${icone("arquivo")}<strong>Posição dos relatórios</strong>${ultima ? `Atualizada ${fmtQuando(ultima)}` : "Aguardando primeira importação"}</span><button data-acao="ir" data-pagina="importar" class="leitura-status ${fs.length && atuais === fs.length ? "completa" : "incompleta"}"><i></i>${atuais}/${fs.length} planilhas de hoje${icone("direita")}</button></div>`;
}

function faixaGestao(D) {
  const a = indicadoresOperacionais(D);
  const itens = [
    ["Dentro do prazo", a.noPrazo == null ? "—" : fmtPct(a.noPrazo), `Até ${D.cfg.prazo} dias · peças pendentes`, "ok"],
    ["Idade média das pendências", a.idadeMedia == null ? "—" : `${fmtNum1(a.idadeMedia)} <small>dias</small>`, "Ponderada pela quantidade de peças", "azul"],
    ["Atraso crítico", fmtNum(a.criticas), `Peças há mais de ${Number(D.cfg.prazo) * 2} dias`, "crit"],
    ["Devolvidas em 7 dias", D.kpi.temHistoricoDev ? fmtNum(D.kpi.devolvidas7) : "—", "Confirmadas em nova importação", "ok"],
  ];
  return `<section class="faixa-gestao" aria-label="Indicadores de prazo e devolução">${itens.map(([nome, valor, ajuda, tom]) => `<div class="gestao-item ${tom}"><span>${nome}</span><strong>${valor}</strong><small>${ajuda}</small></div>`).join("")}</section>`;
}

function barraPrioridade(D) {
  const a = indicadoresOperacionais(D);
  return `<section class="barra-prioridade"><span class="prioridade-sinal">${icone("sino")}</span><div><strong>${a.semContatoHoje ? `${plural(a.semContatoHoje, "técnico ainda sem contato", "técnicos ainda sem contato")} hoje` : D.kpi.cobrarTecnicos ? "Todos da fila já foram contatados hoje" : "Nenhum técnico para cobrar agora"}</strong><span>${plural(D.kpi.prevVencida, "peça com previsão vencida", "peças com previsão vencida")} · ${plural(D.kpi.cobrarPecas, "peça na fila de cobrança", "peças na fila de cobrança")}</span></div><button class="btn prim" data-acao="painel-cobrancas" data-aba="cobrar">Abrir fila de cobrança ${icone("seta")}</button></section>`;
}

function cabecalhoSecao(pagina, D) {
  if (pagina === "painel" || (pagina === "tecnicos" && UI.tid)) return "";
  const a = indicadoresOperacionais(D), k = D.kpi;
  const tecs = D.tecnicos.filter((t) => t.tipo === "tecnico" && t.temDados);
  const textos = {
    cobrancas: ["Acompanhamento de devoluções", "Registre cada contato e acompanhe as datas combinadas.", [["Na fila", fmtNum(k.cobrarTecnicos), "técnicos"], ["Sem contato hoje", fmtNum(a.semContatoHoje), "na fila atual"], ["Previsões vencidas", fmtNum(k.prevVencida), "peças"]]],
    usadas: ["Rastreabilidade das peças", "Consulte chamados, idade, previsões e histórico de devoluções.", [["Em aberto", fmtNum(k.usadas), "peças"], ["Acima do prazo", fmtNum(k.atrasadas), `mais de ${D.cfg.prazo} dias`], ["Idade média", a.idadeMedia == null ? "—" : fmtNum1(a.idadeMedia), "dias por peça"]]],
    estoque: ["Distribuição de estoque", "Compare o saldo de cada técnico com a meta e planeje a reposição.", [["Reposição até a meta", a.estoque.temRelatorio ? fmtNum(a.reposicao) : "—", "peças necessárias"], ["Excesso até a meta", a.estoque.temRelatorio ? fmtNum(a.excesso) : "—", "peças para redistribuir"]]],
    tecnicos: ["Equipe em campo", "Cadastro, contatos e desempenho de cada técnico em um só lugar.", [["Em operação", fmtNum(tecs.length), "técnicos com dados"], ["Com pendências", fmtNum(tecs.filter((t) => t.nCobrar).length), "técnicos a cobrar"], ["Sem WhatsApp", fmtNum(tecs.filter((t) => !t.telefone).length), "cadastros a completar"]]],
    importar: ["Atualização da operação", "Envie os relatórios de novas e usadas. O sistema identifica as mudanças.", [["Arquivos do dia", fmtNum(D.frescor.filter((f) => f.em && f.dias === 0).length), `de ${D.frescor.length} acompanhados`], ["Importações", fmtNum(E.importacoes.filter((i) => !i.desfeito).length), "no histórico"]]],
    config: ["Parâmetros da operação", "Defina prazos, metas e mensagens utilizados no acompanhamento.", [["Prazo de devolução", fmtNum(D.cfg.prazo), "dias"], ["Meta de novas", fmtNum(D.cfg.meta), "peças por técnico"], ["Tolerância", `± ${fmtNum(D.cfg.tolerancia)}`, "peças"]]],
  };
  const [titulo, texto, dados] = textos[pagina] || [];
  if (!titulo) return "";
  return `<section class="secao-resumo"><div class="secao-apresentacao"><span class="secao-marcador">${icone(PAGINAS[pagina].icone)}</span><div><h2>${titulo}</h2><p>${texto}</p></div></div><dl>${dados.map(([nome, n, unidade]) => `<div><dt>${nome}</dt><dd>${n}</dd><small>${unidade}</small></div>`).join("")}</dl></section>`;
}
