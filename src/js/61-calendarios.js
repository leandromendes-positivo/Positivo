/* Calendário comum a todos os campos de data. O input original conserva o valor
   ISO, as restrições e os eventos dos formulários, sem abrir o seletor nativo. */
const Calendarios = (() => {
  let aberto = null, sequencia = 0;
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const semanas = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const br = iso => iso ? iso.split('-').reverse().join('/') : '';
  const data = valor => {
    const partes = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(valor);
    if (!partes) return new Date(NaN);
    const d = new Date(0); d.setUTCHours(12);
    d.setUTCFullYear(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
    return d;
  };
  const iso = d => `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const diasDepois = (valor, n) => { const d = data(valor); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const mesDepois = (valor, n) => {
    const d = data(valor), dia = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    const fim = new Date(d); fim.setUTCMonth(fim.getUTCMonth() + 1); fim.setUTCDate(0);
    d.setUTCDate(Math.min(dia, fim.getUTCDate()));
    return iso(d);
  };

  function limparRemovido() {
    if (aberto && (!aberto.campo.isConnected || !aberto.el.isConnected)) {
      const anterior = aberto;
      aberto = null;
      anterior.botao.setAttribute('aria-expanded', 'false'); anterior.botao.removeAttribute('aria-controls');
      anterior.fechar();
    }
  }
  function preparar(raiz) {
    limparRemovido();
    raiz.querySelectorAll('input[type="date"]:not([data-calendario-pronto])').forEach(campo => {
      const rotulo = campo.getAttribute('aria-label') || campo.labels?.[0]?.querySelector('span')?.textContent || 'Data';
      const caixa = document.createElement('span'); caixa.className = 'seletor-data';
      const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'seletor-data-botao';
      botao.dataset.calendarioCampo = campo.id || campo.name || `${campo.dataset.tid || ''}:${campo.dataset.k || ''}`;
      botao.setAttribute('aria-haspopup', 'dialog'); botao.setAttribute('aria-expanded', 'false');
      campo.before(caixa); caixa.append(campo, botao);
      campo.hidden = true; campo.tabIndex = -1; campo.dataset.calendarioPronto = '';
      const atualizar = () => {
        botao.innerHTML = `<span>${esc(br(campo.value) || 'Selecionar data')}</span>${icone('calendario')}`;
        botao.classList.toggle('sem-data', !campo.value);
        botao.disabled = campo.disabled || campo.readOnly;
        botao.setAttribute('aria-label', `${rotulo}: ${br(campo.value) || 'não definida'}${campo.required ? ', obrigatório' : ''}`);
      };
      botao.addEventListener('click', () => abrir(campo, botao, rotulo));
      campo.addEventListener('input', atualizar);
      campo.addEventListener('change', atualizar);
      campo.addEventListener('invalid', e => {
        e.preventDefault();
        // A validação continua no campo ISO; o erro leva ao controle visível.
        if (!aberto) { botao.focus({ preventScroll: true }); abrir(campo, botao, rotulo, campo.validationMessage); }
      });
      campo.form?.addEventListener('reset', () => setTimeout(atualizar, 0));
      atualizar();
    });
  }

  function abrir(campo, botao, rotulo, erroInicial = '') {
    limparRemovido();
    if (aberto || campo.disabled || campo.readOnly || !campo.isConnected) return;
    const min = campo.min || '0001-01-01', max = campo.max || '9999-12-31', hoje = hojeISO();
    const limitar = valor => data(valor) < data(min) ? min : data(valor) > data(max) ? max : valor;
    const permitido = valor => /^\d{4}-\d{2}-\d{2}$/.test(valor) && valor >= min && valor <= max;
    let foco = limitar(campo.value || hoje), mes = foco.slice(0, 7);
    const id = `calendario-${++sequencia}`;
    const m = abrirModal({
      titulo: rotulo, largura: 'calendario',
      corpo: `<div class="calendario-navegacao">
          <button type="button" class="btn-icone" data-mes="-1" aria-label="Mês anterior">${icone('esquerda')}</button>
          <h3 id="${id}-mes" aria-live="polite" aria-atomic="true"></h3>
          <button type="button" class="btn-icone" data-mes="1" aria-label="Próximo mês">${icone('direita')}</button>
        </div>
        <table class="calendario-grade" role="grid" aria-labelledby="${id}-mes" aria-describedby="${id}-ajuda">
          <thead><tr>${semanas.map(d => `<th scope="col" abbr="${d}">${d.slice(0, 3)}</th>`).join('')}</tr></thead><tbody></tbody>
        </table>
        <div class="calendario-atalhos"><button type="button" class="btn pequeno" data-cal-hoje ${permitido(hoje) ? '' : 'disabled'}>Hoje</button><button type="button" class="btn fantasma pequeno" data-cal-digitar aria-expanded="${Boolean(erroInicial)}" aria-controls="${id}-digitacao">Digitar data</button><button type="button" class="btn fantasma pequeno" data-cal-limpar aria-label="Limpar data">Limpar</button></div>
        <form id="${id}-digitacao" class="calendario-digitacao" novalidate ${erroInicial ? '' : 'hidden'}>
          <label for="${id}-digitar">Data no formato dd/mm/aaaa</label>
          <div><input id="${id}-digitar" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" maxlength="10" aria-describedby="${id}-erro" value="${esc(br(campo.value))}"><button type="submit" class="btn" aria-label="Aplicar data">${icone('direita')}</button></div>
          <p id="${id}-erro" class="calendario-erro" role="alert">${esc(erroInicial)}</p>
        </form>
        <p id="${id}-ajuda" class="calendario-ajuda">Use as setas para trocar o mês. No teclado, navegue pelos dias com as setas e confirme com Enter.</p>`,
      aoFechar: () => { aberto = null; botao.setAttribute('aria-expanded', 'false'); botao.removeAttribute('aria-controls'); },
    });
    aberto = { campo, botao, el: m.el, fechar: m.fechar };
    m.el.classList.add('calendario-fundo');
    const janela = m.el.querySelector('.calendario'); janela.id = id;
    botao.setAttribute('aria-expanded', 'true'); botao.setAttribute('aria-controls', id);
    const grade = m.el.querySelector('tbody'), digitacao = m.el.querySelector('.calendario-digitacao input');
    const erro = m.el.querySelector('[role="alert"]');
    const anterior = m.el.querySelector('[data-mes="-1"]'), proximo = m.el.querySelector('[data-mes="1"]');
    function desenhar(focar = false, direcao = 0) {
      m.el.querySelector('h3').textContent = `${meses[Number(mes.slice(5)) - 1]} de ${mes.slice(0, 4)}`;
      anterior.disabled = mes <= min.slice(0, 7); proximo.disabled = mes >= max.slice(0, 7);
      const primeiro = `${mes}-01`, inicio = diasDepois(primeiro, -data(primeiro).getUTCDay());
      grade.innerHTML = Array.from({ length: 6 }, (_, linha) => `<tr>${Array.from({ length: 7 }, (_, coluna) => {
        const dia = diasDepois(inicio, linha * 7 + coluna), d = data(dia), selecionado = dia === campo.value;
        return `<td role="gridcell" aria-selected="${selecionado}"><button type="button" class="calendario-dia${dia.slice(0, 7) !== mes ? ' outro-mes' : ''}" data-cal-dia="${dia}" tabindex="${dia === foco ? '0' : '-1'}" aria-label="${esc(`${semanas[d.getUTCDay()]}, ${d.getUTCDate()} de ${meses[d.getUTCMonth()].toLowerCase()} de ${d.getUTCFullYear()}`)}" ${dia === hoje ? 'aria-current="date"' : ''} ${permitido(dia) ? '' : 'disabled'}>${d.getUTCDate()}</button></td>`;
      }).join('')}</tr>`).join('');
      if (direcao && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        grade.getAnimations().forEach(a => a.cancel());
        grade.animate([{ opacity: .3, transform: `translateX(${direcao * 8}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 140, easing: 'ease-out' });
      }
      if (focar) grade.querySelector(`[data-cal-dia="${foco}"]`)?.focus({ preventScroll: true });
    }
    function escolher(valor) {
      if (!campo.isConnected || campo.disabled || campo.readOnly) { m.fechar(); return; }
      if (valor && !permitido(valor)) return;
      const mudou = campo.value !== valor;
      campo.value = valor;
      m.fechar();
      // Os ouvintes existentes atualizam filtros, autoria e previsões em linha.
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      if (mudou) campo.dispatchEvent(new Event('change', { bubbles: true }));
    }
    m.el.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
      const direcao = Number(b.dataset.mes);
      foco = limitar(mesDepois(foco, direcao)); mes = foco.slice(0, 7); desenhar(false, direcao);
      // Ao chegar ao limite, não deixe o foco em uma seta desabilitada.
      if (b.disabled) grade.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
    }));
    grade.addEventListener('click', e => { const b = e.target.closest('[data-cal-dia]'); if (b && !b.disabled) escolher(b.dataset.calDia); });
    grade.addEventListener('keydown', e => {
      const b = e.target.closest('[data-cal-dia]'); if (!b) return;
      const atual = b.dataset.calDia, semana = data(atual).getUTCDay();
      const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -semana, End: 6 - semana }[e.key];
      if (passo === undefined && !['PageUp', 'PageDown'].includes(e.key)) return;
      e.preventDefault();
      const destino = passo !== undefined ? diasDepois(atual, passo) : mesDepois(atual, (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1));
      const novo = limitar(destino), direcao = novo.slice(0, 7) === mes ? 0 : novo < atual ? -1 : 1;
      foco = novo; mes = foco.slice(0, 7); desenhar(true, direcao);
    });
    m.el.querySelector('[data-cal-hoje]').addEventListener('click', () => escolher(hoje));
    m.el.querySelector('[data-cal-limpar]').addEventListener('click', () => escolher(''));
    m.el.querySelector('[data-cal-digitar]').addEventListener('click', e => {
      const formulario = digitacao.form;
      formulario.hidden = !formulario.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!formulario.hidden));
      if (!formulario.hidden) { digitacao.focus(); digitacao.select(); }
    });
    digitacao.addEventListener('input', () => { erro.textContent = ''; digitacao.removeAttribute('aria-invalid'); });
    m.el.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(digitacao.value.trim());
      const valor = partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : '';
      if (!valor || !Number.isFinite(data(valor).getTime()) || iso(data(valor)) !== valor || valor < '0001-01-01') erro.textContent = 'Informe uma data válida no formato dd/mm/aaaa.';
      else if (valor < min) erro.textContent = `Escolha uma data a partir de ${br(min)}.`;
      else if (valor > max) erro.textContent = `Escolha uma data até ${br(max)}.`;
      else { escolher(valor); return; }
      digitacao.setAttribute('aria-invalid', 'true'); digitacao.focus();
    });
    desenhar(true);
  }
  return { preparar, ativo: () => Boolean(aberto?.campo.isConnected && aberto.el.isConnected) };
})();
