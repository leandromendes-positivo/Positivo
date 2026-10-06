/* ==========================================================================
   Página: Importar planilhas (arrastar e soltar) e histórico de importações.
   ========================================================================== */

async function receberArquivos(lista) {
  exigirAdministrador();
  const arquivos = [...lista].filter((f) => f && f.name);
  if (!arquivos.length) return;
  if (UI.im.processando) { toast("Aguarde a importação em andamento terminar.", "info"); return; }
  UI.im.resultado = null;
  UI.im.erro = null;
  irPara("importar");
  const fila = [];
  for (const f of arquivos) {
    const it = { arquivo: f, nome: f.name, regiao: "", tipo: "", lido: null, erro: null, precisa: null };
    try {
      it.lido = await lerRelatorio(f);
      it.regiao = it.lido.regiao;
      it.tipo = it.lido.tipo;
    } catch (e) {
      it.erro = e instanceof ErroLeitura ? e.message : `Não consegui ler o arquivo (${e.message}).`;
      it.precisa = (e.extra && e.extra.precisa) || null;
      it.tipo = (e.extra && e.extra.tipo) || tipoDoNome(f.name) || "";
      it.regiao = regiaoDoNome(f.name) || "";
    }
    fila.push(it);
  }
  UI.im.fila = fila;
  renderizar(true);
  if (fila.every((i) => i.lido)) await executarImportacao();
}

async function executarImportacao() {
  const s = UI.im;
  for (const it of s.fila) {
    if (it.lido && it.lido.regiao === it.regiao && it.lido.tipo === it.tipo) continue;
    if (!it.regiao || !it.tipo) continue;
    try {
      it.lido = await lerRelatorio(it.arquivo, { regiao: it.regiao, tipo: it.tipo });
      it.erro = null; it.precisa = null;
    } catch (e) {
      it.lido = null;
      it.erro = e instanceof ErroLeitura ? e.message : `Não consegui ler o arquivo (${e.message}).`;
    }
  }
  const prontos = s.fila.filter((i) => i.lido);
  if (!prontos.length) { renderizar(true); return; }
  s.processando = true;
  s.progresso = "Lendo as planilhas…";
  renderizar(true);
  try {
    const r = await importarLote(prontos.map((i) => i.lido), (msg) => {
      s.progresso = msg;
      const el = document.querySelector("[data-progresso]");
      if (el) el.textContent = msg;
    });
    s.resultado = r;
    s.fila = s.fila.filter((i) => !i.lido);
    const D = derivar();
    toast(`Importação concluída: ${plural(prontos.length, "planilha", "planilhas")}. ${D.kpi.cobrarTecnicos ? `${plural(D.kpi.cobrarTecnicos, "técnico", "técnicos")} para cobrar.` : "Ninguém para cobrar."}`);
  } catch (e) {
    console.error(e);
    s.erro = erroAmigavel(e).message;
  }
  s.processando = false;
  renderizar(true);
}

function zonaSoltar(grande) {
  return `<label class="zona-soltar${grande ? " grande" : ""}" data-zona>
    ${icone("upload")}
    <strong>Arraste as planilhas do dia aqui</strong>
    <span>Pode soltar todas de uma vez: Novas e Usadas de cada região (CSV do sistema ou .xlsx)</span>
    <span class="btn prim">Escolher arquivos</span>
    <input type="file" multiple accept=".csv,.txt,.xlsx,.xls" data-entrada-arquivos hidden>
  </label>`;
}

