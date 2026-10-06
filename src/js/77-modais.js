/* ==========================================================================
   Janelas: cobrar técnico, definir previsão, editar cadastro.
   ========================================================================== */

const CANAIS = { whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", pessoalmente: "Pessoalmente", outro: "Outro" };

function proximoDiaSemana(diaSemana) {
  const hoje = hojeISO();
  const atual = new Date(numDia(hoje) * 86400000).getUTCDay();
  let d = (diaSemana - atual + 7) % 7;
  if (d === 0) d = 7;
  return somaDias(hoje, d);
}
function atalhosData(alvo) {
  const hoje = hojeISO();
  const ops = [["Hoje", hoje], ["Amanhã", somaDias(hoje, 1)], ["Em 2 dias", somaDias(hoje, 2)], ["Sexta", proximoDiaSemana(5)], ["Segunda", proximoDiaSemana(1)]];
  return `<div class="atalhos-data">${ops.map(([r, d]) => `<button type="button" class="chip" data-data="${d}" data-alvo="${alvo}">${r} <span>${fmtData(d, true)}</span></button>`).join("")}</div>`;
}
function ligarAtalhos(el) {
  el.querySelectorAll("[data-data]").forEach((b) => b.addEventListener("click", () => {
    const campo = el.querySelector(b.dataset.alvo);
    if (campo) { campo.value = b.dataset.data; campo.dispatchEvent(new Event("input")); }
  }));
}

/** Cobrar: mensagem pronta (copiar / abrir WhatsApp) + registro da cobrança. */
function modalCobrar(tid, aba = "cobrar", itensEscolhidos = null) {
  const D = derivar();
  const t = D.mapa.get(tid);
  if (!t) return;
  let itens = itensEscolhidos || itensDaAba(t, aba, D.hoje);
  if (!itens.length) itens = t.itensCobrar.length ? t.itensCobrar : t.usadas;
  const lembrete = aba === "vencendo";
  const texto = montarMensagem(t, itens, lembrete ? E.config.msgLembrete : E.config.msgCobranca);
  const qtd = somar(itens, (i) => i.qtd);
  const m = abrirModal({
    titulo: `${lembrete ? "Lembrar" : "Cobrar"} ${t.nome}`,
    subtitulo: `${plural(qtd, "peça", "peças")} · mais antiga com ${Math.max(...itens.map((i) => i.dias))} dias${t.telefone ? ` · WhatsApp ${fmtTelefone(t.telefone)}` : ""}`,
    largura: "larga",
    corpo: `<div class="cobrar-grade">
      <div class="cobrar-msg">
        <label class="campo"><span>Mensagem</span><textarea id="cob-texto" rows="12"></textarea></label>
        <div class="linha-botoes">
          <button class="btn" type="button" data-copiar>${icone("copiar")}Copiar mensagem</button>
          <a class="btn whats-btn" id="cob-link" href="#" target="_blank" rel="noopener noreferrer">${icone("mensagem")}Abrir no WhatsApp${icone("externo", "ic-pequeno")}</a>
        </div>
        ${t.telefone ? "" : `<p class="nota">${icone("info")}Sem WhatsApp cadastrado: o WhatsApp vai pedir para escolher o contato. <button class="link" type="button" data-acao="editar-tecnico" data-tid="${esc(t.tid)}">Cadastrar número</button></p>`}
        <p class="nota">Se o link não abrir neste aparelho, copie a mensagem e cole na conversa.</p>
      </div>
      <form class="cobrar-registro form" id="cob-form">
        <h3>Registrar a cobrança</h3>
        <p class="nota">Registre depois de enviar. Fica no histórico do técnico e o painel mostra quando foi a última.</p>
        <label class="campo"><span>Como você cobrou</span><select name="canal">${Object.entries(CANAIS).map(([v, r]) => `<option value="${v}">${r}</option>`).join("")}</select></label>
        <label class="campo"><span>Previsão de devolução que o técnico informou</span><input type="date" name="previsao" id="cob-prev" min="${somaDias(D.hoje, -30)}"></label>
        ${atalhosData("#cob-prev")}
        <label class="campo"><span>Observação</span><input type="text" name="obs" maxlength="300" placeholder="Ex.: vai deixar na base na sexta"></label>
        <small class="nota">A previsão vale para ${plural(qtd, "peça", "peças")} desta cobrança. Até a data, elas saem da lista de cobrança.</small>
      </form>
    </div>`,
    rodape: `<button class="btn" data-fechar>Fechar</button><button class="btn prim" data-registrar>${icone("ok")}Registrar cobrança</button>`,
  });
  const ta = m.el.querySelector("#cob-texto");
  const link = m.el.querySelector("#cob-link");
  ta.value = texto;
  const atualizarLink = () => { link.href = linkWhatsApp(t.telefone, ta.value); };
  atualizarLink();
  ta.addEventListener("input", atualizarLink);
  m.el.querySelector("[data-copiar]").addEventListener("click", () => copiarTexto(ta.value));
  ligarAtalhos(m.el);
  const registrar = async () => {
    const f = new FormData(m.el.querySelector("#cob-form"));
    const btn = m.el.querySelector("[data-registrar]");
    btn.disabled = true;
    try {
      await registrarCobranca(tid, { canal: f.get("canal"), previsao: f.get("previsao") || "", obs: limpar(f.get("obs")), itens });
      m.fechar();
      toast(`Cobrança de ${t.nome} registrada${f.get("previsao") ? `, previsão ${fmtPrevisao(f.get("previsao"))}` : ""}.`);
    } catch (e) {
      btn.disabled = false;
      toast(erroAmigavel(e).message, "erro");
    }
  };
  m.el.querySelector("[data-registrar]").addEventListener("click", registrar);
  m.el.querySelector("#cob-form").addEventListener("submit", (e) => { e.preventDefault(); registrar(); });
}

/** Previsão de devolução para um conjunto de peças. */
function modalPrevisao(itens, titulo) {
  if (!itens.length) { toast("Nenhuma peça selecionada.", "info"); return; }
  const atual = itens.every((i) => i.previsao === itens[0].previsao) ? itens[0].previsao : "";
  const qtd = somar(itens, (i) => i.qtd);
  const m = abrirModal({
    titulo: titulo || "Previsão de devolução",
    subtitulo: `${plural(qtd, "peça", "peças")}`,
    corpo: `<form class="form" id="prev-form">
      <label class="campo"><span>Data em que o técnico disse que vai devolver</span><input type="date" id="prev-data" value="${esc(atual)}" required></label>
      ${atalhosData("#prev-data")}
      <p class="nota">Até essa data as peças ficam como "Com previsão" e saem da lista de cobrança. Se não forem devolvidas, voltam como "Previsão vencida".</p>
    </form>`,
    rodape: `${atual ? `<button class="btn perigo fantasma" data-limpar>Tirar previsão</button>` : ""}<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar>Salvar previsão</button>`,
  });
  ligarAtalhos(m.el);
  const salvar = async (valor) => {
    try {
      await definirPrevisao(itens, valor);
      m.fechar();
      toast(valor ? `Previsão ${fmtPrevisao(valor)} salva para ${plural(qtd, "peça", "peças")}.` : "Previsão removida.");
    } catch (e) { toast(erroAmigavel(e).message, "erro"); }
  };
  m.el.querySelector("[data-salvar]").addEventListener("click", () => {
    const v = m.el.querySelector("#prev-data").value;
    if (!v) { toast("Escolha a data.", "info"); return; }
    salvar(v);
  });
  m.el.querySelector("#prev-form").addEventListener("submit", (e) => { e.preventDefault(); m.el.querySelector("[data-salvar]").click(); });
  const limparBtn = m.el.querySelector("[data-limpar]");
  if (limparBtn) limparBtn.addEventListener("click", () => salvar(""));
}

/** Cadastro do técnico: nome de exibição, tipo, meta própria, contato. */
function modalTecnico(tid, focarPrazos = false) {
  const D = derivar();
  const t = D.mapa.get(tid);
  const c = E.cadastro[tid] || {};
  const nomeRelatorio = c.nome || tid;
  const m = abrirModal({
    titulo: "Cadastro do técnico",
    subtitulo: `No relatório: ${nomeRelatorio}`,
    corpo: `<form class="form" id="tec-form">
      <label class="campo"><span>Nome para exibir</span><input type="text" name="apelido" maxlength="80" placeholder="${esc(nomeBonito(nomeRelatorio))}"><small>Deixe em branco para usar o nome do relatório. Útil para códigos numéricos.</small></label>
      <div class="campos-2">
        <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS_TEC).map(([v, r]) => `<option value="${v}"${(c.tipo || "tecnico") === v ? " selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="campo"><span>Meta própria de peças novas</span><input type="number" name="meta" min="0" max="10000" placeholder="Padrão: ${esc(E.config.meta)}"><small>Em branco = meta padrão. 0 = sem meta.</small></label>
        <label class="campo"><span>WhatsApp</span><input type="tel" name="telefone" maxlength="20" placeholder="(41) 99999-9999"></label>
        <label class="campo"><span>E-mail</span><input type="email" name="email" maxlength="120" placeholder="nome@empresa.com.br"></label>
      </div>
      <fieldset class="prazos-personalizados"><legend>${icone('relogio')}Prazos de devolução deste técnico</legend>
        <p>Defina prazos em dias para as peças em aberto e futuras. Deixe em branco para acompanhar a regra geral.</p>
        <div class="campos-2">
          <label class="campo"><span>Peças usadas · dias</span><input type="number" name="prazoUsadas" min="1" max="90" step="1" placeholder="Regra geral: ${prazoGeral()} dias" ${focarPrazos ? 'autofocus' : ''}><small>Contados da Data FT; sem essa data, da primeira importação.</small></label>
          <label class="campo"><span>Peças novas · dias</span><input type="number" name="prazoNovas" min="1" max="90" step="1" placeholder="Regra geral: ${prazoGeral('novas')} dias"><small>Contados da primeira observação do material no estoque.</small></label>
        </div>
        <div class="prazos-personalizados-rodape"><span>Previsões combinadas continuam registradas. Devoluções com prazo salvo mantêm seu histórico.</span><button class="btn pequeno" type="button" data-prazos-gerais>Usar prazos gerais</button></div>
      </fieldset>
      <label class="campo"><span>Observações</span><textarea name="obs" rows="3" maxlength="500"></textarea></label>
      ${t ? `<p class="nota">${plural(t.nUsadas, "peça usada pendente", "peças usadas pendentes")} · ${plural(t.novasTodas || 0, "peça nova", "peças novas")} no último relatório.</p>` : ""}
    </form>`,
    rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar>Salvar</button>`,
  });
  const f = m.el.querySelector("#tec-form");
  f.apelido.value = c.apelido || "";
  f.meta.value = c.meta === 0 || c.meta ? c.meta : "";
  f.prazoUsadas.value = prazoValido(c.prazoUsadas) ?? '';
  f.prazoNovas.value = prazoValido(c.prazoNovas) ?? '';
  f.telefone.value = c.telefone || "";
  f.email.value = c.email || "";
  f.obs.value = c.obs || "";
  m.el.querySelector('[data-prazos-gerais]').addEventListener('click', () => {
    f.prazoUsadas.value = ''; f.prazoNovas.value = ''; f.prazoUsadas.focus();
  });
  const botaoSalvar = m.el.querySelector('[data-salvar]');
  const salvar = async () => {
    if (botaoSalvar.disabled || !f.reportValidity()) return;
    const metaTxt = String(f.meta.value).trim();
    const campos = {
      apelido: limpar(f.apelido.value), tipo: f.tipo.value,
      meta: metaTxt === "" ? null : Math.max(0, parseInt(metaTxt, 10) || 0),
      prazoUsadas: f.prazoUsadas.value === '' ? null : Number(f.prazoUsadas.value),
      prazoNovas: f.prazoNovas.value === '' ? null : Number(f.prazoNovas.value),
      telefone: limpar(f.telefone.value), email: limpar(f.email.value), obs: String(f.obs.value || "").trim(),
    };
    try {
      botaoSalvar.disabled = true;
      await salvarTecnico(tid, campos);
      m.fechar();
      toast("Cadastro salvo.");
    } catch (e) { toast(erroAmigavel(e).message, "erro"); botaoSalvar.disabled = false; }
  };
  m.el.querySelector("[data-salvar]").addEventListener("click", salvar);
  f.addEventListener("submit", (e) => { e.preventDefault(); salvar(); });
}
