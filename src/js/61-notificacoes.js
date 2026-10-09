/* Alertas do estado atual. Leitura é pessoal e local; nunca altera cobranças. */
const FOCOS_COBRANCA = {
  sem_previsao: 'Cobranças há 2 dias ou mais sem previsão',
  sem_contato: 'Técnicos sem telefone ou e-mail válido',
};
function pecaCobradaSemPrevisao(i, hoje) {
  return !E.contatos.some(c=>c.detalhes?.some(d=>d.k===i.k)) && i.cobrar && !i.previsao && i.ultimaCobranca && diffDias(i.ultimaCobranca.slice(0, 10), hoje) >= 2;
}
function tecnicoNoFocoCobranca(t, foco, hoje) {
  if (!foco) return true;
  if (t.tipo !== 'tecnico' || !t.nCobrar) return false;
  if (foco === 'sem_previsao') return t.itensCobrar.some(i => pecaCobradaSemPrevisao(i, hoje));
  if (foco === 'sem_contato') return !emailValido(t.email.trim()) && !/^\d{10,15}$/.test(String(t.telefone).replace(/\D/g, ''));
  return true;
}
function registroDoUsuario(autor) { return Boolean(autor?.uid && autor.uid === identidadeAtual().uid); }
function respostaDoUsuario(i) {
  return registroDoUsuario(['confirmada','vencida'].includes(i.estadoResposta) ? i.agendadoPor : i.contato);
}
function alertasOperacionais(D = derivar()) {
  if (Acesso.modo === 'firebase' && (!Acesso.usuario?.uid || !Acesso.perfil?.ativo)) return [];
  const admin = podeAdministrar();
  const alertas = [];
  const adicionar = (a, fatos) => {
    const pagina = a.destino === 'importar' ? 'importar' : a.destino === 'estoque' ? 'estoque' : 'cobrancas';
    if (!PAGINAS[pagina] || (PAGINAS[pagina].admin && !admin)) return;
    a.pessoal = !admin && pagina === 'cobrancas';
    a.versao = hash36(JSON.stringify(fatos.map(f => JSON.stringify(f)).sort()));
    alertas.push(a);
  };
  const antigas = D.frescor.filter(f => !f.em || f.dias > 0);
  if (antigas.length) adicionar({
    id: 'planilhas', nivel: 'atencao', icone: 'arquivo', titulo: 'Atualize a base antes de cobrar',
    texto: `${plural(antigas.length, 'planilha não foi atualizada', 'planilhas não foram atualizadas')} hoje. Uma devolução recente pode ainda não aparecer no painel.`,
    detalhes: antigas.map(f => `${f.regiao} · ${f.tipo === 'usadas' ? 'Usadas' : 'Novas'} · ${f.em ? 'última atualização em ' + fmtDataHora(f.em) : 'ainda não importada'}`),
    acao: podeAdministrar() ? 'Importar planilhas' : '', destino: 'importar',
    orientacao: podeAdministrar() ? '' : 'Peça a atualização das planilhas a um administrador.',
  }, antigas.map(f => [f.regiao, f.tipo, f.em, D.hoje]));
  const vencidas = itensAgendaCompleta(D).filter(i => i.previsao < D.hoje && (admin || registroDoUsuario(i.agendadoPor)));
  if (vencidas.length) adicionar({
    id: 'previsoes', nivel: 'critico', icone: 'calendario', titulo: 'Previsões de devolução vencidas',
    texto: `${plural(somar(vencidas, i => i.qtd), 'peça continua', 'peças continuam')} no último relatório após a data combinada, com ${plural(new Set(vencidas.map(i => i.tid)).size, 'responsável', 'responsáveis')}.`,
    acao: 'Rever previsões', destino: 'vencidas',
  }, vencidas.map(i => [i.k, i.qtd, i.previsao]));
  const paradas = admin ? D.tecnicos.filter(t => tecnicoNoFocoCobranca(t, 'sem_previsao', D.hoje)) : [];
  if (paradas.length) adicionar({
    id: 'sem_previsao', nivel: 'critico', icone: 'mensagem', titulo: 'Cobranças que precisam de retorno',
    texto: `${plural(paradas.length, 'técnico tem', 'técnicos têm')} peças cobradas há 2 dias corridos ou mais, ainda pendentes e sem previsão registrada.`,
    detalhes: paradas.map(t => `${t.nome} · ${t.regiao} · ${plural(somar(t.itensCobrar.filter(i => pecaCobradaSemPrevisao(i, D.hoje)), i => i.qtd), 'peça sem previsão', 'peças sem previsão')}`),
    acao: 'Retomar cobranças', destino: 'sem_previsao',
  }, paradas.flatMap(t => t.itensCobrar.filter(i => pecaCobradaSemPrevisao(i, D.hoje)).map(i => [i.k, i.qtd, i.ultimaCobranca])));
  const semContato = admin ? D.tecnicos.filter(t => tecnicoNoFocoCobranca(t, 'sem_contato', D.hoje)) : [];
  if (semContato.length) adicionar({
    id: 'sem_contato', nivel: 'atencao', icone: 'pessoas', titulo: 'Faltam contatos para cobrar',
    texto: `${plural(semContato.length, 'técnico na fila está', 'técnicos na fila estão')} sem telefone ou e-mail válido no cadastro.`,
    detalhes: semContato.map(t => `${t.nome} · ${t.regiao}`),
    acao: 'Ver técnicos da fila', destino: 'sem_contato',
    orientacao: podeAdministrar() ? 'Atualize o contato pela ficha do técnico.' : 'Um administrador pode corrigir os contatos na ficha do técnico.',
  }, semContato.map(t => [t.tid]));
  const excesso = D.tecnicos.filter(t => t.tipo === 'tecnico' && t.estoqueConhecido && t.statusNovas === 'acima');
  if (excesso.length) adicionar({
    id: 'estoque', nivel: 'atencao', icone: 'caixa', titulo: 'Estoque acima do limite',
    texto: `${plural(excesso.length, 'técnico ultrapassou', 'técnicos ultrapassaram')} o limite de peças novas. São ${plural(somar(excesso, t => t.excessoNovas), 'peça excedente', 'peças excedentes')} para avaliar recolhimento ou redistribuição.`,
    detalhes: excesso.map(t => `${t.nome} · ${fmtNum(t.novasQtd)} peças / limite ${fmtNum(t.meta)}`),
    acao: 'Analisar excesso', destino: 'estoque',
  }, excesso.map(t => [t.tid, t.novasQtd, t.meta]));
  const respostas=acompanhamentoRespostas(D,'todas').filter(i => admin || respostaDoUsuario(i));
  for(const [estado,id,titulo,nivel,destino] of [
    ['aguardando','respostas_pendentes','Falta confirmação por e-mail','atencao','respostas_aguardando'],
    ['formalizar','cobrancas_formais','Avisos sem cobrança formal por e-mail','atencao','respostas_formalizar'],
    ['confirmada','respostas_confirmadas','Confirmações por e-mail registradas','atencao','respostas_confirmada'],
  ]){
    const linhas=respostas.filter(i=>i.estadoResposta===estado&&(estado!=='aguardando'||i.diasResposta>=1));
    if(linhas.length)adicionar({id,nivel,icone:estado==='confirmada'?'calendario':'email',titulo,
      texto:estado==='confirmada'?`${plural(somar(linhas,i=>i.qtd),'peça com previsão confirmada','peças com previsão confirmada')} por e-mail. Confira as datas e as condições informadas.`:estado==='formalizar'?`${plural(new Set(linhas.map(i=>i.tid)).size,'técnico recebeu','técnicos receberam')} aviso pelo WhatsApp, mas falta registrar o e-mail formal de cobrança.`:`${plural(somar(linhas,i=>i.qtd),'peça aguarda','peças aguardam')} confirmação por e-mail desde pelo menos ontem.`,
      detalhes:[...agrupar(linhas,i=>i.tid)].map(([tid,its])=>`${nomeTecnico(tid)} · ${plural(somar(its,i=>i.qtd),'peça','peças')}${estado==='aguardando'?` · há ${Math.max(...its.map(i=>i.diasResposta))} dia(s)`:''}`),
      acao:estado==='confirmada'?'Conferir confirmações':'Acompanhar resposta',destino,
    },linhas.map(i=>[i.k,i.qtd,i.previsao,i.agendadoEm,i.contato?.id,estado==='confirmada'?'':D.hoje]));
  }
  // Qualidade da base primeiro: não apresentar saldos antigos como confirmação de atraso.
  return alertas;
}

