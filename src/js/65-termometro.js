/* Faixas operacionais explícitas. Nenhuma pontuação ou tendência simulada. */
function situacaoOperacao(D = derivar()) {
  const agenda = itensAgendaCompleta(D), respostas = acompanhamentoRespostas(D, 'todas');
  const atrasadas = D.kpi.atrasadas, taxa = D.kpi.usadas ? atrasadas / D.kpi.usadas : 0;
  const criticas = somar(D.itens.filter(i => i.dias > 2 * i.prazo), i => i.qtd);
  const compromissosVencidos = agenda.filter(i => i.previsao < D.hoje);
  const vencidas = somar(compromissosVencidos, i => i.qtd);
  const aguardando = respostas.filter(i => i.estadoResposta === 'aguardando' && i.diasResposta >= 1);
  const formalizar = respostas.filter(i => i.estadoResposta === 'formalizar');
  const semRetorno = new Set([...aguardando, ...formalizar].map(i => i.tid)).size;
  const estoque = estoqueConhecidoPainel(D), excesso = estoque.acima.length;
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
    aguardando: new Set(aguardando.map(i => i.tid)).size, formalizar: new Set(formalizar.map(i => i.tid)).size,
    usadasTotal: D.kpi.usadas, agendadas: somar(agenda, i => i.qtd),
    vencidasUsadas: somar(compromissosVencidos.filter(i => i.tipo === 'usadas'), i => i.qtd),
    vencidasNovas: somar(compromissosVencidos.filter(i => i.tipo === 'novas'), i => i.qtd),
    maiorEspera: aguardando.reduce((maior, i) => Math.max(maior, i.diasResposta), 0),
    excessoPecas: somar(estoque.acima, t => t.excessoNovas), dentroLimite: estoque.dentro.length,
    tecnicosComLimite: estoque.dentro.length + estoque.acima.length };
}

function mostradorTermometro(nivel) {
  const ponto = (graus, raio) => {
    const angulo = graus * Math.PI / 180;
    return [160 + raio * Math.cos(angulo), 156 - raio * Math.sin(angulo)].map(n => n.toFixed(2));
  };
  const arco = (inicio, fim, raio) => `M${ponto(inicio, raio).join(' ')} A${raio} ${raio} 0 0 1 ${ponto(fim, raio).join(' ')}`;
  const marcas = Array.from({length: 31}, (_, n) => {
    const [x1,y1] = ponto(180 - n * 6, 143), [x2,y2] = ponto(180 - n * 6, n % 5 ? 139 : 134);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${n % 5 ? '' : 'marco-maior'}"/>`;
  }).join('');
  return `<svg class="termometro-mostrador" viewBox="0 0 320 180" aria-hidden="true">
    <g class="termometro-graduacao">${marcas}</g>
    <path class="termometro-arco-fundo" d="${arco(180,0,120)}"/>
    <g class="termometro-faixas"><path class="faixa-controlada" d="${arco(179,122,120)}"/><path class="faixa-atencao" d="${arco(118,62,120)}"/><path class="faixa-critica" d="${arco(58,1,120)}"/></g>
    <path class="termometro-arco-interno" d="${arco(180,0,96)}"/>
    <path class="termometro-eixo" d="M48 156H272"/>
    ${nivel !== 'incompleta' ? `<g class="termometro-marcador" style="--angulo:${{controlada:-60,atencao:0,critica:60}[nivel]}deg"><path d="M156 156 L160 49 L164 156 Z"/><circle cx="160" cy="47" r="4"/></g>` : ''}
    <circle class="termometro-pivo" cx="160" cy="156" r="11"/><circle class="termometro-pivo-centro" cx="160" cy="156" r="4"/>
  </svg>`;
}

function barraTermometro(partes, total, descricao) {
  return `<span class="termometro-microbarra" role="img" aria-label="${esc(descricao)}">${partes.map(([valor, cor]) => `<i class="cor-${cor}" style="--parcela:${total ? Math.min(100, valor / total * 100) : 0}%"></i>`).join('')}</span>`;
}

