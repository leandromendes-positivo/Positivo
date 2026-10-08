/* ==========================================================================
   Página: Técnicos (cadastro) e ficha individual do técnico.
   ========================================================================== */

function filtrarTecnicos(D, s = UI.tc) {
  const busca = normBusca(s.busca);
  return D.tecnicos.filter(t => t.tipo === s.tipo && (s.tipo === 'ignorar' || t.temDados || s.mostrarSemDados)
    && (!s.localidade || (s.localidade === 'nao-informado' ? !t.localidade : t.localidade === s.localidade))
    && (!s.regiao || t.regiao === s.regiao)
    && (!busca || normBusca(`${t.nome} ${t.nomeOriginal} ${t.telefone} ${t.email}`).includes(busca)));
}

function renderTecnicos() {
  if (UI.tid) return renderFicha(UI.tid);
  const D = derivar();
  const s = UI.tc;
  const contar = (tipo) => D.tecnicos.filter((t) => t.tipo === tipo && (tipo === "ignorar" || t.temDados)).length;
  let lista = filtrarTecnicos(D, s);
  lista = ordenarLista(lista, s.ordem, {
    nome: (t) => t.nome, usadas: (t) => t.nUsadas, atrasadas: (t) => t.nAtrasadas, maxDias: (t) => t.maxDias,
    novas: (t) => t.novasQtd, media: (t) => t.mediaDiasDev,
  });
  const semDados = D.tecnicos.filter((t) => t.tipo === s.tipo && !t.temDados).length;
  const numericos = D.tecnicos.filter((t) => t.tipo === "base" && /^\d+$/.test(t.cad.chave || "")).length;
  const semWhats = D.tecnicos.filter((t) => t.tipo === "tecnico" && t.temDados && !t.telefone).length;

  return `
    ${numericos && s.tipo !== "ignorar" ? `<div class="faixa info compacta">${icone("info")}<div><strong>${plural(numericos, "identificador numérico foi classificado", "identificadores numéricos foram classificados")} como base/depósito</strong><span>Nos relatórios, códigos como 110301019 costumam ser estoques, não pessoas. Se algum for um técnico, troque o tipo na lista "Bases e depósitos" e dê um nome a ele.</span></div></div>` : ""}
    ${semWhats && s.tipo === "tecnico" ? `<div class="faixa neutra compacta">${icone("telefone")}<div><strong>${plural(semWhats, "técnico está", "técnicos estão")} sem WhatsApp cadastrado</strong><span>Com o número salvo, o botão Cobrar abre a conversa já com a mensagem pronta.</span></div></div>` : ""}
    <div class="barra-filtros">
      <select data-mudar="localidade-tc" aria-label="Localidade dos técnicos"><option value="">Capital e interior</option>${[['capital','Capital'],['interior','Interior'],['nao-informado','Não informado']].map(([v,n])=>`<option value="${v}" ${s.localidade===v?'selected':''}>${n}</option>`).join('')}</select>
      <div class="chips">
        <button class="chip${s.tipo === "tecnico" ? " ativo" : ""}" data-acao="tipo-tc" data-tipo="tecnico">Técnicos <span>${contar("tecnico")}</span></button>
        <button class="chip${s.tipo === "base" ? " ativo" : ""}" data-acao="tipo-tc" data-tipo="base">Bases e depósitos <span>${contar("base")}</span></button>
        <button class="chip${s.tipo === "ignorar" ? " ativo" : ""}" data-acao="tipo-tc" data-tipo="ignorar">Ignorados <span>${contar("ignorar")}</span></button>
      </div>
      <select data-mudar="regiao-tc" aria-label="Região"><option value="">Todas as regiões</option>${D.regioes.map((r) => `<option value="${esc(r)}"${s.regiao === r ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <label class="busca-campo">${icone("busca")}<input type="search" placeholder="Buscar nome, telefone ou e-mail" value="${esc(s.busca)}" data-digitar="busca-tc" aria-label="Buscar"></label>
      ${semDados && s.tipo !== "ignorar" ? `<label class="check-inline"><input type="checkbox" data-mudar="sem-dados-tc" ${s.mostrarSemDados ? "checked" : ""}> Mostrar ${plural(semDados, "sem peças", "sem peças")} hoje</label>` : ""}
      <button class="btn" data-acao="exportar-tecnicos">${icone("baixar")}Exportar</button>
    </div>
    ${lista.length ? `<div class="tabela-rolagem"><table class="tabela">
      <thead><tr>
        ${thOrdenavel("Nome", "nome", s.ordem, "tc")}
        <th>UF</th><th>Tipo</th><th>WhatsApp</th>
        ${thOrdenavel("Usadas", "usadas", s.ordem, "tc", "num")}
        ${thOrdenavel("Atrasadas", "atrasadas", s.ordem, "tc", "num")}
        ${thOrdenavel("Mais antiga", "maxDias", s.ordem, "tc", "num")}
        ${thOrdenavel("Novas", "novas", s.ordem, "tc", "num")}
        <th class="num">Limite máximo</th>
        <th>Prazos de devolução</th>
        ${thOrdenavel("Devolução média", "media", s.ordem, "tc", "num")}
        <th></th>
      </tr></thead>
      <tbody>${lista.map((t) => `<tr>
        <td><span class="celula-tec">${avatar(t.nome, t.tipo)}<span><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button>${t.cad.apelido ? `<small class="sub-celula">${esc(t.nomeOriginal)}</small>` : ""}</span></span></td>
        <td>${regiaoTag(t.regiao)}<small class="sub-celula">${LOCALIDADES[t.localidade] || LOCALIDADES[""]}</small></td>
        <td><select class="select-pequeno" data-mudar="tipo-tecnico" data-tid="${esc(t.tid)}" aria-label="Tipo">${Object.entries(TIPOS_TEC).map(([v, r]) => `<option value="${v}"${t.tipo === v ? " selected" : ""}>${r}</option>`).join("")}</select></td>
        <td>${t.telefone ? `<span class="mono nowrap">${esc(fmtTelefone(t.telefone))}</span>` : `<button class="link" data-acao="editar-tecnico" data-tid="${esc(t.tid)}">Cadastrar</button>`}</td>
        <td class="num">${fmtNum(t.nUsadas)}</td>
        <td class="num ${t.nAtrasadas ? "txt-crit" : ""}">${fmtNum(t.nAtrasadas)}</td>
        <td class="num">${t.usadas.length ? `${t.maxDias} d` : "—"}</td>
        <td class="num">${t.estoqueConhecido ? fmtNum(t.novasQtd) : "—"}</td>
        <td class="num">${t.tipo === "tecnico" ? t.meta || "Sem limite" : "—"}</td>
        <td><button class="botao-prazos" data-acao="editar-prazos" data-tid="${esc(t.tid)}" aria-label="Personalizar prazos de ${esc(t.nome)}"><span>Usadas <strong>${t.prazo} dias</strong>${prazoValido(t.cad.prazoUsadas) !== null ? '<small>próprio</small>' : ''}</span><span>Novas <strong>${t.prazoNovas} dias</strong>${prazoValido(t.cad.prazoNovas) !== null ? '<small>próprio</small>' : ''}</span></button></td>
        <td class="num">${t.mediaDiasDev != null ? `${fmtNum1(t.mediaDiasDev)} d` : "—"}</td>
        <td><button class="btn-icone" data-acao="editar-tecnico" data-tid="${esc(t.tid)}" aria-label="Editar ${esc(t.nome)}" title="Editar cadastro">${icone("lapis")}</button></td>
      </tr>`).join("")}</tbody></table></div>` : vazio("pessoas", "Ninguém nesta lista", s.tipo === "ignorar" ? "Técnicos marcados como ignorados somem de todas as contas. Use para quem saiu da empresa ou não deve ser acompanhado." : "Mude os filtros acima.")}`;
}

// ------------------------------------------------------------------ ficha
function renderFicha(tid) {
  const D = derivar();
  const t = D.mapa.get(tid);
  if (!t) {
    const c = E.cadastro[tid];
    if (c && c.tipo === "ignorar") return `<button class="voltar" data-acao="voltar-tecnicos">${icone("retorno")}Técnicos</button>${vazio("pessoa", "Técnico ignorado", "Este técnico está marcado como ignorado e não entra nas contas.", `<button class="btn" data-acao="editar-tecnico" data-tid="${esc(tid)}">Editar cadastro</button>`)}`;
    return `<button class="voltar" data-acao="voltar-tecnicos">${icone("retorno")}Técnicos</button>${vazio("pessoa", "Técnico não encontrado", "Ele pode ter saído dos relatórios.")}`;
  }
  const s = UI.ficha;
  if (s.tid !== tid) Object.assign(s, { tid, aba: t.usadas.length ? "usadas" : "novas", pagina: 1 });
  const cobrancas = ((E.acomp[tid] && E.acomp[tid].cobrancas) || []).slice().reverse();
  const devs = E.devolucoes.filter((d) => d.tid === tid).sort((a, b) => comparar(b.em, a.em));

  const kpis = `<div class="kpis kpis-6">
    ${kpi({ rotulo: "Usadas pendentes", valor: fmtNum(t.nUsadas), sub: t.nVencendo ? `${fmtNum(t.nVencendo)} vencem em breve` : "&nbsp;" })}
    ${kpi({ rotulo: `Atrasadas (+${t.prazo} dias)`, valor: fmtNum(t.nAtrasadas), classe: t.nAtrasadas ? "crit" : "", sub: t.nAguardando ? `${fmtNum(t.nAguardando)} com previsão` : "&nbsp;" })}
    ${kpi({ rotulo: "Peça mais antiga", valor: t.usadas.length ? `${t.maxDias} <small>dias</small>` : "—", sub: t.usadas.length ? `desde ${fmtData(t.usadas[0].dataFT)}` : "&nbsp;" })}
    ${kpi({ rotulo: "Peças novas", valor: t.estoqueConhecido ? fmtNum(t.novasQtd) : "—", classe: t.statusNovas === "acima" ? "grave" : "", sub: t.tipo === "tecnico" ? `${t.meta ? `limite ${t.meta} · ` : ""}${STATUS_NOVAS[t.statusNovas].rotulo.toLowerCase()}` : "base / depósito" })}
    ${kpi({ rotulo: "Tempo médio de devolução", valor: t.mediaDiasDev != null ? `${fmtNum1(t.mediaDiasDev)} <small>dias</small>` : "—", sub: "últimos 90 dias" })}
    ${kpi({ rotulo: "Devolvidas no prazo", valor: t.noPrazoDev != null ? fmtPct(t.noPrazoDev) : "—", sub: t.devolvidas90 ? `${plural(t.devolvidas90, "peça", "peças")} em 90 dias` : "sem devoluções ainda" })}
  </div>`;

  const abas = [
    ["usadas", `Peças usadas`, t.usadas.length],
    ["novas", "Estoque de novas", t.novasLinhas.length],
    ["cobrancas", "Cobranças", cobrancas.length],
    ["devolvidas", "Devolvidas", devs.length],
  ];
  let corpo = "";
  if (s.aba === "usadas") corpo = tabelaUsadasFicha(t, D);
  else if (s.aba === "novas") corpo = `${t.tipo === "tecnico" ? `<div class="linha-medidor">${medidorEstoque(t)}${pillNovas(t)}<span class="nota">${t.meta ? `Limite máximo: ${t.meta} peças${t.metaPropria != null ? " (personalizado)" : ""} · estoque menor está dentro do limite` : "Sem limite configurado"}</span></div>` : ""}<div class="tabela-rolagem">${tabelaLinhasNovas(t)}</div>`;
  else if (s.aba === "cobrancas") corpo = cobrancas.length ? `<ol class="linha-tempo">${cobrancas.map((c) => `<li>
      <span class="lt-quando">${fmtDataHora(c.em)}</span>
      <div><strong>${esc(CANAIS[c.canal] || c.canal)}</strong><small class="sub-celula">${esc(c.email ? primeiroNomeEmail(c.email) : "Sem autoria registrada")}</small> · ${plural(c.pecas || 0, "peça", "peças")}${c.previsao ? ` · previsão para ${fmtData(c.previsao)}` : ""}${c.obs ? `<p></p>` : ""}</div>
    </li>`).join("")}</ol>` : vazio("mensagem", "Nenhuma cobrança registrada", "Use o botão Cobrar para enviar a mensagem e registrar.");
  else corpo = devs.length ? `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Chamado</th><th>Material</th><th>Data FT</th><th>Saiu do relatório</th><th class="num">Dias</th><th>Prazo</th></tr></thead><tbody>
      ${devs.slice(0, 200).map((d) => `<tr><td class="mono">${esc(d.chamado || "—")}</td><td><span class="mat"><span class="mono">${esc(d.mat)}</span>${esc(E.catalogo[d.mat] || "")}</span></td><td class="mono">${fmtData(d.dataFT)}</td><td>${fmtDataHora(d.em)}</td><td class="num"><strong>${d.dias}</strong></td><td>${d.dias <= prazoDaDevolucao(d) ? pill("ok", "No prazo", "ok") : pill("grave", "Atrasada", "relogio")}</td></tr>`).join("")}
    </tbody></table></div>` : vazio("retorno", "Nenhuma devolução registrada", "As peças que saírem do relatório de usadas aparecem aqui.");

  const html = `
    <button class="voltar" data-acao="voltar-tecnicos">${icone("retorno")}Técnicos</button>
    <section class="ficha-topo">
      ${avatar(t.nome, t.tipo)}
      <div class="ficha-id">
        <h2>${esc(t.nome)}</h2>
        <p>${regiaoTag(t.regiao)} <span>${esc(TIPOS_TEC[t.tipo])}</span>${t.cad.apelido ? ` · <span class="mono">${esc(t.nomeOriginal)}</span>` : ""}${t.telefone ? ` · <span class="mono">${esc(fmtTelefone(t.telefone))}</span>` : ""}${t.email ? ` · ${esc(t.email)}` : ""}</p>
        ${t.obs ? `<p class="ficha-obs"></p>` : ""}
      </div>
      <div class="ficha-acoes"><button class="btn" data-acao="inventario-tecnico" data-tid="${esc(t.tid)}">${icone("caixa")}Histórico de peças</button><button class="btn" data-acao="historico-agenda" data-tid="${esc(t.tid)}">${icone("calendario")}Histórico de agendamentos</button>
        ${t.usadas.length ? `<button class="btn prim" data-acao="cobrar" data-tid="${esc(t.tid)}" data-aba="${t.itensCobrar.length ? "cobrar" : "todos"}">${icone("mensagem")}Cobrar</button>` : ""}
        <button class="btn" data-acao="editar-tecnico" data-tid="${esc(t.tid)}">${icone("lapis")}Editar cadastro</button>
      </div>
      ${imagemCabecalho()}
    </section>
    <section class="ficha-prazos" aria-label="Prazos de devolução do técnico">${icone('relogio')}<div><h3>Prazos de devolução</h3><p>${LOCALIDADES[t.localidade] || LOCALIDADES[""]} · A regra pessoal prevalece sobre a geral.</p></div><dl>${[['usadas','Usadas',t.prazo,t.cad.prazoUsadas],['novas','Novas',t.prazoNovas,t.cad.prazoNovas]].map(([tipo,nome,dias,proprio]) => `<div><dt>${nome}</dt><dd>${dias} dias <small>${prazoValido(proprio) !== null ? 'Personalizado' : 'Regra geral'}</small></dd></div>`).join('')}</dl><button class="btn pequeno" data-acao="editar-prazos" data-tid="${esc(t.tid)}">${icone('ajustes')}Alterar prazos</button></section>
    ${kpis}
    <div class="abas" role="tablist">${abas.map(([id, rot, n]) => `<button role="tab" class="aba${s.aba === id ? " ativa" : ""}" data-acao="aba-ficha" data-aba="${id}">${rot}<span class="contador">${fmtNum(n)}</span></button>`).join("")}</div>
    <div class="ficha-corpo">${corpo}</div>`;
  // textos livres entram por textContent depois da renderização
  UI.posRender = () => {
    const obs = document.querySelector(".ficha-obs");
    if (obs) obs.textContent = t.obs;
    document.querySelectorAll(".linha-tempo li").forEach((li, i) => {
      const p = li.querySelector("p");
      if (p) p.textContent = cobrancas[i].obs;
    });
  };
  return html;
}

function tabelaUsadasFicha(t, D) {
  if (!t.usadas.length) return vazio("ok", "Nenhuma peça usada pendente", "Este técnico não tem peças usadas no último relatório.");
  const s = UI.ficha;
  const lista = t.usadas;
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (s.pagina > paginas) s.pagina = paginas;
  const pagina = lista.slice((s.pagina - 1) * POR_PAGINA, s.pagina * POR_PAGINA);
  return `<div class="barra-filtros"><span class="nota">${plural(lista.length, "linha", "linhas")}, da mais antiga para a mais nova.</span>
    <button class="btn pequeno" data-acao="previsao-tecnico" data-tid="${esc(t.tid)}" data-aba="todos">${icone("calendario")}Previsão para todas</button></div>
    <div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>Chamado</th><th>Material</th><th>Data FT</th><th class="num">Dias</th><th>Situação</th><th>Previsão</th><th>Observação</th></tr></thead>
    <tbody>${pagina.map((i) => `<tr>
      <td class="mono">${esc(i.chamado || "—")}</td>
      <td><span class="mat"><span class="mono">${esc(i.mat)}</span>${esc(i.desc)}</span></td>
      <td class="mono nowrap">${fmtData(i.dataFT)}</td>
      <td class="num"><strong>${i.dias}</strong></td>
      <td>${pillStatus(i, D.cfg)}</td>
      <td>${campoPrevisao(i)}</td>
      <td><input type="text" class="campo-obs" value="${esc(i.obs)}" placeholder="Anotar…" maxlength="300" data-mudar="obs-item" data-tid="${esc(i.tid)}" data-k="${esc(i.k)}" aria-label="Observação"></td>
    </tr>`).join("")}</tbody></table></div>
    ${paginacao(lista.length, s.pagina, POR_PAGINA, "ficha")}`;
}

async function exportarTecnicos() {
  const D = derivar();
  await exportarExcel(`tecnicos-${D.hoje}.xlsx`, [{
    nome: "Técnicos",
    colunas: [{ titulo: "Nome", largura: 30 }, { titulo: "Nome no relatório", largura: 30 }, { titulo: "Tipo", largura: 14 }, { titulo: "UF", largura: 5 },
      { titulo: "WhatsApp", largura: 16 }, { titulo: "E-mail", largura: 26 }, { titulo: "Usadas pendentes", largura: 10, tipo: "numero" },
      { titulo: "Atrasadas", largura: 10, tipo: "numero" }, { titulo: "Dias da mais antiga", largura: 10, tipo: "numero" }, { titulo: "Peças novas", largura: 10, tipo: "numero" },
      { titulo: "Limite máximo", largura: 16, tipo: "numero" }, { titulo: "Situação do estoque", largura: 16 }, { titulo: "Devolução média (dias)", largura: 10, tipo: "numero" }, { titulo: "Observação", largura: 30 }, { titulo: "Prazo usadas (dias)", largura: 18, tipo: "numero" }, { titulo: "Regra usadas", largura: 16 }, { titulo: "Prazo novas (dias)", largura: 18, tipo: "numero" }, { titulo: "Regra novas", largura: 16 }, { titulo: "Capital / interior", largura: 18 }],
    linhas: D.tecnicos.filter((t) => t.temDados || t.estoqueConhecido || t.tipo === "ignorar").map((t) => [t.nome, t.nomeOriginal, TIPOS_TEC[t.tipo], t.regiao, fmtTelefone(t.telefone), t.email, t.nUsadas, t.nAtrasadas, t.maxDias, t.estoqueConhecido ? t.novasQtd : "", t.tipo === "tecnico" && t.meta ? t.meta : "", t.tipo === "tecnico" ? STATUS_NOVAS[t.statusNovas].rotulo : "", t.mediaDiasDev != null ? Math.round(t.mediaDiasDev * 10) / 10 : "", t.obs, t.prazo, prazoValido(t.cad.prazoUsadas) !== null ? "Personalizado" : "Geral", t.prazoNovas, prazoValido(t.cad.prazoNovas) !== null ? "Personalizado" : "Geral", LOCALIDADES[t.localidade] || LOCALIDADES[""]]),
  }]);
}
