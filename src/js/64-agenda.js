/* Agenda de compromissos em aberto. Uma previsão nunca dá baixa no estoque. */
function agendaDoPainel(D, inicio = D.hoje) {
  return Array.from({ length: 7 }, (_, n) => {
    const dia = somaDias(inicio, n);
    const itens = D.itens.filter(i => i.previsao === dia);
    return { dia, itens, qtd: somar(itens, i => i.qtd), tecnicos: agrupar(itens, i => i.tid) };
  });
}

function inicioSemanaAgenda(dia) {
  const semana = new Date(numDia(dia) * 86400000).getUTCDay();
  return somaDias(dia, -((semana + 6) % 7));
}

function resumoAgenda(D) {
  const agendadas = D.itens.filter(i => i.previsao);
  return {
    vencidas: agendadas.filter(i => i.previsao < D.hoje),
    hoje: agendadas.filter(i => i.previsao === D.hoje),
    semData: D.itens.filter(i => !i.previsao),
    agendadas,
  };
}

function compromissosAgenda(itens) {
  // Um técnico pode ter compromissos em datas diferentes: não misturar as peças.
  return [...agrupar(itens, i => JSON.stringify([i.tid, i.previsao])).values()]
    .map(grupo => ({ tid: grupo[0].tid, dia: grupo[0].previsao, itens: grupo, qtd: somar(grupo, i => i.qtd) }))
    .sort((a, b) => comparar(a.dia, b.dia) || b.qtd - a.qtd || comparar(nomeTecnico(a.tid), nomeTecnico(b.tid)));
}

function compromissoAgenda(c, D) {
  const atraso = diffDias(c.dia, D.hoje), t = D.mapa.get(c.tid);
  const situacao = atraso > 0 ? `${plural(atraso, 'dia', 'dias')} após a previsão` : atraso === 0 ? 'Previsto para hoje' : 'A devolver';
  const soLeitura = Armazem.online && E.usuario.podeEscrever === false;
  return `<article class="agenda-compromisso ${atraso > 0 ? 'vencido' : ''}">
    <div class="agenda-compromisso-topo"><button type="button" class="agenda-tecnico" data-acao="tecnico" data-tid="${esc(c.tid)}">
      ${avatar(t?.nome || nomeTecnico(c.tid), t?.tipo || 'tecnico')}<span><strong>${esc(t?.nome || nomeTecnico(c.tid))}</strong><small>${[...new Set(c.itens.map(i => i.regiao))].map(esc).join(', ')} · ${plural(c.qtd, 'peça', 'peças')}</small></span>${icone('direita')}</button>
      <span class="agenda-compromisso-status ${atraso > 0 ? 'txt-crit' : atraso === 0 ? 'txt-accent' : ''}">${icone(atraso > 0 ? 'relogio' : 'calendario')}<span><strong>${fmtData(c.dia, true)}</strong>${situacao}</span></span>
    </div>
    <div class="agenda-compromisso-rodape"><small class="autoria-previsao">Agendado por ${esc(autoresAgenda(c.itens))}</small><div class="agenda-acoes">
      <button type="button" class="btn pequeno" data-acao="agenda-reagendar" data-tid="${esc(c.tid)}" data-dia="${c.dia}" ${soLeitura ? 'disabled' : ''} aria-label="Reagendar peças de ${esc(nomeTecnico(c.tid))} previstas para ${fmtData(c.dia)}">${icone('calendario')}Reagendar</button>
      <button type="button" class="btn pequeno" data-acao="agenda-mensagem" data-tid="${esc(c.tid)}" data-dia="${c.dia}" ${soLeitura ? 'disabled' : ''} aria-label="Preparar mensagem para ${esc(nomeTecnico(c.tid))} sobre as peças de ${fmtData(c.dia)}">${icone('mensagem')}${atraso > 0 ? 'Cobrar' : 'Lembrar'}</button>
    </div></div>
    <details class="agenda-pecas"><summary>Conferir ${plural(c.qtd, 'peça', 'peças')} deste compromisso${icone('baixo')}</summary><ul>${c.itens.map(i => `<li><span><strong>${esc(i.mat)}</strong><span>${esc(E.catalogo[i.mat] || 'Material sem descrição')}</span><small>Chamado ${esc(i.chamado || '—')}</small></span><b>${fmtNum(i.qtd)}<small>${palavra(i.qtd, 'peça', 'peças')}</small></b></li>`).join('')}</ul></details>
  </article>`;
}

