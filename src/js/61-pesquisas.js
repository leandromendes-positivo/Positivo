/* Sugestões locais: usam os dados já autorizados e os filtros da tela atual. */
const Pesquisas = (() => {
  const campos = new WeakMap();
  let ativo = null, sequencia = 0, quadro = 0;

  function contexto(campo) {
    const D = () => derivar(), chave = campo.dataset.digitar;
    if (chave === 'busca-cob') return { nome: 'Buscar técnico nas cobranças', tipos: ['tecnico'], linhas: () => filtrarCobrancas(D(), { ...UI.cob, busca: '' }) };
    if (chave === 'busca-es') return { nome: 'Buscar técnico no estoque', tipos: ['tecnico'], linhas: () => filtrarEstoque(D(), { ...UI.es, busca: '' }) };
    if (chave === 'busca-tc') return { nome: 'Buscar nome, telefone ou e-mail do técnico', tipos: ['tecnico'], linhas: () => filtrarTecnicos(D(), { ...UI.tc, busca: '' }) };
    if (chave === 'busca-us') return { nome: 'Buscar peça, técnico ou documento', tipos: ['peca', 'tecnico', 'documento'], linhas: () => UI.us.aba === 'devolvidas' ? filtrarDevolvidas({ ...UI.us, busca: '' }).map(i => ({ ...i, nome: nomeTecnico(i.tid), desc: E.catalogo[i.mat] || '', nf: '', remessa: '' })) : filtrarUsadas(D(), { ...UI.us, busca: '' }) };
    if (chave === 'inventario-busca') return { nome: 'Buscar peça, técnico ou documento no histórico', tipos: ['peca', 'tecnico', 'documento'], linhas: () => filtrarInventario(linhasInventario(), { ...UIinventario, busca: '' }).map(i => ({ ...i, remessa: '' })) };
    if (campo.form?.dataset.form === 'consulta') {
      const tipos = { busca: ['peca'], tecnico: ['tecnico'], documento: ['documento'] }[campo.name];
      if (!tipos) return null;
      return { nome: { busca: 'Buscar nome ou código da peça', tecnico: 'Buscar nome do técnico', documento: 'Buscar chamado, NF ou remessa' }[campo.name], tipos, multipla: campo.name === 'busca', linhas: () => {
        const filtros = { ...FILTROS_CONSULTA, ...Object.fromEntries(new FormData(campo.form)), [campo.name]: '' };
        if (campo.name === 'tecnico') filtros.tid = '';
        return filtrarConsulta(linhasConsulta(), filtros);
      } };
    }
    return null;
  }

  function candidatos(config) {
    const unicos = new Map();
    const adicionar = (tipo, valor, titulo, descricao, termos = '', linha = {}) => {
      valor = String(valor || '').trim();
      if (!valor) return;
      const chave = `${tipo}:${normBusca(valor)}`;
      if (!unicos.has(chave)) unicos.set(chave, { chave, tipo, valor, titulo, descricao, termos: new Set(), regioes: new Set(), tids: new Set() });
      const c = unicos.get(chave); c.termos.add(termos);
      if (linha.regiao) c.regioes.add(linha.regiao);
      if (linha.tid) c.tids.add(linha.tid);
    };
    for (const i of config.linhas()) {
      if (config.tipos.includes('tecnico')) {
        const nome = i.nome || nomeTecnico(i.tid);
        adicionar('tecnico', nome, nome, 'Responsável', [i.nomeOriginal, i.telefone, i.email].filter(Boolean).join(' '), i);
      }
      if (config.tipos.includes('peca')) adicionar('peca', i.mat, i.desc || E.catalogo[i.mat] || i.mat, `Código ${i.mat}`);
      if (config.tipos.includes('documento')) for (const [campo, nome] of [['chamado', 'Chamado'], ['nf', 'NF'], ['remessa', 'Remessa']]) adicionar(campo, i[campo], i[campo], nome);
    }
    return [...unicos.values()].map(c => ({ ...c,
      descricao: c.tipo === 'tecnico' ? `${c.tids.size > 1 ? plural(c.tids.size, 'cadastro', 'cadastros') : 'Responsável'}${c.regioes.size ? ' · ' + [...c.regioes].sort().join(', ') : ''}` : c.descricao,
      alvo: normBusca([c.valor, c.titulo, ...c.termos].join(' ')),
      tid: c.tids.size === 1 ? [...c.tids][0] : '',
    }));
  }

  function sugestoes(config, texto) {
    const trecho = config.multipla ? texto.split(/[;,]/).at(-1) : texto;
    const busca = normBusca(trecho.trim());
    if (!busca) return [];
    const termos = busca.split(/\s+/).map(t => config.tipos.length === 1 && config.tipos[0] === 'peca' && /^\d+$/.test(t) ? codigoMaterial(t) : t);
    const prioridade = c => normBusca(c.valor) === busca || normBusca(c.titulo) === busca ? 0 : normBusca(c.valor).startsWith(busca) || normBusca(c.titulo).startsWith(busca) ? 1 : 2;
    return candidatos(config).filter(c => termos.every(t => c.alvo.includes(t)))
      .sort((a, b) => prioridade(a) - prioridade(b) || comparar(a.titulo, b.titulo) || comparar(a.valor, b.valor)).slice(0, 6);
  }

  function fechar(raiz) {
    if (!ativo || (raiz && !raiz.contains(ativo.campo))) return;
    const s = ativo; ativo = null;
    if (s.popup.hidePopover && s.popup.matches(':popover-open')) s.popup.hidePopover();
    s.popup.hidden = true;
    if (!s.campo.isConnected) s.popup.remove();
    else if (!s.popup.showPopover) s.controle.append(s.popup);
    s.campo.setAttribute('aria-expanded', 'false'); s.campo.removeAttribute('aria-activedescendant');
    s.status.textContent = ''; s.indice = -1;
  }

  function posicionar() {
    if (!ativo) return;
    const { campo, controle, popup } = ativo;
    if (!campo.isConnected || campo.closest('[inert]') || !campo.getClientRects().length) { fechar(); return; }
    const r = controle.getBoundingClientRect(), v = window.visualViewport;
    const x = v?.offsetLeft || 0, y = v?.offsetTop || 0, largura = v?.width || innerWidth, altura = v?.height || innerHeight;
    if (r.bottom <= y || r.top >= y + altura || r.right <= x || r.left >= x + largura) { fechar(); return; }
    const w = Math.min(Math.max(r.width, 310), largura - 16);
    popup.style.width = `${w}px`; popup.style.left = `${Math.max(x + 8, Math.min(r.left, x + largura - w - 8))}px`;
    const abaixo = y + altura - r.bottom - 12, acima = r.top - y - 12;
    const inverter = abaixo < 150 && acima > abaixo;
    const espaco = Math.max(0, Math.min(340, inverter ? acima : abaixo));
    if (espaco < 60) { fechar(); return; }
    popup.style.maxHeight = `${espaco}px`;
    popup.style.top = `${inverter ? Math.max(y + 8, r.top - popup.getBoundingClientRect().height - 6) : r.bottom + 6}px`;
  }

  function destacar(s, indice) {
    s.indice = indice;
    s.popup.querySelectorAll('[role="option"]').forEach((el, n) => el.setAttribute('aria-selected', String(n === indice)));
    const opcao = s.popup.querySelector(`[data-indice="${indice}"]`);
    if (opcao) { s.campo.setAttribute('aria-activedescendant', opcao.id); opcao.scrollIntoView({ block: 'nearest' }); }
    else s.campo.removeAttribute('aria-activedescendant');
  }

  function mostrar(campo, chaveAtiva = '') {
    const s = campos.get(campo);
    if (!s || s.compondo || !campo.isConnected || !campo.value.trim() || campo.disabled || campo.readOnly) { fechar(); return; }
    if (ativo && ativo !== s) fechar();
    s.opcoes = sugestoes(s.config, campo.value);
    s.popup.innerHTML = `<div class="pesquisa-sugestoes-titulo">Sugestões nos filtros atuais<span>${s.opcoes.length ? 'Até 6' : '0'}</span></div><div id="${s.id}-lista" role="listbox" aria-label="Sugestões de pesquisa">${s.opcoes.map((c, n) => `<div id="${s.id}-opcao-${n}" role="option" aria-selected="false" class="pesquisa-opcao" data-indice="${n}" data-valor="${esc(c.valor)}">${icone(c.tipo === 'tecnico' ? 'pessoa' : c.tipo === 'peca' ? 'caixa' : 'arquivo')}<span><strong>${esc(c.titulo)}</strong><small>${esc(c.descricao)}</small></span>${icone('seta')}</div>`).join('')}</div>${s.opcoes.length ? '<div class="pesquisa-sugestoes-ajuda">↑ ↓ para escolher · Enter para pesquisar</div>' : '<p class="pesquisa-sem-sugestao">Nenhuma sugestão neste filtro. A lupa pesquisa o texto digitado.</p>'}`;
    if (!s.popup.showPopover) (campo.closest('.modal-fundo') || document.body).append(s.popup);
    s.popup.hidden = false; ativo = s;
    if (s.popup.showPopover && !s.popup.matches(':popover-open')) s.popup.showPopover();
    campo.setAttribute('aria-expanded', 'true');
    s.status.textContent = s.opcoes.length ? `${s.opcoes.length} sugestões. Use as setas para escolher e Enter para pesquisar.` : 'Nenhuma sugestão nos filtros atuais.';
    posicionar(); destacar(s, s.opcoes.findIndex(c => c.chave === chaveAtiva));
  }

  function executar(s, opcao) {
    if (!s.campo.isConnected || s.compondo || s.campo.disabled || s.campo.readOnly) return;
    const { campo } = s;
    if (opcao) campo.value = s.config.multipla && /[;,]/.test(campo.value) ? campo.value.replace(/[^;,]*$/, ' ' + opcao.valor) : opcao.valor;
    if (campo.form?.dataset.form === 'consulta' && campo.name === 'tecnico') campo.form.elements.tid.value = opcao?.tid || '';
    fechar(); aplicarBusca.cancelar();
    if (campo.dataset.digitar) {
      const chave = campo.dataset.digitar;
      DIGITACAO[chave](campo.value); renderizar(true);
      document.querySelector(`[data-digitar="${chave}"]`)?.focus({ preventScroll: true });
    } else if (s.config.executar) s.config.executar();
    else campo.form?.requestSubmit();
  }

  function registrar(campo, config) {
    if (!config || campos.has(campo)) return;
    const id = `pesquisa-${++sequencia}`;
    const controle = document.createElement('span'); controle.className = 'pesquisa-controle';
    campo.closest('.busca-campo, .consulta-entrada')?.classList.add('pesquisa-aprimorada');
    campo.before(controle); controle.append(campo);
    const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'pesquisa-executar';
    botao.setAttribute('aria-label', config.nome); botao.title = 'Pesquisar'; botao.innerHTML = icone('busca');
    controle.append(botao);
    const popup = document.createElement('div'); popup.className = 'pesquisa-sugestoes'; popup.hidden = true;
    popup.innerHTML = `<div id="${id}-lista" role="listbox" aria-label="Sugestões de pesquisa"></div>`;
    // A camada nativa evita recortes pelos cartões e mantém a janela modal acessível.
    if ('showPopover' in popup) popup.setAttribute('popover', 'manual');
    controle.append(popup);
    const status = document.createElement('span'); status.className = 'pesquisa-leitor'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); controle.append(status);
    const s = { id, campo, controle, popup, status, config, indice: -1, opcoes: [], compondo: false };
    campos.set(campo, s);
    campo.setAttribute('role', 'combobox'); campo.setAttribute('aria-autocomplete', 'list'); campo.setAttribute('aria-haspopup', 'listbox');
    campo.setAttribute('aria-expanded', 'false'); campo.setAttribute('aria-controls', `${id}-lista`); campo.setAttribute('aria-label', config.nome);
    campo.autocomplete = 'off'; campo.spellcheck = false;
    campo.addEventListener('input', () => {
      if (campo.form?.dataset.form === 'consulta' && campo.name === 'tecnico') campo.form.elements.tid.value = '';
      mostrar(campo);
    });
    campo.addEventListener('click', () => mostrar(campo));
    campo.addEventListener('compositionstart', () => { s.compondo = true; aplicarBusca.cancelar(); fechar(); });
    campo.addEventListener('compositionend', () => {
      s.compondo = false; mostrar(campo);
      if (campo.dataset.digitar) { DIGITACAO[campo.dataset.digitar](campo.value); aplicarBusca(campo); }
    });
    campo.addEventListener('blur', () => setTimeout(() => { if (ativo === s && !s.tocando && !controle.contains(document.activeElement) && !popup.contains(document.activeElement)) fechar(); }, 0));
    campo.addEventListener('keydown', e => {
      if (e.isComposing || s.compondo) return;
      if (e.key === 'Escape' && ativo === s) { e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if (e.key === 'Tab') { fechar(); return; }
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
        if (ativo !== s) mostrar(campo);
        if (!s.opcoes.length || ativo !== s) return;
        e.preventDefault();
        destacar(s, (s.indice + (e.key === 'ArrowDown' ? 1 : s.indice < 0 ? 0 : -1) + s.opcoes.length) % s.opcoes.length);
      } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); executar(s, ativo === s ? s.opcoes[s.indice] : null); }
    });
    botao.addEventListener('click', e => { e.preventDefault(); executar(s); });
    botao.addEventListener('focus', () => aplicarBusca.cancelar());
    botao.addEventListener('pointerdown', () => aplicarBusca.cancelar());
    popup.addEventListener('pointerdown', e => { s.tocando = true; aplicarBusca.cancelar(); if (e.pointerType !== 'touch') e.preventDefault(); });
    const terminarToque = () => { s.tocando = false; };
    popup.addEventListener('pointerup', terminarToque);
    popup.addEventListener('pointercancel', terminarToque);
    popup.addEventListener('pointermove', e => {
      const opcao = e.target.closest('[data-indice]');
      if (opcao && e.pointerType === 'mouse' && s.indice !== Number(opcao.dataset.indice)) destacar(s, Number(opcao.dataset.indice));
    });
    popup.addEventListener('click', e => { const opcao = e.target.closest('[data-indice]'); if (opcao) { e.preventDefault(); executar(s, s.opcoes[Number(opcao.dataset.indice)]); } });
  }

  function preparar(raiz) {
    if (ativo && !ativo.campo.isConnected) fechar();
    raiz.querySelectorAll('input[type="search"]').forEach(campo => registrar(campo, contexto(campo)));
  }
  const estado = campo => ativo?.campo === campo ? { aberto: true, chave: ativo.opcoes[ativo.indice]?.chave } : { aberto: false };
  function restaurar(campo, anterior) { if (anterior.aberto) mostrar(campo, anterior.chave); }
  document.addEventListener('pointerdown', e => {
    if (!ativo || ativo.controle.contains(e.target) || ativo.popup.contains(e.target)) return;
    const campo = ativo.campo; fechar();
    if (campo.dataset.digitar) aplicarBusca(campo);
  });
  const reposicionar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(posicionar); };
  document.addEventListener('scroll', reposicionar, { capture: true, passive: true });
  window.addEventListener('resize', reposicionar, { passive: true });
  window.visualViewport?.addEventListener('resize', reposicionar, { passive: true });
  window.visualViewport?.addEventListener('scroll', reposicionar, { passive: true });
  return { preparar, registrar, fechar, estado, restaurar, compondo: campo => campos.get(campo)?.compondo || false };
})();
