/* Consulta e desempenho: quantidades físicas, períodos civis e origem explícita. */
const DESTINOS_NOVAS = { pendente: 'A classificar', devolucao: 'Devolvida', uso: 'Usada em atendimento', transferencia: 'Transferência / ajuste' };
const CONDICOES_DEVOLUCAO = { nova: 'Nova — retorno ao estoque', rmdf: 'RMDF aplicado — peça com defeito' };
function condicaoDevolucao(i) {
  return i.destino === 'devolucao' && i.tipo !== 'usadas' ? (CONDICOES_DEVOLUCAO[i.condicaoDevolucao] || 'Condição não informada') : '';
}
function situacaoSaidaNova(i) {
  return i.destino === 'devolucao' ? `Devolvida · ${condicaoDevolucao(i)}` : DESTINOS_NOVAS[i.destino] || DESTINOS_NOVAS.pendente;
}
function resumoClassificacao(i) {
  if (!i.classificadoEm && !i.observacaoClassificacao) return '';
  return `<small class="sub-celula">${esc(i.classificadoPor?.email ? primeiroNomeEmail(i.classificadoPor.email) : 'Sem autoria registrada')}${i.classificadoEm ? ` · ${fmtDataHora(i.classificadoEm)}` : ''}</small>${i.observacaoClassificacao ? `<small class="sub-celula">${esc(i.observacaoClassificacao)}</small>` : ''}`;
}
function versaoSaida(i) { return JSON.stringify([i.qtd,i.destino,i.condicaoDevolucao || '',i.classificadoEm || '',i.revisao || '']); }
const FAMILIAS_PECAS = [
  ['Memória', /\b(mem|memoria|ram|sodimm|dimm)\b/],
  ['Armazenamento', /\b(ssd|hdd|hd|emmc)\b/],
  ['Tela / monitor', /\b(lcd|led|tela|display|monitor)\b/],
  ['Bateria', /\b(bater|bateria|battery)\b/],
  ['Fonte / carregador', /\b(fonte|carregador|adaptador|adapter)\b/],
  ['Teclado / mouse', /\b(tcl|teclado|keyboard|mouse|touchpad)\b/],
  ['Placa', /\b(placa|motherboard|mainboard|pcba|pcb)\b/],
  ['Refrigeração', /\b(cooler|fan|ventoinha|dissipador)\b/],
  ['Cabos / conectores', /\b(cabo|cable|conector)\b/],
  ['Gabinete / estrutura', /\b(gabinete|carcaca|tampa|frame|dobradica)\b/],
];
function familiaPeca(descricao) {
  const nome = normBusca(descricao);
  return FAMILIAS_PECAS.find(([, re]) => re.test(nome))?.[0] || 'Outros materiais';
}
function linhasConsulta(D = derivar()) {
  const linhas = [];
  const completar = (i) => {
    const t = D.mapa.get(i.tid), cad = E.cadastro[i.tid];
    if (cad?.tipo === 'ignorar') return;
    const desc = E.catalogo[i.mat] || '';
    linhas.push({ ...i, nome: t?.nome || nomeTecnico(i.tid), nomeOriginal: cad?.nome || '', localidade: cad?.localidade || '', tipoTec: t?.tipo || cad?.tipo || 'tecnico', desc, familia: familiaPeca(desc) });
  };
  for (const i of D.itens) completar({ ...i, tipo: 'usadas', origem: 'atual', data: (i.dataFT || i.desde || '').slice(0, 10), referencia: i.dataFT ? 'Data FT' : 'Primeira observação', situacao: STATUS[i.status].rotulo });
  for (const t of D.tecnicos) for (const n of t.novasLinhas) {
    const prazo = prazoDoTecnico(n.tid, 'novas', D.cfg), atraso = Math.max(0, n.dias - prazo);
    completar({ ...n, prazo, tipo: 'novas', origem: 'atual', data: n.desde, referencia: 'Primeira observação', atraso, atrasada: atraso > 0, status: atraso > 0 ? 'atrasada' : 'no_prazo', situacao: atraso > 0 ? 'Acima de ' + prazo + ' dias' : 'No prazo observado' });
  }
  for (const d of E.devolucoes) completar({ ...d, prazo: prazoDaDevolucao(d, 'usadas', D.cfg), tipo: 'usadas', origem: 'devolvida', data: d.em.slice(0, 10), referencia: 'Saída do relatório', status: 'devolvida', situacao: 'Devolvida', atrasada: d.dias > prazoDaDevolucao(d, 'usadas', D.cfg), atraso: Math.max(0, d.dias - prazoDaDevolucao(d, 'usadas', D.cfg)) });
  for (const m of E.movimentos) completar({ ...m, prazo: prazoDaDevolucao(m, 'novas', D.cfg), tipo: 'novas', origem: 'saida', data: m.em.slice(0, 10), referencia: 'Saída do relatório', status: m.destino, situacao: situacaoSaidaNova(m), atrasada: m.dias > prazoDaDevolucao(m, 'novas', D.cfg), atraso: Math.max(0, m.dias - prazoDaDevolucao(m, 'novas', D.cfg)) });
  return linhas;
}
const FILTROS_CONSULTA = { busca: '', correspondencia: 'termos', tecnico: '', tid: '', tipo: '', origem: 'atual', regiao: '', familia: '', situacao: '', envio: '', documento: '', inicio: '', fim: '', diasMin: '', diasMax: '', qtdMin: '', qtdMax: '', responsavel: 'tecnico' };
function filtrarConsulta(linhas, f) {
  const opcoesBusca = limpar(f.busca).split(/[;,]+/).map((s) => limpar(s)).filter(Boolean);
  const nomes = normBusca(limpar(f.tecnico)).split(/\s+/).filter(Boolean);
  return linhas.filter((i) => {
    if (f.responsavel && i.tipoTec !== f.responsavel) return false;
    if (f.tid && i.tid !== f.tid) return false;
    if (f.tipo && i.tipo !== f.tipo) return false;
    if (f.origem === 'atual' && i.origem !== 'atual') return false;
    if (f.origem === 'devolvida' && !(i.origem === 'devolvida' || (i.origem === 'saida' && i.destino === 'devolucao'))) return false;
    if (f.origem === 'saida' && i.origem !== 'saida') return false;
    if (f.regiao && i.regiao !== f.regiao) return false;
    if (f.familia && i.familia !== f.familia) return false;
    if (f.situacao && (f.situacao === 'atrasada' ? !i.atrasada : f.situacao === 'em_dia' ? i.atrasada : i.status !== f.situacao)) return false;
    if (f.envio && i.tipoEnvio !== f.envio) return false;
    if (nomes.length && !nomes.every((n) => normBusca(i.nome + ' ' + i.nomeOriginal).includes(n))) return false;
    if (opcoesBusca.length && !opcoesBusca.some((termo) => {
      if (f.correspondencia === 'codigo') return normBusca(codigoMaterial(termo)) === normBusca(i.mat);
      const alvo = normBusca(i.mat + ' ' + i.desc);
      return normBusca(termo).split(/\s+/).every((p) => alvo.includes(/^\d+$/.test(p) ? codigoMaterial(p) : p));
    })) return false;
    if (f.documento && !normBusca([i.chamado, i.nf, i.remessa].join(' ')).includes(normBusca(limpar(f.documento)))) return false;
    if (f.inicio && (!i.data || i.data < f.inicio)) return false;
    if (f.fim && (!i.data || i.data > f.fim)) return false;
    for (const [campo, valor, compararValor] of [['diasMin', i.dias, (a,b) => a >= b], ['diasMax', i.dias, (a,b) => a <= b], ['qtdMin', i.qtd, (a,b) => a >= b], ['qtdMax', i.qtd, (a,b) => a <= b]]) {
      if (f[campo] !== '' && f[campo] != null && (valor == null || !compararValor(valor, Number(f[campo])))) return false;
    }
    return true;
  });
}
function periodoDesempenho(periodo, referencia = hojeISO(), personalizado = {}) {
  if (periodo === 'intervalo') {
    const { inicio, fim } = personalizado;
    const valida = data => /^\d{4}-\d{2}-\d{2}$/.test(data || '') && Number.isFinite(numDia(data)) && somaDias(data, 0) === data;
    if (!valida(inicio) || !valida(fim)) throw new Error('Informe a data inicial e a data final.');
    if (inicio > fim) throw new Error('A data final deve ser igual ou posterior à data inicial.');
    if (fim > hojeISO()) throw new Error('Selecione datas até hoje para consultar os registros.');
    return { inicio, fim, fimCivil: fim };
  }
  const dia = referencia || hojeISO();
  const semana = periodo === 'semana';
  const inicio = semana ? somaDias(dia, -((new Date(numDia(dia) * 86400000).getUTCDay() + 6) % 7)) : dia.slice(0, 7) + '-01';
  const proximoMes = new Date(numDia(inicio) * 86400000); proximoMes.setUTCMonth(proximoMes.getUTCMonth() + 1);
  const fimCivil = semana ? somaDias(inicio, 6) : somaDias(proximoMes.toISOString().slice(0, 10), -1);
  return { inicio, fim: fimCivil < hojeISO() ? fimCivil : hojeISO(), fimCivil };
}
function calcularDesempenho({ tipo = 'usadas', periodo = 'semana', referencia = hojeISO(), regiao = '', inicio: de, fim: ate, historico = null } = {}, D = derivar()) {
  const intervalo = periodoDesempenho(periodo, referencia, { inicio: de, fim: ate }), { inicio, fim } = intervalo;
  const devolvidas = historico?.devolucoes || E.devolucoes, movimentos = historico?.movimentos || E.movimentos;
  const mapa = new Map();
  const permitido = (i) => (E.cadastro[i.tid]?.tipo || 'tecnico') === 'tecnico' && (!regiao || i.regiao === regiao);
  const tecnico = (i) => {
    if (!mapa.has(i.tid)) mapa.set(i.tid, { tid: i.tid, nome: nomeTecnico(i.tid), regiao: i.regiao, atrasadas: 0, abertas: 0, encerradas: 0, maiorAtraso: 0, noPrazo: 0, devolvidas: 0, uso: 0, materiais: new Map(), evidencias: { atraso: [], pontualidade: [], uso: [] } });
    return mapa.get(i.tid);
  };
  const atual = tipo === 'usadas' ? D.itens : D.tecnicos.flatMap((t) => t.novasLinhas);
  const devolucoes = tipo === 'usadas' ? devolvidas : movimentos.filter((m) => m.destino === 'devolucao');
  // No histórico, uma peça conta uma vez; não somamos repetidamente as fotos diárias.
  const avaliarAtraso = (i, encerrada) => {
    if (!permitido(i)) return;
    const prazo = encerrada ? prazoDaDevolucao(i, tipo, D.cfg) : prazoDoTecnico(i.tid, tipo, D.cfg);
    const base = (i.dataFT || i.desde || (encerrada ? somaDias(i.em.slice(0,10), -i.dias) : '')).slice(0, 10);
    const observada = (i.desde || base).slice(0, 10);
    if (!base || observada > fim) return;
    const saida = encerrada ? i.em.slice(0,10) : null;
    const ultimo = saida && saida < fim ? saida : fim;
    const primeiroAtraso = somaDias(base, prazo + 1);
    if (ultimo < inicio || primeiroAtraso > ultimo) return;
    const t = tecnico(i), encerradaNoPeriodo = saida && saida <= fim;
    t.atrasadas += i.qtd; t[encerradaNoPeriodo ? 'encerradas' : 'abertas'] += i.qtd;
    const atraso = Math.max(0, diffDias(base, ultimo) - prazo);
    t.maiorAtraso = Math.max(t.maiorAtraso, atraso);
    t.evidencias.atraso.push({ ...i, prazo, atraso, data: saida || '', detalhe: encerradaNoPeriodo ? 'Devolvida com atraso' : 'Pendente no fim do período' });
  };
  atual.forEach((i) => avaliarAtraso(i, false));
  devolucoes.forEach((i) => {
    avaliarAtraso(i, true);
    if (!permitido(i) || i.em.slice(0,10) < inicio || i.em.slice(0,10) > fim) return;
    const t = tecnico(i), prazo = prazoDaDevolucao(i, tipo, D.cfg), emDia = i.dias <= prazo;
    t.devolvidas += i.qtd; if (emDia) t.noPrazo += i.qtd;
    t.evidencias.pontualidade.push({ ...i, prazo, data: i.em.slice(0,10), detalhe: emDia ? 'Devolvida no prazo' : 'Devolvida com atraso' });
  });
  const usos = new Map();
  if (tipo === 'usadas') {
    for (const i of [...devolvidas, ...D.itens]) {
      if (!i.dataFT || !permitido(i)) continue;
      const data = i.dataFT.slice(0,10);
      if (data < inicio || data > fim) continue;
      const chave = i.tid + '|' + i.k;
      const anterior = usos.get(chave);
      const qtd = i.qtdUso || i.qtd;
      if (!anterior || qtd > anterior.qtd) usos.set(chave, { ...i, qtd, data, detalhe: 'Troca registrada por Data FT' });
    }
  } else {
    for (const m of movimentos) if (m.destino === 'uso' && permitido(m) && m.em.slice(0,10) >= inicio && m.em.slice(0,10) <= fim) usos.set(m.k, { ...m, data: m.em.slice(0,10), detalhe: 'Uso confirmado pelo operador' });
  }
  for (const i of usos.values()) {
    const t = tecnico(i); t.uso += i.qtd;
    const mat = t.materiais.get(i.mat) || { mat: i.mat, desc: E.catalogo[i.mat] || '', qtd: 0 };
    mat.qtd += i.qtd; t.materiais.set(i.mat, mat); t.evidencias.uso.push(i);
  }
  const lista = [...mapa.values()];
  for (const t of lista) t.taxa = t.devolvidas ? t.noPrazo / t.devolvidas : null;
  const nome = (a,b) => comparar(a.nome, b.nome);
  return { ...intervalo, tipo, lista,
    atraso: lista.filter((t) => t.atrasadas > 0).sort((a,b) => b.atrasadas - a.atrasadas || b.maiorAtraso - a.maiorAtraso || nome(a,b)),
    pontualidade: lista.filter((t) => t.noPrazo > 0).sort((a,b) => b.taxa - a.taxa || b.noPrazo - a.noPrazo || nome(a,b)),
    uso: lista.filter((t) => t.uso > 0).sort((a,b) => b.uso - a.uso || nome(a,b)),
    pendentes: movimentos.filter((m) => permitido(m) && m.destino === 'pendente' && m.em.slice(0,10) >= inicio && m.em.slice(0,10) <= fim),
    semData: tipo === 'usadas' ? D.itens.filter((i) => permitido(i) && !i.dataFT).length : 0,
  };
}
async function classificarSaida(k, destino, quantidade = null, opcoes = {}) {
  exigirAdministrador();
  const recusar = mensagem => Object.assign(new Error(mensagem), { amigavel: true });
  if (!Object.hasOwn(DESTINOS_NOVAS, destino)) throw recusar('Destino inválido.');
  const condicao = destino === 'devolucao' ? opcoes.condicao : '';
  if (destino === 'devolucao' && !Object.hasOwn(CONDICOES_DEVOLUCAO, condicao)) throw recusar('Informe se a peça retorna como nova ou com RMDF aplicado.');
  const m = E.movimentos.find(i => i.k === k) || UIinventario.movimentos.find(i => i.k === k);
  if (!m) throw recusar('Saída não encontrada. Atualize o painel.');
  const esperada = opcoes.versaoEsperada ?? versaoSaida(m);
  const observacao = String(opcoes.observacao || '').trim().slice(0,300);
  const em = agoraISO(), por = identidadeAtual(), revisao = crypto.randomUUID();
  const atualizar = doc => {
    const atual = doc?.itens?.find(i => i.k === k);
    if (!atual) throw recusar('Esta importação foi desfeita ou atualizada.');
    if (versaoSaida(atual) !== esperada) throw recusar('Esta saída foi alterada por outro registro. Atualize o histórico e abra a classificação novamente.');
    const qtd = quantidade == null ? atual.qtd : Number(quantidade);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > atual.qtd) throw recusar('A quantidade deve estar entre 1 e ' + atual.qtd + '. Atualize a consulta se o saldo mudou.');
    const evento = { em, por, qtd, destino, condicao: condicao || '', observacao, anterior: { destino: atual.destino, condicao: atual.condicaoDevolucao || '' } };
    const itens = doc.itens.flatMap(i => {
      if (i.k !== k) return [i];
      const parte = { ...i, qtd, destino, condicaoDevolucao: condicao || '', observacaoClassificacao: observacao, classificadoEm: em, classificadoPor: por, revisao, classificacoes: [...(i.classificacoes || []), evento] };
      // O saldo restante conserva sua condição e seu histórico anteriores.
      return qtd === i.qtd ? [parte] : [parte, { ...i, k: `saida-${crypto.randomUUID()}`, qtd: i.qtd - qtd }];
    });
    return { ...doc, itens };
  };
  const caminho = `movimentos/${m.doc}`;
  let salvo;
  if (Acesso.modo === 'firebase') {
    salvo = await Acesso.fs.runTransaction(async tx => {
      const ref = Acesso.fs.doc(caminho), snap = await tx.get(ref);
      const doc = atualizar(snap.exists ? snap.data() : null);
      tx.set(ref, doc); return doc;
    });
  } else {
    salvo = await Armazem.enfileirar(async () => {
      const doc = atualizar(await Armazem.ler(caminho));
      await Armazem.db.doc(caminho).set(doc); return doc;
    });
  }
  const substituir = lista => [...lista.filter(i => i.doc !== m.doc), ...salvo.itens.map(i => ({ ...i, doc: m.doc }))];
  E.movimentos = substituir(E.movimentos);
  UIinventario.movimentos = substituir(UIinventario.movimentos); UIinventario.chave = null;
  mudou();
}