function agendaDevolucoes(D) {
  if (!UIpainel.dia) UIpainel.dia = D.hoje;
  const inicio = inicioSemanaAgenda(UIpainel.dia), fim = somaDias(inicio, 6);
  const dias = agendaDoPainel(D, inicio), atual = dias.find(d => d.dia === UIpainel.dia);
  const resumo = resumoAgenda(D), vencidas = UIpainel.agendaVencidas;
  const qtdVencidas = somar(resumo.vencidas, i => i.qtd), qtdHoje = somar(resumo.hoje, i => i.qtd), qtdSemData = somar(resumo.semData, i => i.qtd);
  const itens = vencidas ? resumo.vencidas : atual.itens;
  const compromissos = compromissosAgenda(itens);
  const qtd = somar(itens, i => i.qtd), tecnicos = new Set(itens.map(i => i.tid)).size;
  const mes = iso => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  const periodo = inicio.slice(0, 7) === fim.slice(0, 7) ? mes(inicio) : `${mes(inicio)} / ${mes(fim)}`;
  const destaques = `<div class="agenda-prioridades" role="group" aria-label="Prioridades da agenda">
    <button type="button" class="agenda-prioridade ${resumo.vencidas.length ? 'atencao' : ''}" data-acao="agenda-vencidas" aria-pressed="${vencidas}">${icone('relogio')}<span><span>Previsões vencidas</span><strong>${fmtNum(qtdVencidas)}<small> ${palavra(qtdVencidas, 'peça', 'peças')}</small></strong></span>${icone('direita')}</button>
    <button type="button" class="agenda-prioridade" data-acao="agenda-hoje" aria-pressed="${!vencidas && UIpainel.dia === D.hoje}">${icone('calendario')}<span><span>Devoluções hoje</span><strong>${fmtNum(qtdHoje)}<small> ${palavra(qtdHoje, 'peça', 'peças')}</small></strong></span>${icone('direita')}</button>
    <button type="button" class="agenda-prioridade" data-acao="painel-usadas" data-status="sem_previsao">${icone('arquivo')}<span><span>Sem previsão</span><strong>${fmtNum(qtdSemData)}<small> ${palavra(qtdSemData, 'peça', 'peças')}</small></strong></span>${icone('direita')}</button>
  </div>`;
  const navegacao = `<div class="agenda-navegacao"><div><h3>${periodo}</h3><p>${fmtData(inicio, true)} a ${fmtData(fim, true)} · ${plural(somar(dias, d => d.qtd), 'peça prevista', 'peças previstas')} na semana</p></div>
    <div class="agenda-navegar" role="group" aria-label="Navegar pelas semanas"><button type="button" class="btn-icone" data-acao="agenda-semana" data-passo="-1" aria-label="Semana anterior">${icone('esquerda')}</button><button type="button" class="btn pequeno" data-acao="agenda-hoje">Hoje</button><button type="button" class="btn-icone" data-acao="agenda-semana" data-passo="1" aria-label="Próxima semana">${icone('direita')}</button></div></div>`;
  const botoes = `<div class="agenda-dias" role="group" aria-label="Calendário semanal de devoluções">${dias.map(d => {
    const hoje = d.dia === D.hoje, selecionado = !vencidas && d.dia === atual.dia;
    const diaSemana = new Date(numDia(d.dia) * 86400000).getUTCDay();
    const expirada = d.dia < D.hoje && d.qtd > 0;
    return `<button type="button" data-acao="painel-dia" data-dia="${d.dia}" tabindex="${d.dia === atual.dia ? '0' : '-1'}" aria-pressed="${selecionado}" ${hoje ? 'aria-current="date"' : ''} aria-controls="agenda-detalhe" aria-label="${esc(fmtDataExtensa(d.dia))}${hoje ? ', hoje' : ''}: ${plural(d.qtd, 'peça prevista', 'peças previstas')}${expirada ? ', previsão vencida' : ''}" class="agenda-dia ${selecionado ? 'ativo' : ''} ${hoje ? 'hoje' : ''} ${expirada ? 'vencido' : ''} ${[0, 6].includes(diaSemana) ? 'fim-semana' : ''}">
      <span class="agenda-dia-cab">${SEMANA[diaSemana].slice(0, 3)}<span>${hoje ? 'Hoje' : MESES[Number(d.dia.slice(5, 7)) - 1].slice(0, 3)}</span></span>
      <span class="agenda-folha"><strong class="agenda-numero">${d.dia.slice(8, 10)}</strong><span class="agenda-dia-qtd">${d.qtd ? plural(d.qtd, 'peça', 'peças') : 'Livre'}</span></span>
      <span class="agenda-dia-rodape"><i class="${d.qtd ? 'com-previsao' : ''}"></i><span>${d.tecnicos.size ? plural(d.tecnicos.size, 'técnico', 'técnicos') : 'Sem previsão'}</span></span>
    </button>`;
  }).join('')}</div>`;
  const proximaData = resumo.agendadas.map(i => i.previsao).filter(d => d > UIpainel.dia && d >= D.hoje).sort()[0];
  const proximaQtd = somar(resumo.agendadas.filter(i => i.previsao === proximaData), i => i.qtd);
  const vazioAgenda = `<div class="agenda-vazia">${icone(vencidas ? 'ok' : 'calendario')}<div><strong>${vencidas ? 'Nenhuma previsão vencida' : 'Dia sem devoluções combinadas'}</strong><p>${!vencidas && proximaData ? `Próximo compromisso em ${fmtData(proximaData)} · ${plural(proximaQtd, 'peça', 'peças')}.` : 'Registre a data combinada com o técnico para acompanhar a devolução aqui.'}</p>
    ${!vencidas && proximaData ? `<button type="button" class="btn pequeno" data-acao="agenda-proxima" data-dia="${proximaData}">Ir para ${fmtData(proximaData, true)}${icone('direita')}</button>` : resumo.semData.length ? '<button type="button" class="btn pequeno" data-acao="painel-usadas" data-status="sem_previsao">Organizar peças sem previsão</button>' : ''}</div></div>`;
  const detalhe = `<div class="agenda-detalhe" id="agenda-detalhe" role="region" aria-label="${vencidas ? 'Compromissos vencidos' : 'Compromissos de ' + fmtData(atual.dia)}"><div class="agenda-resumo"><span class="sobretitulo">${vencidas ? 'PRECISAM DE UM NOVO CONTATO' : esc(fmtDataExtensa(atual.dia))}</span><strong>${plural(qtd, vencidas ? 'peça com previsão vencida' : 'peça prevista', vencidas ? 'peças com previsão vencida' : 'peças previstas')}</strong><p>${tecnicos ? `${plural(tecnicos, 'técnico', 'técnicos')} · ${vencidas ? 'compromissos mais antigos primeiro' : 'confira as peças e acompanhe o combinado'}` : 'Nenhum compromisso pendente nesta seleção.'}</p></div>
    <div class="agenda-tecnicos">${compromissos.length ? compromissos.map(c => compromissoAgenda(c, D)).join('') : vazioAgenda}</div></div>`;
  return cartao('Agenda de devoluções', destaques + navegacao + botoes + detalhe + `<p class="agenda-nota">${icone('info')}Peças usadas em aberto. A previsão não confirma a devolução: a baixa ocorre quando a peça sai da próxima planilha importada.</p>`, { sub: 'Acompanhe o combinado, priorize atrasos e organize os próximos retornos.', classe: 'cartao-agenda' });
}