const Notificacoes = (() => {
  let chave = '', lidos = {}, lista = [], modal = null, filtro = 'todas', persistente = true;
  const autorizado = () => E.status === 'pronto' && (Acesso.modo !== 'firebase' || Boolean(Acesso.usuario?.uid && Acesso.perfil?.ativo));
  const chaveConta = () => `cp-notificacoes-v1-${hash36(`${Acesso.projeto || configFirebase()?.projectId || Acesso.modo}:${Acesso.usuario?.uid || E.usuario.id || 'local'}`)}`;
  function carregarLeitura() {
    lidos = {}; persistente = true;
    try {
      const dados = JSON.parse(localStorage.getItem(chave) || '{}');
      if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
        for (const [id, versao] of Object.entries(dados)) if (['planilhas','previsoes','sem_previsao','sem_contato','estoque','respostas_pendentes','cobrancas_formais','respostas_confirmadas'].includes(id) && typeof versao === 'string') lidos[id] = versao;
      }
    } catch (_) { persistente = false; }
  }
  function salvar() {
    try { localStorage.setItem(chave, JSON.stringify(lidos)); persistente = true; }
    catch (_) { persistente = false; }
  }
  const lida = a => lidos[a.id] === a.versao;
  function atualizar() {
    const botao = document.getElementById('botao-notificacoes');
    if (!botao) return;
    botao.hidden = !autorizado();
    if (!autorizado()) {
      lista = []; modal?.fechar(); modal = null; chave = ''; lidos = {};
      botao.querySelector('[data-notif-contador]').hidden = true;
      botao.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-label', 'Notificações'); return;
    }
    const novaChave = chaveConta();
    if (novaChave !== chave) { modal?.fechar(); chave = novaChave; carregarLeitura(); }
    lista = alertasOperacionais();
    // Resolvidas somem; se voltarem a ocorrer serão notificadas novamente.
    const ativos = new Set(lista.map(a => a.id));
    let alterou = false;
    for (const id of Object.keys(lidos)) if (!ativos.has(id)) { delete lidos[id]; alterou = true; }
    if (alterou) salvar();
    const n = lista.filter(a => !lida(a)).length, contador = botao.querySelector('[data-notif-contador]');
    contador.textContent = String(n); contador.hidden = !n;
    botao.setAttribute('aria-label', `Notificações, ${plural(n, 'não lida', 'não lidas')}`);
    desenhar();
  }
  function desenhar() {
    if (!modal?.el.isConnected) return;
    const el = modal.el, naoLidas = lista.filter(a => !lida(a)), visiveis = filtro === 'nao-lidas' ? naoLidas : lista;
    el.querySelector('[data-notif-resumo]').textContent = `${plural(lista.length, 'alerta ativo', 'alertas ativos')} · ${plural(naoLidas.length, 'não lido', 'não lidos')}`;
    const todasLidas = el.querySelector('[data-notif-todas-lidas]');
    if (!naoLidas.length && document.activeElement === todasLidas) el.querySelector('[data-notif-filtro="todas"]').focus({preventScroll:true});
    todasLidas.disabled = !naoLidas.length;
    el.querySelectorAll('[data-notif-filtro]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.notifFiltro === filtro)));
    el.querySelector('[data-notif-escopo]').textContent = podeAdministrar() ? 'Administrador · todos os alertas da operação' : 'Suas cobranças e agendamentos · estoque das áreas permitidas';
    el.querySelector('[data-notif-local]').textContent = persistente ? 'A leitura é salva para sua conta neste navegador. Marcar como lido não resolve a pendência.' : 'O navegador não permitiu salvar a leitura. Ela será mantida apenas enquanto esta página estiver aberta.';
    const area = el.querySelector('[data-notif-lista]');
    const html = visiveis.map(a => `<article class="notif-item ${lida(a) ? 'lida' : 'nao-lida'}" data-notif-id="${a.id}">
      <span class="notif-icone ${a.nivel}" aria-hidden="true">${icone(a.icone)}</span><div class="notif-conteudo">
      <div class="notif-meta"><span class="${a.nivel}">${a.nivel === 'critico' ? 'Prioridade' : 'Atenção'}</span><span>${lida(a) ? 'Lida' : 'Não lida'}</span></div>
      <h3>${esc(a.titulo)}</h3><p>${esc(a.texto)}</p>
      ${a.detalhes?.length ? `<details data-notif-detalhes="${a.id}"><summary>Ver detalhes (${a.detalhes.length})</summary><ul>${a.detalhes.map(d => `<li>${esc(d)}</li>`).join('')}</ul></details>` : ''}
      ${a.orientacao ? `<p class="nota">${esc(a.orientacao)}</p>` : ''}
      <div class="notif-acoes">${a.acao ? `<button type="button" class="link-forte" data-notif-destino="${a.id}">${esc(a.acao)}${icone('direita')}</button>` : ''}<button type="button" class="link" data-notif-leitura="${a.id}" aria-label="${lida(a) ? 'Marcar como não lida' : 'Marcar como lida'}: ${esc(a.titulo)}">${icone(lida(a) ? 'sino' : 'ok')}${lida(a) ? 'Marcar como não lida' : 'Marcar como lida'}</button></div>
      </div></article>`).join('') || vazio('ok', filtro === 'nao-lidas' && lista.length ? 'Você leu todos os alertas' : 'Nenhum alerta no momento', filtro === 'nao-lidas' && lista.length ? 'As pendências ainda ativas continuam na aba Todas.' : !Object.keys(E.indice.arquivos || {}).length ? 'Importe as planilhas para começar o acompanhamento.' : 'As regras monitoradas não encontraram pendências nos dados disponíveis.');
    if (area.dataset.conteudo === html) return;
    const aberto = [...area.querySelectorAll('details[open]')].map(d => d.dataset.notifDetalhes);
    const ativo = document.activeElement, atributo = ['data-notif-leitura', 'data-notif-destino'].find(a => ativo?.hasAttribute(a));
    const alvo = atributo && ativo.getAttribute(atributo), scroll = el.querySelector('.modal-corpo').scrollTop;
    area.innerHTML = html; area.dataset.conteudo = html;
    for (const id of aberto) { const detalhe = area.querySelector(`[data-notif-detalhes="${id}"]`); if (detalhe) detalhe.open = true; }
    if (atributo) (area.querySelector(`[${atributo}="${alvo}"]`) || el.querySelector('[data-notif-filtro="nao-lidas"]')).focus({ preventScroll: true });
    el.querySelector('.modal-corpo').scrollTop = scroll;
  }
  function abrirDestino(a) {
    UI.cob.somenteMeus = Boolean(a.pessoal);
    if (a.destino === 'importar') { if (podeAdministrar()) irPara('importar'); }
    else if (a.destino === 'estoque') { Object.assign(UI.es, {regiao:'',status:'acima',busca:'',bases:false}); irPara('estoque'); }
    else if(a.destino.startsWith('respostas_')){Object.assign(UI.cob,{aba:'respostas',tipo:'todas',resposta:a.destino.slice(10),foco:'',regiao:'',busca:''});irPara('cobrancas');}
    else {
      Object.assign(UI.cob, {tipo:a.destino==='vencidas'?'todas':'usadas',aba:a.destino === 'vencidas' ? 'vencidas' : 'cobrar', foco:FOCOS_COBRANCA[a.destino] ? a.destino : '', regiao:'', busca:'', ordem:'dias'});
      UI.cob.abertos.clear(); irPara('cobrancas');
    }
    const titulo = document.getElementById('titulo'); titulo.setAttribute('tabindex','-1'); titulo.focus({preventScroll:true});
  }
  function abrir() {
    atualizar();
    if (!autorizado() || modal?.el.isConnected) return;
    filtro = 'todas';
    modal = abrirModal({titulo:'Notificações', subtitulo:'O que precisa da sua atenção', largura:'notificacoes',
      corpo:`<div class="notif-resumo"><strong data-notif-resumo role="status"></strong><span data-notif-escopo></span></div><div class="notif-filtros" role="group" aria-label="Filtrar notificações"><button type="button" class="chip" data-notif-filtro="todas" aria-pressed="true">Todas</button><button type="button" class="chip" data-notif-filtro="nao-lidas" aria-pressed="false">Não lidas</button></div><div data-notif-lista></div>`,
      rodape:`<p class="nota" data-notif-local></p><button type="button" class="btn" data-notif-todas-lidas>${icone('ok')}Marcar todas como lidas</button>`,
      aoFechar:() => { modal = null; document.getElementById('botao-notificacoes').setAttribute('aria-expanded','false'); },
    });
    modal.el.classList.add('notificacoes-fundo');
    document.getElementById('botao-notificacoes').setAttribute('aria-expanded','true');
    modal.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-notif-filtro')) { filtro = b.dataset.notifFiltro; desenhar(); }
      if (b.hasAttribute('data-notif-todas-lidas')) { for (const a of lista) lidos[a.id] = a.versao; salvar(); atualizar(); }
      const a = lista.find(a => a.id === (b.dataset.notifLeitura || b.dataset.notifDestino));
      if (!a) return;
      if (b.dataset.notifLeitura) { if (lida(a)) delete lidos[a.id]; else lidos[a.id] = a.versao; salvar(); atualizar(); }
      if (b.dataset.notifDestino) { lidos[a.id] = a.versao; salvar(); modal.fechar(); atualizar(); abrirDestino(a); }
    });
    desenhar();
  }
  function iniciar() {
    aoMudar.add(atualizar);
    window.addEventListener('storage', e => { if (chave && (e.key === chave || e.key === null)) { carregarLeitura(); atualizar(); } });
    atualizar();
  }
  return { iniciar, atualizar, abrir };
})();