function renderImportar() {
  const D = derivar();
  const s = UI.im;
  const partes = [];
  if (!Armazem.online) {
    const [titulo, texto] = textoSemBanco();
    partes.push(`<div class="faixa alerta compacta">${icone("alerta")}<div><strong>${esc(titulo)}</strong><span>${esc(texto)}</span></div></div>`);
  }
  if (s.processando) {
    partes.push(`<div class="cartao processando"><div class="girando" aria-hidden="true"></div><div><strong>Importando…</strong><p data-progresso>${esc(s.progresso)}</p></div></div>`);
  } else {
    partes.push(zonaSoltar(!E.usadas.length && !E.novas.length));
  }
  if (s.erro) partes.push(`<div class="faixa crit compacta">${icone("alerta")}<div><strong>A importação não terminou</strong><span>${esc(s.erro)}</span></div><button class="btn" data-acao="tentar-importar">Tentar de novo</button></div>`);
  if (s.fila.length && !s.processando) partes.push(cartaoFila());
  if (s.resultado) partes.push(cartaoResultado(s.resultado));
  partes.push(`<div class="grade-2">${cartao("Última atualização de cada planilha", tabelaFrescor(D), { sub: "Importe todo dia para os prazos ficarem certos" })}${cartao("Como nomear os arquivos", `<div class="dicas-nome">
      <p>O sistema reconhece a região e o tipo pelo nome do arquivo e confere pelas colunas:</p>
      <ul><li><span class="mono">PR Novas.csv</span> · <span class="mono">PR Usadas.csv</span></li><li><span class="mono">RS Novas.csv</span> · <span class="mono">RS Usadas.csv</span></li><li><span class="mono">SC …</span> e <span class="mono">TO …</span> do mesmo jeito</li></ul>
      <p>Cada planilha substitui a foto anterior da mesma região. Peça usada que sumiu do relatório conta como <strong>devolvida</strong> naquele dia.</p></div>`)}</div>`);
  partes.push(cartao("Histórico de importações", tabelaImportacoes(), { sub: "Desfazer volta as planilhas daquela importação para a versão anterior" }));
  return partes.join("");
}

function cartaoFila() {
  const s = UI.im;
  const pendentes = s.fila.filter((i) => !i.lido);
  return cartao(pendentes.length ? "Confira antes de importar" : "Prontas para importar", `<div class="tabela-rolagem"><table class="tabela compacta">
    <thead><tr><th>Arquivo</th><th>Região</th><th>Tipo</th><th class="num">Linhas</th><th>Situação</th></tr></thead>
    <tbody>${s.fila.map((it, n) => `<tr>
      <td class="mono">${esc(it.nome)}</td>
      <td><select data-mudar="fila-regiao" data-n="${n}" aria-label="Região"><option value="">Escolha…</option>${Object.keys(UFS).map((u) => `<option value="${u}"${it.regiao === u ? " selected" : ""}>${u}</option>`).join("")}</select></td>
      <td><select data-mudar="fila-tipo" data-n="${n}" aria-label="Tipo"><option value="">Escolha…</option><option value="novas"${it.tipo === "novas" ? " selected" : ""}>Novas</option><option value="usadas"${it.tipo === "usadas" ? " selected" : ""}>Usadas</option></select></td>
      <td class="num">${it.lido ? fmtNum(it.lido.linhasLidas) : "—"}</td>
      <td>${it.lido ? pill("ok", "Pronto", "ok") : pill(it.precisa ? "alerta" : "crit", it.erro || "Escolha região e tipo", "alerta")}</td>
    </tr>`).join("")}</tbody></table></div>`, {
    acoes: `<button class="btn fantasma" data-acao="limpar-fila">Cancelar</button><button class="btn prim" data-acao="tentar-importar" ${s.fila.some((i) => i.lido || (i.regiao && i.tipo && i.precisa)) ? "" : "disabled"}>${icone("upload")}Importar</button>`,
  });
}