function navegarAgenda(dia, { passo = 0, vencidas = false, foco = '' } = {}) {
  const antes = UIpainel.dia;
  UIpainel.dia = dia; UIpainel.agendaVencidas = vencidas;
  const agenda = document.querySelector('.cartao-agenda');
  if (!agenda) return;
  agenda.outerHTML = agendaDevolucoes(derivar());
  ligarAgendaPainel();
  const raiz = document.querySelector('.cartao-agenda');
  const mudouSemana = inicioSemanaAgenda(antes || dia) !== inicioSemanaAgenda(dia);
  if (mudouSemana) Movimento.animar(raiz.querySelector('.agenda-dias'), [{ opacity: .45, transform: `translateX(${dia > antes ? 12 : -12}px)` }, { opacity: 1, transform: 'translateX(0)' }], 240);
  else if (!vencidas) Movimento.animar(raiz.querySelector('.agenda-dia.ativo .agenda-folha'), [{ transform: 'perspective(500px) rotateX(-24deg)', opacity: .55 }, { transform: 'perspective(500px) rotateX(0)', opacity: 1 }], 280);
  Movimento.detalhe(raiz.querySelector('.agenda-detalhe'));
  const seletor = foco || (passo ? `[data-acao="agenda-semana"][data-passo="${passo}"]` : `[data-acao="painel-dia"][data-dia="${dia}"]`);
  raiz.querySelector(seletor)?.focus({ preventScroll: true });
}

function ligarAgendaPainel() {
  const grade = document.querySelector('.agenda-dias');
  if (!grade || grade.dataset.ligada) return;
  grade.dataset.ligada = '1';
  grade.addEventListener('keydown', e => {
    const alvo = e.target.closest('[data-acao="painel-dia"]');
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    let dia = alvo.dataset.dia;
    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) dia = somaDias(dia, e.key === 'ArrowLeft' ? -1 : 1);
    else if (['PageUp', 'PageDown'].includes(e.key)) dia = somaDias(dia, e.key === 'PageUp' ? -7 : 7);
    else if (e.key === 'Home') dia = inicioSemanaAgenda(dia);
    else if (e.key === 'End') dia = somaDias(inicioSemanaAgenda(dia), 6);
    else return;
    e.preventDefault(); navegarAgenda(dia);
  });
}

function agirCompromissoAgenda(el, acao) {
  // Reconsulta o estado atual: não inclui peças devolvidas nem outro combinado.
  const itens = derivar().itens.filter(i => i.tid === el.dataset.tid && i.previsao === el.dataset.dia);
  if (!itens.length) { toast('Este compromisso já foi atualizado. Confira a agenda.', 'info'); renderizar(true); return; }
  if (acao === 'reagendar') modalPrevisao(itens, `Reagendar · ${nomeTecnico(el.dataset.tid)}`);
  else modalCobrar(el.dataset.tid, el.dataset.dia < hojeISO() ? 'cobrar' : 'vencendo', itens);
}