function detalhesTermometro(itens) {
  return `<span class="termometro-detalhes">${itens.map(([nome, valor, cor]) => `<span><small>${cor ? `<i class="cor-${cor}" aria-hidden="true"></i>` : ''}${nome}</small><b>${fmtNum(valor)}</b></span>`).join('')}</span>`;
}

function termometroOperacao(D) {
  const s = situacaoOperacao(D), afetadas = [s.atrasadas,s.vencidas,s.semRetorno,s.excesso].filter(Boolean).length;
  const nomes = {controlada:'Controlada',atencao:'Em atenção',critica:'Crítica',incompleta:'Sem avaliação'};
  const temTipo = tipo => D.frescor.some(f => f.tipo === tipo && f.em);
  const atual = tipo => D.frescor.length && D.frescor.filter(f => !tipo || f.tipo === tipo).every(f => f.em && f.dias === 0);
  const prazoNormal = Math.max(0, s.usadasTotal - s.atrasadas), atrasoNormal = Math.max(0, s.atrasadas - s.criticas);
  const pontos = [
    {id:'usadas',nome:'Usadas em atraso',valor:s.atrasadas,unidade:'peças',icone:'retorno',conhecido:temTipo('usadas'),atual:atual('usadas'),critico:s.criticas > 0 || s.taxa >= .25,
      leitura:s.usadasTotal ? `${fmtNum1(s.taxa * 100)}% das ${fmtNum(s.usadasTotal)} usadas em aberto` : 'Sem peças usadas em aberto',
      grafico:barraTermometro([[prazoNormal,'good'],[atrasoNormal,'warn'],[s.criticas,'crit']],s.usadasTotal,`${prazoNormal} no prazo, ${atrasoNormal} em atraso até o dobro do prazo e ${s.criticas} acima do dobro do prazo`),
      detalhes:detalhesTermometro([['No prazo',prazoNormal,'good'],['Atraso comum',atrasoNormal,'warn'],['Críticas',s.criticas,'crit']]),nota:'Críticas: acima do dobro do prazo.'},
    {id:'vencidas',nome:'Previsões vencidas',valor:s.vencidas,unidade:'peças',icone:'calendario',conhecido:s.importadas > 0,atual:atual(),critico:s.vencidas > 0,
      leitura:s.agendadas ? `${fmtNum(s.vencidas)} de ${fmtNum(s.agendadas)} peças agendadas` : 'Nenhuma devolução agendada',
      grafico:barraTermometro([[s.vencidas,'crit']],s.agendadas,`${s.vencidas} de ${s.agendadas} peças agendadas estão com previsão vencida`),
      detalhes:detalhesTermometro([['Usadas',s.vencidasUsadas],['Novas',s.vencidasNovas]]),nota:s.vencidas ? 'A data passou; o saldo segue em aberto.' : s.agendadas ? 'Compromissos dentro das datas combinadas.' : 'Registre as previsões confirmadas por e-mail.'},
    {id:'respostas',nome:'Pendências por e-mail',valor:s.semRetorno,unidade:'técnicos',icone:'email',conhecido:s.importadas > 0,atual:atual(),
      leitura:'Responsáveis contados sem duplicação',
      grafico:`<span class="termometro-espera">${icone('relogio')}${s.maiorEspera ? `Maior espera: ${plural(s.maiorEspera,'dia','dias')}` : s.formalizar ? 'Falta enviar a cobrança formal' : 'Nenhuma resposta em atraso'}</span>`,
      detalhes:detalhesTermometro([['Sem resposta',s.aguardando],['Sem e-mail formal',s.formalizar]]),nota:'Um técnico pode estar nas duas situações.'},
    {id:'excesso',nome:'Acima do limite',valor:s.excesso,unidade:'técnicos',icone:'caixa',conhecido:temTipo('novas'),atual:atual('novas'),
      leitura:s.tecnicosComLimite ? `${fmtNum(s.excesso)} de ${fmtNum(s.tecnicosComLimite)} técnicos com limite` : 'Nenhum técnico com limite acompanhado',
      grafico:barraTermometro([[s.excesso,'warn']],s.tecnicosComLimite,`${s.excesso} de ${s.tecnicosComLimite} técnicos estão acima do limite`),
      detalhes:detalhesTermometro([['Peças excedentes',s.excessoPecas],['Dentro do limite',s.dentroLimite]]),nota:'Respeita o limite individual de cada técnico.'},
  ];
  const prioridade = s.atrasadas ? {titulo:'Priorize as peças usadas em atraso',fator:'usadas',botao:'Conferir peças'}
    : s.vencidas ? {titulo:'Retome as devoluções com prazo vencido',fator:'vencidas',botao:'Rever previsões'}
    : s.semRetorno ? {titulo:'Conclua a formalização por e-mail',fator:'respostas',botao:'Acompanhar respostas'}
    : s.excesso ? {titulo:'Recolha ou redistribua o estoque excedente',fator:'excesso',botao:'Analisar estoque'}
    : s.nivel === 'incompleta' ? {titulo:'Atualize a base para concluir a avaliação'} : {titulo:'Mantenha a rotina de acompanhamento'};
  // A ação sugerida acompanha o motivo que definiu a faixa mais grave.
  if (s.vencidas && !s.criticas) Object.assign(prioridade,{titulo:'Retome as devoluções com prazo vencido',fator:'vencidas',botao:'Rever previsões'});
  return `<section class="termometro-operacao nivel-${s.nivel}" aria-labelledby="termometro-titulo">
    <header class="termometro-cab"><div><span class="termometro-identificador">${icone('grafico')}SAÚDE OPERACIONAL</span><h2 id="termometro-titulo">Termômetro da operação</h2><p>Prazos, compromissos e estoque em uma única leitura.</p></div><span class="termometro-data">${icone('calendario')}<span>Posição em<strong>${fmtData(D.hoje)}</strong></span></span></header>
    <div class="termometro-corpo"><div class="termometro-visao">
      <div class="termometro-situacao"><span class="termometro-selo"><i></i>${s.nivel === 'incompleta' ? 'DADOS INSUFICIENTES' : 'SITUAÇÃO ATUAL'}</span><h3>${nomes[s.nivel]}</h3><p>${s.nivel === 'critica' ? 'Exige ação prioritária' : s.nivel === 'atencao' ? 'Há pendências para regularizar' : s.nivel === 'controlada' ? 'Rotina dentro dos critérios' : 'Atualize as planilhas'}</p></div>
      <div class="termometro-escala" role="img" aria-label="Termômetro: ${nomes[s.nivel]}. ${esc(s.motivo)}">${mostradorTermometro(s.nivel)}<div class="termometro-rotulos" aria-hidden="true">${[['controlada','Controlada'],['atencao','Atenção'],['critica','Crítica']].map(([id,nome])=>`<span class="${s.nivel===id?'atual':''}"><i class="faixa-${id}"></i>${nome}</span>`).join('')}</div></div>
      <div class="termometro-frentes"><strong>${s.importadas ? afetadas : '—'}<small> / 4</small></strong><span>frentes com pendências<small>${s.desatualizadas || !s.importadas ? 'Leitura condicionada à atualização da base' : 'A faixa mais grave define a situação'}</small></span></div>
    </div>
    <div class="termometro-fatores">${pontos.map((p,n) => {
      const nivel = !p.conhecido ? 'incompleta' : p.valor ? p.critico ? 'critica' : 'atencao' : p.atual ? 'controlada' : 'incompleta';
      const estado = !p.conhecido ? 'Sem base' : p.valor ? p.critico ? 'Prioridade' : 'Atenção' : p.atual ? 'Sem desvios' : 'Atualizar base';
      return `<button type="button" class="termometro-fator fator-${nivel}" data-acao="termometro-abrir" data-fator="${p.id}" aria-label="${esc(p.nome)}: ${p.conhecido ? `${fmtNum(p.valor)} ${p.unidade}. ${estado}.` : 'Sem planilha importada.'} Abrir detalhes.">
        <span class="termometro-fator-topo"><span class="termometro-fator-icone">${icone(p.icone)}</span><span class="termometro-fator-nome">${p.nome}</span><span class="termometro-numero">0${n+1}</span></span>
        <span class="termometro-medida"><span><strong>${p.conhecido ? fmtNum(p.valor) : '—'}</strong><small>${p.unidade}</small></span><span class="termometro-estado"><i></i>${estado}</span></span>
        <span class="termometro-leitura">${p.conhecido ? p.leitura : 'Importe a planilha para avaliar este indicador'}</span>
        ${p.conhecido ? p.grafico + p.detalhes : '<span class="termometro-sem-base">Dados ainda não disponíveis</span>'}
        <span class="termometro-fator-rodape"><span>${p.conhecido ? p.nota : 'A ausência da planilha não representa estoque zero.'}</span>${icone('direita')}</span>
      </button>`;
    }).join('')}</div></div>
    <div class="termometro-prioridade"><span class="termometro-prioridade-icone">${icone(afetadas ? 'alerta' : s.nivel === 'incompleta' ? 'arquivo' : 'ok')}</span><div><span class="termometro-prioridade-rotulo">${afetadas ? 'PRÓXIMA AÇÃO' : 'ACOMPANHAMENTO'}</span><h3>${prioridade.titulo}</h3><p>${esc(s.motivo)}</p></div>${prioridade.fator ? `<button class="btn" data-acao="termometro-abrir" data-prioridade="${prioridade.fator}">${prioridade.botao}${icone('seta')}</button>` : s.nivel === 'incompleta' && podeAdministrar() ? `<button class="btn" data-acao="ir" data-pagina="importar">${icone('upload')}Importar planilhas</button>` : ''}</div>
    <footer class="termometro-rodape"><div class="termometro-base"><span>${icone(s.desatualizadas || !s.importadas ? 'relogio' : 'ok')}${!s.importadas ? 'Sem planilhas importadas' : s.desatualizadas ? 'Base parcial ou desatualizada' : 'Base atualizada hoje'}</span><div>${['usadas','novas'].map(tipo=>{const fs=D.frescor.filter(f=>f.tipo===tipo),qtd=fs.filter(f=>f.em&&f.dias===0).length;return `<span class="termometro-frescor ${fs.length&&qtd===fs.length?'completa':''}"><i></i>${tipo==='usadas'?'Usadas':'Novas'}<b>${qtd}/${fs.length}</b> hoje</span>`;}).join('')}</div></div>
      <details class="termometro-criterios"><summary>${icone('info')}Como a situação é definida${icone('baixo')}</summary><div class="termometro-regras"><div><strong><i class="faixa-controlada"></i>Controlada</strong><p>Planilhas de hoje completas e nenhum desvio nas quatro frentes acompanhadas.</p></div><div><strong><i class="faixa-atencao"></i>Atenção</strong><p>Alguma usada em atraso, pendência por e-mail ou técnico acima do limite de novas.</p></div><div><strong><i class="faixa-critica"></i>Crítica</strong><p>25% ou mais das usadas atrasadas, alguma usada acima do dobro do prazo ou alguma previsão vencida.</p></div></div><p>Os prazos e limites personalizados são respeitados. Uma previsão futura não apaga o atraso real da peça. E-mails sem resposta registrada entram no dia seguinte; avisos por WhatsApp sem cobrança formal entram imediatamente. Menos de 10 peças novas está dentro do limite padrão. O limite se aplica a todos os técnicos acompanhados.</p><p>Prevalece a faixa mais grave. As barras mostram quantidades da última base disponível; o medidor representa uma categoria, não uma nota percentual. Planilhas ausentes ou antigas impedem confirmar que a operação está controlada.</p></details>
    </footer>
  </section>`;
}

function abrirFatorTermometro(fator) {
  if (fator === 'excesso') {
    Object.assign(UI.es, { regiao: '', status: 'acima', busca: '' }); irPara('estoque');
  } else if (fator === 'usadas') {
    // Atraso real inclui peças com previsão; consulta avançada usa o prazo individual.
    UIconsulta.filtros = { ...FILTROS_CONSULTA, tipo: 'usadas', origem: 'atual', situacao: 'atrasada' };
    UIconsulta.visao = 'pecas'; UIconsulta.pagina = 1; irPara('consulta');
  } else {
    Object.assign(UI.cob, { tipo: 'todas', aba: fator === 'vencidas' ? 'vencidas' : 'respostas', resposta: 'pendentes', somenteMeus: false, foco: '', regiao: '', busca: '' }); irPara('cobrancas');
  }
}
