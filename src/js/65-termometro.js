/* Faixas operacionais explícitas. Nenhuma pontuação ou tendência simulada. */
function situacaoOperacao(D = derivar()) {
  const agenda = itensAgendaCompleta(D), respostas = acompanhamentoRespostas(D, 'todas');
  const atrasadas = D.kpi.atrasadas, taxa = D.kpi.usadas ? atrasadas / D.kpi.usadas : 0;
  const criticas = somar(D.itens.filter(i => i.dias > 2 * i.prazo), i => i.qtd);
  const vencidas = somar(agenda.filter(i => i.previsao < D.hoje), i => i.qtd);
  const aguardando = respostas.filter(i => i.estadoResposta === 'aguardando' && i.diasResposta >= 1);
  const formalizar = respostas.filter(i => i.estadoResposta === 'formalizar');
  const semRetorno = new Set([...aguardando, ...formalizar].map(i => i.tid)).size;
  const excesso = estoqueConhecidoPainel(D).acima.length;
  const importadas = D.frescor.filter(f => f.em).length;
  const desatualizadas = D.frescor.filter(f => !f.em || f.dias !== 0).length;
  let nivel = 'controlada', motivo = 'Nenhum desvio nos critérios acompanhados. Continue atualizando as planilhas e registrando as respostas.';
  // O maior risco prevalece: confirmar uma previsão não apaga o atraso da peça.
  if (criticas || vencidas || taxa >= .25) {
    nivel = 'critica';
    motivo = criticas ? `${plural(criticas, 'peça usada ultrapassou', 'peças usadas ultrapassaram')} o dobro do prazo de devolução.`
      : vencidas ? `${plural(vencidas, 'peça permanece', 'peças permanecem')} no inventário após a previsão combinada.`
      : `${fmtNum1(taxa * 100)}% das peças usadas estão acima do prazo.`;
  } else if (atrasadas || semRetorno || excesso) {
    nivel = 'atencao';
    motivo = atrasadas ? `${plural(atrasadas, 'peça usada está', 'peças usadas estão')} em atraso. Priorize a cobrança e confirme a devolução por e-mail.`
      : semRetorno ? `${plural(semRetorno, 'técnico precisa', 'técnicos precisam')} de acompanhamento por e-mail: falta formalizar a cobrança ou registrar a resposta.`
      : `${plural(excesso, 'técnico ultrapassou', 'técnicos ultrapassaram')} o limite de peças novas. Avalie o recolhimento do excedente.`;
  } else if (!importadas || desatualizadas) {
    nivel = 'incompleta';
    motivo = 'Atualize as planilhas de novas e usadas para avaliar se a operação está controlada.';
  }
  return { nivel, motivo, taxa, atrasadas, criticas, vencidas, semRetorno, excesso, importadas, desatualizadas,
    aguardando: new Set(aguardando.map(i => i.tid)).size, formalizar: new Set(formalizar.map(i => i.tid)).size };
}

