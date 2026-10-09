/* ==========================================================================
   Página: Cobranças — a lista de trabalho do dia, um cartão por técnico.
   ========================================================================== */

const ABAS_COB = [
  { id: "respostas", rotulo: "Respostas e confirmações", dica: "Acompanhe o e-mail de resposta e as peças combinadas em cada previsão" },
  { id: "cobrar", rotulo: "Cobrar hoje", dica: "Peças acima do prazo do técnico sem previsão, ou com a previsão vencida" },
  { id: "vencidas", rotulo: "Previsões vencidas", dica: "O técnico informou uma data de devolução que já passou e a peça continua no relatório" },
  { id: "vencendo", rotulo: "Vencem em breve", dica: "Peças próximas do prazo de cada técnico: dá para lembrar antes de atrasar" },
  { id: "aguardando", rotulo: "Com previsão", dica: "Peças atrasadas com previsão de devolução informada pelo técnico" },
  { id: "previsoes", rotulo: "Previsões de hoje", dica: "Técnicos que prometeram devolver hoje: confira na próxima importação" },
  { id: "sem_previsao", rotulo: "Sem previsão", dica: "Quantidades ainda sem data confirmada de devolução" },
  { id: "todos", rotulo: "Todos com pendência", dica: "Todos os técnicos com peças do tipo selecionado no relatório" },
];

function itensDaAba(t, aba, hoje, tipo = 'usadas', somenteMeus = false) {
  return selecionarAbaCobranca(pecasCobranca(t,tipo),aba,hoje).filter(i => !somenteMeus || registroDoUsuario(i.agendadoPor));
}

function cartaoCobranca(t, aba, D) {
  const tipo=UI.cob.tipo||'usadas', itens = itensDaAba(t, aba, D.hoje, tipo, UI.cob.somenteMeus);
  const qtd = somar(itens, (i) => i.qtd);
  const aberto = UI.cob.abertos.has(t.tid);
  const uc = E.contatos.filter(c=>c.tid===t.tid&&itens.some(i=>contatoInclui(c,i))).sort(compararContatos)[0] || (tipo==='usadas'?t.ultimaCobranca:null);
  const maxDias = itens.length ? Math.max(...itens.map((i) => i.dias)) : 0;
  const prevVencidas=somar(itens.filter(i=>i.previsao&&i.previsao<D.hoje),i=>i.qtdPrevista), proxima=itens.map(i=>i.previsao).filter(p=>p&&p>=D.hoje).sort()[0];
  const totalTipo=somar(pecasCobranca(t,tipo),i=>i.qtd),prazo=tipo==='novas'?t.prazoNovas:t.prazo;
  const sev = prevVencidas ? 'crit' : aba==='cobrar' ? 'grave' : aba==='vencendo' ? 'alerta' : 'ok';
  const rotuloQtd = { cobrar: "para cobrar", vencidas: "com previsão vencida", vencendo: "vencem em breve", aguardando: "com previsão", previsoes: "previstas p/ hoje", sem_previsao: "sem previsão", todos: "pendentes" }[aba];
  const infos = [pill('neutro', tipo==='todas'?`Prazos: usadas ${t.prazo} d · novas ${t.prazoNovas} d`:`Prazo: ${prazo} dias`, 'relogio')];
  if (prevVencidas) infos.push(pill("crit", `${plural(prevVencidas, "peça", "peças")} com previsão vencida`, "quebra"));
  if (proxima) infos.push(pill("info", `Próxima previsão: ${fmtPrevisao(proxima)}`, "calendario"));
  else if (aba === "cobrar" && !prevVencidas) infos.push(pill("alerta", "Sem previsão", "calendario"));
  infos.push(uc
    ? pill("neutro", `Última cobrança ${fmtQuando(uc.em)} · ${CANAIS[uc.canal] || uc.canal}`, "mensagem")
    : pill("neutro", "Ainda não cobrado", "mensagem"));
  if (t.tipo === "base") infos.push(pill("neutro", "Base / depósito", "base"));
  if (aba !== "todos" && totalTipo > qtd) infos.push(`<span class="nota">${fmtNum(totalTipo)} pendentes no total</span>`);

  const linhas = itens.slice(0, 25);
  return `<article class="cob sev-${sev}" data-tid="${esc(t.tid)}">
    <div class="cob-cab">
      ${avatar(t.nome, t.tipo)}
      <div class="cob-id">
        <h3><button class="link-forte" data-acao="tecnico" data-tid="${esc(t.tid)}">${esc(t.nome)}</button></h3>
        <div class="cob-meta">${regiaoTag(t.regiao)}${t.telefone ? `<span class="mono">${esc(fmtTelefone(t.telefone))}</span>` : `<button class="link" data-acao="editar-tecnico" data-tid="${esc(t.tid)}">${icone("telefone")}cadastrar WhatsApp</button>`}</div>
      </div>
      <div class="cob-numeros">
        <div><strong>${fmtNum(qtd)}</strong><span>${palavra(qtd, "peça", "peças")} ${rotuloQtd}</span></div>
        <div><strong>${maxDias}</strong><span>dias (mais antiga)</span></div>
      </div>
      ${reguaPrazo(maxDias, {...t,prazo})}
    </div>
    <div class="cob-rodape">
      <div class="cob-infos">${infos.join("")}</div>
      <div class="cob-acoes">
        <button class="btn fantasma" data-acao="abrir-cob" data-tid="${esc(t.tid)}" aria-expanded="${aberto}">${icone(aberto ? "cima" : "baixo")}${aberto ? "Esconder peças" : `Ver peças (${itens.length})`}</button>
        <button class="btn" data-acao="confirmar-retorno" data-tid="${esc(t.tid)}" data-aba="${aba}">${icone("calendario")}Confirmar por e-mail</button>
        <button class="btn prim" data-acao="cobrar-filtrado" data-tid="${esc(t.tid)}" data-aba="${aba}">${icone("mensagem")}${aba === "vencendo" ? "Enviar lembrete" : "Cobrar"}</button>
      </div>
    </div>
    ${aberto ? `<div class="cob-itens">${tabelaPecasCobranca(linhas)}${itens.length > linhas.length ? `<button class="link-mais" data-acao="tecnico" data-tid="${esc(t.tid)}">Ver as ${fmtNum(itens.length)} peças na ficha do técnico ${icone("seta")}</button>` : ""}</div>` : ""}
  </article>`;
}