function cartaoResultado(r) {
  const linhas = r.resultados.map((x) => {
    const usadas = x.tipo === "usadas";
    const mud = usadas
      ? `${x.entradas ? pill("alerta", `+${fmtNum(x.entradas)} novas pendências`, "mais") : ""}${x.saidas ? pill("ok", `${fmtNum(x.saidasQtd || x.saidas)} devolvidas`, "retorno") : ""}${!x.entradas && !x.saidas ? pill("neutro", "Sem mudanças", "ok") : ""}`
      : `${x.entradas ? pill("info", `+${fmtNum(x.entradas)} itens novos`, "mais") : ""}${x.saidas ? pill("neutro", `${fmtNum(x.saidas)} itens saíram`, "retorno") : ""}${x.alterados ? pill("neutro", `${fmtNum(x.alterados)} com quantidade alterada`, "lapis") : ""}${!x.entradas && !x.saidas && !x.alterados ? pill("neutro", "Sem mudanças", "ok") : ""}`;
    return `<tr>
      <td class="mono">${esc(x.nome)}</td><td>${regiaoTag(x.regiao)}</td><td>${usadas ? "Usadas" : "Novas"}</td>
      <td class="num">${fmtNum(x.linhas)}</td>
      <td class="num">${fmtNum(x.qtd)}${!usadas && x.qtdAntes != null && x.qtdAntes !== x.qtd ? ` <small>(antes ${fmtNum(x.qtdAntes)})</small>` : ""}</td>
      <td><div class="pills">${mud}</div>${(x.avisos || []).map((a) => `<small class="aviso-linha">${icone("info")}${esc(a)}</small>`).join("")}</td>
    </tr>`;
  }).join("");
  const D = derivar();
  return `<section class="cartao resultado">
    <header class="cartao-topo"><div><h2>${icone("ok")}Importação concluída</h2><p>${plural(r.resultados.length, "planilha", "planilhas")}${r.devolvidas ? ` · ${plural(r.devolvidas, "peça usada devolvida", "peças usadas devolvidas")} desde a importação anterior` : ""}</p></div>
    <div class="cartao-acoes"><button class="btn" data-acao="ir" data-pagina="painel">Ver painel</button><button class="btn prim" data-acao="ir" data-pagina="cobrancas">${icone("sino")}Cobranças de hoje (${D.kpi.cobrarTecnicos})</button></div></header>
    ${(r.avisos || []).map((a) => `<p class="aviso-linha">${icone("info")}${esc(a)}</p>`).join("")}
    <div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Arquivo</th><th>UF</th><th>Tipo</th><th class="num">Linhas</th><th class="num">Peças</th><th>O que mudou</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`;
}

function tabelaFrescor(D) {
  const regioes = [...new Set(D.frescor.map((f) => f.regiao))];
  if (!regioes.length) return `<p class="nota">Nenhuma planilha importada ainda.</p>`;
  const celula = (f) => {
    if (!f || !f.em) return `<span class="frescor nunca">${icone("alerta")}nunca</span>`;
    const cls = f.dias === 0 ? "hoje" : f.dias === 1 ? "ontem" : "velha";
    return `<span class="frescor ${cls}" title="${esc(f.arquivo)}">${icone(f.dias === 0 ? "ok" : "relogio")}${fmtQuando(f.em)}</span>`;
  };
  return `<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Região</th><th>Novas</th><th>Usadas</th></tr></thead><tbody>
    ${regioes.map((r) => `<tr><td>${regiaoTag(r)} ${esc(UFS[r] || "")}</td><td>${celula(D.frescor.find((f) => f.regiao === r && f.tipo === "novas"))}</td><td>${celula(D.frescor.find((f) => f.regiao === r && f.tipo === "usadas"))}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function podeDesfazer(imp) {
  if (imp.desfeito) return false;
  const chaves = imp.chaves || [];
  return chaves.length > 0 && chaves.every((c) => E.indice.arquivos && E.indice.arquivos[c] && E.indice.arquivos[c].lote === imp.id);
}

function tabelaImportacoes() {
  const imps = E.importacoes.slice(0, 30);
  if (!imps.length) return `<p class="nota">Nenhuma importação ainda.</p>`;
  return `<div class="tabela-rolagem"><table class="tabela compacta">
    <thead><tr><th>Quando</th><th>Planilhas</th><th class="num">Linhas</th><th class="num">Devolvidas</th><th></th></tr></thead>
    <tbody>${imps.map((imp) => `<tr class="${imp.desfeito ? "apagado" : ""}">
      <td class="nowrap">${fmtDataHora(imp.em)}</td>
      <td>${(imp.arquivos || []).map((a) => `<span class="tag">${esc(a.regiao)} ${a.tipo === "usadas" ? "usadas" : "novas"}</span>`).join(" ")}${imp.desfeito ? ` <small>desfeita</small>` : ""}</td>
      <td class="num">${fmtNum(somar(imp.arquivos || [], (a) => a.linhas || 0))}</td>
      <td class="num">${fmtNum(imp.devolvidas || 0)}</td>
      <td>${podeDesfazer(imp) ? `<button class="btn pequeno fantasma" data-acao="desfazer" data-id="${esc(imp.id)}">${icone("desfazer")}Desfazer</button>` : ""}</td>
    </tr>`).join("")}</tbody></table></div>`;
}