function termometroOperacao(D) {
  const s = situacaoOperacao(D);
  const nomes = { controlada: 'Operação controlada', atencao: 'Operação em atenção', critica: 'Operação crítica', incompleta: 'Avaliação incompleta' };
  const faixas = [['controlada', 'Controlada'], ['atencao', 'Atenção'], ['critica', 'Crítica']];
  const pontos = [
    ['usadas', 'Usadas em atraso', s.atrasadas, s.importadas ? `${fmtNum1(s.taxa * 100)}% do saldo de usadas` : 'Aguardando planilhas', 'retorno'],
    ['vencidas', 'Previsões vencidas', s.vencidas, 'Peças novas e usadas', 'calendario'],
    ['respostas', 'Pendências por e-mail', s.semRetorno, 'Técnicos para acompanhar', 'email'],
    ['excesso', 'Acima do limite', s.excesso, 'Técnicos · estoque de novas', 'caixa'],
  ];
  const temTipo = tipo => D.frescor.some(f => f.tipo === tipo && f.em);
  return `<section class="termometro-operacao nivel-${s.nivel}" aria-labelledby="termometro-titulo">
    <div class="termometro-visao"><div class="termometro-cab"><span class="sobretitulo" id="termometro-titulo">Termômetro da operação</span><span class="termometro-data">${fmtData(D.hoje)}</span></div>
      <h2><i aria-hidden="true"></i>${nomes[s.nivel]}</h2><p>${esc(s.motivo)}</p>
      <div class="termometro-escala" role="img" aria-label="Termômetro: ${nomes[s.nivel]}. ${esc(s.motivo)}">
        <div class="termometro-trilho" aria-hidden="true">${faixas.map(([id]) => `<span class="faixa-${id}"></span>`).join('')}${s.nivel !== 'incompleta' ? `<i class="termometro-marcador" style="--posicao:${{controlada:16.67,atencao:50,critica:83.33}[s.nivel]}%"></i>` : ''}</div>
        <div class="termometro-rotulos" aria-hidden="true">${faixas.map(([id, nome]) => `<span class="${s.nivel === id ? 'atual' : ''}">${nome}</span>`).join('')}</div>
      </div>
    </div>
    <div class="termometro-fatores">${pontos.map(([id, nome, n, detalhe, ic]) => {
      const conhecido = id === 'usadas' ? temTipo('usadas') : id === 'excesso' ? temTipo('novas') : s.importadas;
      return `<button type="button" class="termometro-fator ${n ? 'com-pendencia' : ''}" data-acao="termometro-abrir" data-fator="${id}"><span class="termometro-fator-icone">${icone(ic)}</span><span><span>${nome}</span><strong>${conhecido ? fmtNum(n) : '—'}</strong><small>${conhecido ? detalhe : 'Aguardando planilhas'}</small></span>${icone('direita')}</button>`;
    }).join('')}</div>
    <div class="termometro-rodape"><span>${icone(s.desatualizadas || !s.importadas ? 'relogio' : 'ok')}${!s.importadas ? 'Sem planilhas importadas' : s.desatualizadas ? `${plural(s.desatualizadas, 'planilha precisa', 'planilhas precisam')} de atualização · leitura da última base disponível` : 'Planilhas atualizadas hoje · leitura do estoque atual'}</span>
      <details><summary>Entenda as faixas</summary><p><strong>Controlada:</strong> planilhas atualizadas hoje e nenhum desvio nestes quatro critérios. <strong>Atenção:</strong> existe atraso em usadas, pendência por e-mail ou estoque acima do limite. <strong>Crítica:</strong> 25% ou mais das usadas estão atrasadas, alguma usada ultrapassou o dobro do prazo ou alguma previsão venceu. Prevalece a faixa mais grave.</p><p>Os prazos e limites personalizados são respeitados. Peças usadas com previsão continuam contando no atraso real. E-mails sem resposta registrada entram no dia seguinte; avisos por WhatsApp sem cobrança formal entram imediatamente. Bases não entram no limite de técnicos. Menos de 10 peças novas está dentro do limite padrão.</p><p>Sem dados completos e atuais, não é possível afirmar que a operação está controlada. Os desvios conhecidos continuam visíveis. Esta é uma leitura do último inventário, sem nota ou tendência estimada.</p></details>
    </div>
  </section>`;
}

function abrirFatorTermometro(fator) {
  if (fator === 'excesso') {
    Object.assign(UI.es, { regiao: '', status: 'acima', busca: '', bases: false }); irPara('estoque');
  } else if (fator === 'usadas') {
    // Atraso real inclui peças com previsão; consulta avançada usa o prazo individual.
    UIconsulta.filtros = { ...FILTROS_CONSULTA, tipo: 'usadas', origem: 'atual', situacao: 'atrasada' };
    UIconsulta.visao = 'pecas'; UIconsulta.pagina = 1; irPara('consulta');
  } else {
    Object.assign(UI.cob, { tipo: 'todas', aba: fator === 'vencidas' ? 'vencidas' : 'respostas', resposta: 'pendentes', somenteMeus: false, foco: '', regiao: '', busca: '' }); irPara('cobrancas');
  }
}