function tabelaPecasCobranca(itens) {
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Peça</th><th>Tipo</th><th>Quantidade</th><th>Dias / prazo</th><th>Previsão por e-mail</th></tr></thead><tbody>${itens.map(i=>`<tr><td><span class="mat"><strong class="mono">${esc(i.mat)}</strong>${esc(i.desc)}</span>${i.chamado?`<small>Chamado ${esc(i.chamado)}</small>`:''}</td><td>${pill(i.tipo==='novas'?'info':'alerta',i.tipo==='novas'?'Nova':'Usada')}</td><td>${fmtNum(i.qtd)}</td><td>${i.dias} / ${i.prazo} dias</td><td>${i.previsao?`${fmtData(i.previsao)} · ${plural(i.qtdPrevista,'peça','peças')}<small class="sub-celula">${esc(descricaoConfirmacao(i))}</small><small class="sub-celula">${esc(autorPrevisao(i))}</small>`:'Sem confirmação'}</td></tr>`).join('')}</tbody></table></div>`;
}
function tabelaItensCurta(itens, D) {
  return `<div class="tabela-rolagem"><table class="tabela compacta">
    <thead><tr><th>Chamado</th><th>Material</th><th>Data FT</th><th class="num">Dias</th><th>Situação</th><th>Previsão</th></tr></thead>
    <tbody>${itens.map((i) => `<tr>
      <td class="mono">${esc(i.chamado || "—")}</td>
      <td><span class="mat"><span class="mono">${esc(i.mat)}</span>${esc(i.desc)}</span></td>
      <td class="mono">${fmtData(i.dataFT)}</td>
      <td class="num"><strong>${i.dias}</strong></td>
      <td>${pillStatus(i, D.cfg)}</td>
      <td>${campoPrevisao(i)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function campoPrevisao(i) {
  return `<input type="date" class="campo-data" value="${esc(i.previsao)}" data-mudar="previsao-item" data-tid="${esc(i.tid)}" data-k="${esc(i.k)}" aria-label="Previsão de devolução">${i.previsao ? `<small class="sub-celula autoria-previsao" title="${esc(i.agendadoPor?.email || '')}">${esc(autorPrevisao(i))}</small>` : ''}`;
}

function filtrarCobrancas(D, s = UI.cob) {
  const busca = normBusca(s.busca);
  return D.tecnicos.filter(t => itensDaAba(t, s.aba, D.hoje, s.tipo||'usadas', s.somenteMeus).length
    && (!s.foco || tecnicoNoFocoCobranca(t, s.foco, D.hoje))
    && (!s.regiao || t.regiao === s.regiao)
    && (!busca || normBusca(t.nome + ' ' + t.nomeOriginal).includes(busca)));
}

function renderCobrancas() {
  const D = derivar();
  if (!E.usadas.length && !E.novas.length) return vazio("upload", "Sem peças importadas", "Importe as planilhas para ver quem precisa ser cobrado.", `<button class="btn prim" data-acao="ir" data-pagina="importar">Importar planilhas</button>`);
  const s = UI.cob;
  const contagem = {};
  const porAba = {};
  for (const a of ABAS_COB) {
    porAba[a.id] = D.tecnicos.filter((t) => itensDaAba(t, a.id, D.hoje, s.tipo||'usadas', s.somenteMeus).length);
    contagem[a.id] = porAba[a.id].length;
  }
  contagem.respostas = new Set(acompanhamentoRespostas(D,s.tipo||'usadas').filter(i=>!s.somenteMeus||respostaDoUsuario(i)).map(i=>i.tid)).size;
  let lista = filtrarCobrancas(D, s);
  const maxAba = (t) => Math.max(0, ...itensDaAba(t, s.aba, D.hoje, s.tipo||'usadas', s.somenteMeus).map((i) => i.dias));
  const qtdAba = (t) => somar(itensDaAba(t, s.aba, D.hoje, s.tipo||'usadas', s.somenteMeus), (i) => i.qtd);
  if (s.ordem === "pecas") lista = [...lista].sort((a, b) => qtdAba(b) - qtdAba(a));
  else if (s.ordem === "nome") lista = [...lista].sort((a, b) => comparar(a.nome, b.nome));
  else lista = [...lista].sort((a, b) => (s.aba === "cobrar" ? (b.nPrevVencida > 0) - (a.nPrevVencida > 0) : 0) || maxAba(b) - maxAba(a) || qtdAba(b) - qtdAba(a));
  const aba = ABAS_COB.find((a) => a.id === s.aba);
  const dica = aba.dica.replace("{prazo}", D.cfg.prazo).replace("{alerta}", D.cfg.alerta);
  const totalPecas = somar(lista, qtdAba);

  return `
    ${s.somenteMeus ? `<div class="faixa info compacta notif-meus-registros">${icone('pessoa')}<div><strong>Seus registros</strong><span>Recorte da notificação: agendamentos e contatos registrados pela sua conta.</span></div><button type="button" class="btn pequeno" data-acao="limpar-meus-registros">Ver todos os registros permitidos</button></div>` : ''}
    ${s.foco ? `<div class="faixa info compacta notif-filtro-cobranca">${icone('sino')}<div><strong>${esc(FOCOS_COBRANCA[s.foco] || '')}</strong><span>Filtro da central de notificações. Cada cartão reúne todas as peças a cobrar desse técnico.</span></div><button type="button" class="btn pequeno" data-acao="limpar-foco-cobranca">Limpar filtro</button></div>` : ''}
    <div class="cobranca-tipos" role="group" aria-label="Tipo de peça nas cobranças">${[['usadas','Usadas · prioridade'],['novas','Novas'],['todas','Novas e usadas']].map(([v,n])=>`<button class="btn ${(s.tipo||'usadas')===v?'prim':''}" data-acao="tipo-cob" data-tipo="${v}" aria-pressed="${(s.tipo||'usadas')===v}">${esc(n)}</button>`).join('')}</div>
    <div class="abas" role="tablist">${ABAS_COB.map((a) => `<button role="tab" class="aba${a.id === s.aba ? " ativa" : ""}" aria-selected="${a.id === s.aba}" data-acao="aba-cob" data-aba="${a.id}">${esc(a.rotulo)}<span class="contador">${contagem[a.id]}</span></button>`).join("")}</div>
    <div class="barra-filtros">
      <div class="chips">${["", ...D.regioes].map((r) => `<button class="chip${s.regiao === r ? " ativo" : ""}" data-acao="regiao-cob" data-regiao="${esc(r)}">${r ? esc(r) : "Todas as regiões"}</button>`).join("")}</div>
      <label class="busca-campo">${icone("busca")}<input type="search" placeholder="Buscar técnico" value="${esc(s.busca)}" data-digitar="busca-cob" aria-label="Buscar técnico"></label>
      <select data-mudar="ordem-cob" aria-label="Ordenar">
        <option value="dias"${s.ordem === "dias" ? " selected" : ""}>Mais dias primeiro</option>
        <option value="pecas"${s.ordem === "pecas" ? " selected" : ""}>Mais peças primeiro</option>
        <option value="nome"${s.ordem === "nome" ? " selected" : ""}>Nome (A–Z)</option>
      </select>
      <button class="btn" data-acao="exportar-cobrancas" ${s.aba==='respostas'?'hidden':''}>${icone("baixar")}Exportar lista</button>
      <button class="btn" data-acao="copiar-resumo" ${s.aba==='respostas'?'hidden':''}>${icone("copiar")}Copiar resumo</button>
    </div>
    ${s.aba==='respostas'?renderRespostasCobranca(D,s):`<p class="nota-aba">${icone("info")}<span>${esc(dica)}. ${lista.length ? `<strong>${plural(lista.length, "técnico", "técnicos")}</strong>, ${plural(totalPecas, "peça", "peças")}.` : ""}</span></p>
    <div class="lista-cob" id="lista-cob">
      ${lista.length ? lista.map((t) => cartaoCobranca(t, s.aba, D)).join("") : vazio("ok", "Nada por aqui", s.aba === "cobrar" ? "Nenhum técnico precisa ser cobrado hoje." : "Nenhum técnico nesta lista.")}
    </div>`}`;
}

/** Texto curto do dia para colar no WhatsApp/e-mail do supervisor. */
function resumoTexto() {
  const D = derivar();
  const tecnicos = filtrarCobrancas(D).map(t=>({...t,nCobrar:somar(itensDaAba(t,UI.cob.aba,D.hoje,UI.cob.tipo,UI.cob.somenteMeus),i=>i.qtd)}));
  const linhas = [`*Controle de peças — ${fmtDataExtensa(D.hoje)}*`, ""];
  if (UI.cob.foco) linhas.push(FOCOS_COBRANCA[UI.cob.foco], '');
  if (!tecnicos.length) linhas.push("Nenhum técnico com peças neste filtro.");
  else {
    linhas.push(`Técnicos para cobrar: ${tecnicos.length} (${plural(somar(tecnicos, t => t.nCobrar), "peça", "peças")})`, "");
    for (const t of tecnicos.slice(0, 40)) {
      linhas.push(`• ${t.nome} (${t.regiao}) — ${plural(t.nCobrar, "peça", "peças")}, mais antiga com ${t.maxDias} dias${t.nPrevVencida ? " — previsão vencida" : ""}`);
    }
    if (tecnicos.length > 40) linhas.push(`• ... e mais ${tecnicos.length - 40}`);
  }
  linhas.push("", `Total da operação — Pendentes: ${fmtNum(D.kpi.usadas)} · Atrasadas: ${fmtNum(D.kpi.atrasadas)}`);
  return linhas.join("\n");
}

async function exportarCobrancas() {
  const D = derivar();
  const linhas = [];
  for (const t of filtrarCobrancas(D)) for (const i of itensDaAba(t,UI.cob.aba,D.hoje,UI.cob.tipo,UI.cob.somenteMeus)) {
    linhas.push([t.nome, t.regiao, fmtTelefone(t.telefone), i.chamado, i.mat, i.desc, i.dataFT, i.dias, i.atraso, STATUS[i.status].rotulo, i.previsao, i.ultimaCobranca, i.nCobrancas, i.obs, i.nf, i.remessa, i.tipo==='novas'?'Nova':'Usada', i.qtd, i.confirmacao?.referenciaEmail||'', i.confirmacao?descricaoConfirmacao(i):'']);
  }
  await exportarExcel(`cobrancas-${D.hoje}.xlsx`, [{
    nome: "Cobranças filtradas",
    colunas: [
      { titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "WhatsApp", largura: 16 },
      { titulo: "Chamado", largura: 14 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 },
      { titulo: "Data FT", largura: 12, tipo: "data" }, { titulo: "Dias com a peça", largura: 9, tipo: "numero" },
      { titulo: "Dias de atraso", largura: 9, tipo: "numero" }, { titulo: "Situação", largura: 16 },
      { titulo: "Previsão", largura: 12, tipo: "data" }, { titulo: "Última cobrança", largura: 16, tipo: "data" },
      { titulo: "Nº de cobranças", largura: 9, tipo: "numero" }, { titulo: "Observação", largura: 30 },
      { titulo: "Nota fiscal", largura: 12 }, { titulo: "Remessa", largura: 13 }, {titulo:"Tipo",largura:12}, {titulo:"Quantidade",largura:12,tipo:"numero"}, {titulo:"Resposta por e-mail",largura:35}, {titulo:"Condição confirmada",largura:35},
    ],
    linhas,
  }]);
}
