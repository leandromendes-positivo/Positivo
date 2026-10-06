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

/** Mensagens por WhatsApp ou Outlook; o registro só acontece após confirmação. */
function modalCobrar(tid, aba = "cobrar", itensEscolhidos = null, canalInicial = 'whatsapp') {
  const D = derivar(), t = D.mapa.get(tid);
  if (!t) return;
  let itens = itensEscolhidos || itensDaAba(t, aba, D.hoje);
  if (!itens.length) itens = t.itensCobrar.length ? t.itensCobrar : t.usadas;
  const lembrete = aba === "vencendo", qtd = somar(itens, i => i.qtd);
  const email = montarEmailCobranca(t, itens, lembrete);
  let telefone = t.telefone, emailCadastrado = email.destinatario;
  const m = abrirModal({
    titulo: `${lembrete ? "Lembrar" : "Cobrar"} ${t.nome}`,
    subtitulo: `${plural(qtd, "peça", "peças")} · mais antiga com ${Math.max(...itens.map(i => i.dias))} dias`,
    largura: 'larga', aoFechar: () => aoMudar.delete(atualizarContato),
    corpo: `<div class="cobrar-resumo"><div><span>Peças nesta cobrança</span><strong>${fmtNum(qtd)}</strong></div><div><span>Prazo do técnico</span><strong>${prazoDoTecnico(tid)} <small>dias</small></strong></div><div class="cobrar-contato"><span>Contato do técnico</span><small data-contato-resumo></small>${podeAdministrar() ? `<button class="link" type="button" data-acao="editar-tecnico" data-tid="${esc(tid)}">Editar contato</button>` : ''}</div></div>
    <div class="cobrar-grade">
      <section class="cobrar-msg" aria-label="Preparar mensagem">
        <div class="cobrar-etapa"><span>01</span><div><h3>Preparar mensagem</h3><p>Confira o conteúdo e escolha o canal.</p></div></div>
        <div class="cobrar-canais" role="group" aria-label="Canal da mensagem"><button type="button" class="btn" data-cob-canal="whatsapp" aria-pressed="true" aria-controls="cob-painel-whatsapp">${icone('mensagem')}WhatsApp</button><button type="button" class="btn" data-cob-canal="email" aria-pressed="false" aria-controls="cob-painel-email">${icone('email')}E-mail / Outlook</button></div>
        <div id="cob-painel-whatsapp">
          <label class="campo"><span>Mensagem para o WhatsApp</span><textarea id="cob-texto" rows="12"></textarea></label>
          <div class="linha-botoes"><a class="btn whats-btn" id="cob-link" href="#" target="_blank" rel="noopener noreferrer">${icone('mensagem')}Abrir no WhatsApp${icone('externo', 'ic-pequeno')}</a><button class="btn" type="button" data-copiar>${icone('copiar')}Copiar mensagem</button></div>
          <p class="nota" data-nota-whatsapp></p>
        </div>
        <form id="cob-painel-email" class="form" hidden>
          <label class="campo"><span>Para · contato do técnico</span><input type="email" id="cob-email-para" required maxlength="254" autocomplete="off" placeholder="tecnico@empresa.com.br"><small>Contato para esta cobrança. Não cria usuário nem concede acesso ao painel.</small></label>
          <label class="campo"><span>Assunto</span><input type="text" id="cob-email-assunto" required maxlength="180"></label>
          <label class="campo"><span>Mensagem do e-mail</span><textarea id="cob-email-corpo" rows="14" required></textarea></label>
          <label class="campo"><span>Onde abrir</span><select id="cob-email-editor">${Object.entries(EDITORES_EMAIL).map(([v,n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
          <p class="nota" data-email-orientacao></p>
          <p class="cobrar-email-aviso" data-email-aviso role="status" hidden></p>
          <div class="linha-botoes"><a class="btn prim" id="cob-email-link" target="_blank" rel="noopener noreferrer">${icone('email')}Abrir no Outlook${icone('externo', 'ic-pequeno')}</a><button class="btn" type="button" data-copiar-email>${icone('copiar')}Copiar com formatação</button></div>
          <p class="nota cobrar-email-ajuda"><strong>Para enviar com o visual abaixo:</strong> clique em Copiar com formatação. No corpo da mensagem do Outlook, selecione o texto preenchido e cole com Ctrl+V (⌘V no Mac). Se solicitado, escolha Manter formatação original. O botão Abrir no Outlook preenche o texto, mas não define fonte ou negrito.</p>
          <p class="cobrar-email-copia" data-email-copia role="status" hidden></p>
          <details class="cobrar-formatado" open><summary>Prévia do e-mail formatado</summary><div class="cobrar-email-previa" data-email-previa></div><div class="linha-botoes"><button type="button" class="btn" data-baixar-email>${icone('baixar')}Baixar rascunho (.eml)</button><button type="button" class="btn" data-copiar-email-texto>${icone('copiar')}Copiar só texto</button></div><p class="nota">O arquivo mantém a mensagem completa e a formatação. Abra no Outlook para computador compatível com rascunhos .eml.</p></details>
        </form>
      </section>
      <form class="cobrar-registro form" id="cob-form">
        <div class="cobrar-etapa"><span>02</span><div><h3>Registrar a cobrança</h3><p>Depois de enviar, registre o contato.</p></div></div>
        <p class="nota">Abrir a mensagem não confirma o envio. O histórico só muda ao clicar em Registrar cobrança.</p>
        <label class="campo"><span>Como você cobrou</span><select name="canal">${Object.entries(CANAIS).map(([v,r]) => `<option value="${v}">${r}</option>`).join('')}</select></label>
        <label class="campo"><span>Previsão informada pelo técnico</span><input type="date" name="previsao" id="cob-prev" min="${somaDias(D.hoje, -30)}"></label>
        ${atalhosData('#cob-prev')}
        <label class="campo"><span>Observação</span><input type="text" name="obs" maxlength="300" placeholder="Ex.: vai deixar na base na sexta"></label>
        <small class="nota">A previsão vale para ${plural(qtd, 'peça', 'peças')} desta cobrança. Até a data, elas saem da lista de cobrança.</small>
      </form>
    </div>`,
    rodape: `<button class="btn" data-fechar>Fechar</button><button class="btn prim" data-registrar>${icone('ok')}Registrar cobrança</button>`,
  });
  const el = m.el, ta = el.querySelector('#cob-texto'), link = el.querySelector('#cob-link');
  ta.value = montarMensagem(t, itens, lembrete ? E.config.msgLembrete : E.config.msgCobranca);
  const fEmail = el.querySelector('#cob-painel-email'), para = el.querySelector('#cob-email-para'), assunto = el.querySelector('#cob-email-assunto'), corpo = el.querySelector('#cob-email-corpo'), editor = el.querySelector('#cob-email-editor'), linkEmail = el.querySelector('#cob-email-link');
  para.value = email.destinatario; assunto.value = email.assunto; corpo.value = email.corpo;
  try { const preferido = localStorage.getItem('cp-outlook-editor'); if (Object.hasOwn(EDITORES_EMAIL, preferido)) editor.value = preferido; } catch (_) { /* preferência só nesta janela */ }
  const rascunho = () => ({ destinatario: para.value.trim(), assunto: assunto.value.trim(), corpo: corpo.value });
  function atualizarLinks() {
    link.href = linkWhatsApp(telefone, ta.value);
    const aviso = el.querySelector('[data-email-aviso]');
    let url = '', erro = '';
    try {
      url = linkEmailCobranca(rascunho(), editor.value);
      if (url.length > (editor.value === 'aplicativo' ? 1800 : 7500)) erro = 'Esta mensagem é longa demais para abrir por link. Use o rascunho .eml abaixo ou copie o corpo completo para o Outlook. Nenhuma peça foi removida da mensagem.';
    } catch (e) { erro = e.message; }
    if (erro) linkEmail.removeAttribute('href'); else linkEmail.href = url;
    linkEmail.setAttribute('aria-disabled', String(!!erro));
    aviso.textContent = erro; aviso.hidden = !erro;
    el.querySelector('[data-email-orientacao]').textContent = editor.value === 'aplicativo' ? 'O Outlook precisa estar configurado como aplicativo padrão de e-mail neste dispositivo. Revise o rascunho e clique em Enviar no Outlook.' : 'Abre um novo e-mail na sua conta do Microsoft 365. Revise o destinatário e clique em Enviar no Outlook.';
    const previa = el.querySelector('[data-email-previa]');
    if (previa.closest('details').open) previa.innerHTML = htmlEmailCobranca(rascunho());
  }
  function atualizarContato() {
    if (!el.isConnected) { aoMudar.delete(atualizarContato); return; }
    const atual = derivar().mapa.get(tid) || t;
    telefone = atual.telefone;
    if (para.value.trim() === emailCadastrado) para.value = String(atual.email || '').trim();
    emailCadastrado = String(atual.email || '').trim();
    el.querySelector('[data-contato-resumo]').textContent = [atual.email, telefone && fmtTelefone(telefone)].filter(Boolean).join(' · ') || 'E-mail e WhatsApp não cadastrados';
    el.querySelector('[data-nota-whatsapp]').textContent = telefone ? 'Confira a mensagem no WhatsApp antes de enviar.' : 'Sem número cadastrado: o WhatsApp pedirá para escolher o contato. Você também pode copiar a mensagem.';
    atualizarLinks();
  }
  function canal(valor) {
    el.querySelectorAll('[data-cob-canal]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cobCanal === valor)));
    el.querySelector('#cob-painel-whatsapp').hidden = valor !== 'whatsapp'; fEmail.hidden = valor !== 'email';
    el.querySelector('#cob-form [name="canal"]').value = valor;
  }
  el.querySelectorAll('[data-cob-canal]').forEach(b => b.addEventListener('click', () => canal(b.dataset.cobCanal)));
  ta.addEventListener('input', atualizarLinks); fEmail.addEventListener('input', () => { el.querySelector('[data-email-copia]').hidden = true; atualizarLinks(); });
  editor.addEventListener('change', () => { atualizarLinks(); try { localStorage.setItem('cp-outlook-editor', editor.value); } catch (_) { /* opcional */ } });
  fEmail.addEventListener('submit', e => { e.preventDefault(); linkEmail.click(); });
  linkEmail.addEventListener('click', e => {
    atualizarLinks();
    if (!fEmail.reportValidity() || !linkEmail.hasAttribute('href')) { e.preventDefault(); return; }
    el.querySelector('#cob-form [name="canal"]').value = 'email';
  });
  link.addEventListener('click', () => { el.querySelector('#cob-form [name="canal"]').value = 'whatsapp'; });
  el.querySelector('[data-copiar]').addEventListener('click', () => copiarTexto(ta.value));
  el.querySelector('[data-copiar-email]').addEventListener('click', async () => {
    const aviso = el.querySelector('[data-email-copia]'), btn = el.querySelector('[data-copiar-email]');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await copiarEmailFormatado(rascunho());
      aviso.textContent = 'Modelo copiado com formatação. Cole no corpo da mensagem no Outlook, substituindo o texto preenchido. Nenhum e-mail foi enviado.';
      aviso.dataset.estado = 'ok';
    } catch (e) { aviso.textContent = e.message; aviso.dataset.estado = 'erro'; }
    finally { aviso.hidden = false; btn.disabled = false; }
  });
  el.querySelector('[data-copiar-email-texto]').addEventListener('click', () => copiarTexto(corpo.value));
  el.querySelector('.cobrar-formatado').addEventListener('toggle', atualizarLinks);
  el.querySelector('[data-baixar-email]').addEventListener('click', () => {
    if (!fEmail.reportValidity()) return;
    try {
      const url = URL.createObjectURL(new Blob([rascunhoEmailCobranca(rascunho())], { type: 'message/rfc822' }));
      const a = document.createElement('a'); a.href = url; a.download = `cobranca-positivo-${hojeISO()}.eml`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast(e.message, 'erro'); }
  });
  aoMudar.add(atualizarContato); atualizarContato(); canal(canalInicial); ligarAtalhos(el);
  const registrar = async () => {
    const form = el.querySelector('#cob-form'), btn = el.querySelector('[data-registrar]');
    if (btn.disabled || !form.reportValidity()) return;
    const f = new FormData(form); btn.disabled = true;
    try {
      await registrarCobranca(tid, { canal: f.get('canal'), previsao: f.get('previsao') || '', obs: limpar(f.get('obs')), itens });
      m.fechar(); toast(`Cobrança de ${t.nome} registrada${f.get('previsao') ? `, previsão ${fmtPrevisao(f.get('previsao'))}` : ''}.`);
    } catch (e) { btn.disabled = false; toast(erroAmigavel(e).message, 'erro'); }
  };
  el.querySelector('[data-registrar]').addEventListener('click', registrar);
  el.querySelector('#cob-form').addEventListener('submit', e => { e.preventDefault(); registrar(); });
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

/** Cadastro do técnico: nome de exibição, tipo, limite próprio, contato. */
function modalTecnico(tid, focarPrazos = false) {
  exigirAdministrador();
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
        <label class="campo"><span>Limite próprio de peças novas</span><input type="number" name="meta" min="0" max="10000" placeholder="Padrão: ${esc(E.config.meta)}"><small>Em branco = limite padrão. 0 = sem limite. Estoque menor não exige reposição.</small></label>
        <label class="campo"><span>Localidade do técnico</span><select name="localidade">${Object.entries(LOCALIDADES).map(([v,n])=>`<option value="${v}" ${(c.localidade||'')===v?'selected':''}>${n}</option>`).join('')}</select><small>Informe se atende na capital ou no interior.</small></label>
        <label class="campo"><span>WhatsApp</span><input type="tel" name="telefone" maxlength="20" placeholder="(41) 99999-9999"></label>
        <label class="campo"><span>E-mail de contato</span><input type="email" name="email" maxlength="120" placeholder="nome@empresa.com.br"><small>Usado apenas para contato e cobranças. Não cria conta nem autoriza acesso ao painel.</small></label>
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
      apelido: limpar(f.apelido.value), tipo: f.tipo.value, localidade: f.localidade.value,
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
