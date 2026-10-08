// Calendários reais nos filtros e agendamentos; fixtures apenas na versão em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { preencherData } from './calendario-ajudante.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/calendarios'; fs.mkdirSync(pasta, { recursive: true });
const erros = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && /not focusable/.test(msg.text())) erros.push(msg.text()); });
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-08T12:00:00-03:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria', 'nunca gravar fixtures no Firebase');
  await page.evaluate(() => { Acesso.usuario = { uid: 'calendario-teste', email: 'teste.calendario@example.test' }; });
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; irPara('relatorios'); });
  await page.waitForFunction(() => relatorioPronto());
  const inicio = page.locator('[data-form="relatorios"] [name="inicio"]');
  const abrir = async campo => campo.locator('..').locator('.seletor-data-botao').click();
  const mes = page.locator('.calendario-navegacao h3');
  const manual = page.locator('.calendario-digitacao input');
  const digitar = async valor => {
    if (!(await manual.isVisible())) await page.locator('[data-cal-digitar]').click();
    await manual.fill(valor); await manual.press('Enter');
  };
  await abrir(inicio);
  assert.equal(await mes.innerText(), 'Outubro de 2026');
  assert.equal(await page.locator('[data-mes="1"]').isDisabled(), true);
  assert.equal(await page.locator('[data-cal-dia="2026-10-09"]').isDisabled(), true);
  await page.locator('[data-mes="-1"]').click();
  assert.equal(await mes.innerText(), 'Setembro de 2026');
  await page.locator('.calendario-grade').hover(); await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  assert.equal(await mes.innerText(), 'Setembro de 2026', 'scroll não troca o mês');
  assert.equal(await inicio.inputValue(), '2026-10-01', 'navegar não altera o filtro');
  await page.locator('[data-cal-dia="2026-09-16"]').click();
  assert.equal(await inicio.inputValue(), '2026-09-16');
  assert.equal(await page.evaluate(() => UIrelatorios.rascunho.inicio), '2026-09-16', 'evento input preserva o rascunho');
  assert.match(await inicio.locator('..').innerText(), /16\/09\/2026/);
  assert.equal(await inicio.locator('..').locator('button').evaluate(e => e === document.activeElement), true);
  await abrir(inicio);
  await digitar('31/02/2026');
  assert.match(await page.locator('.calendario-erro').innerText(), /data válida/);
  assert.equal(await inicio.inputValue(), '2026-09-16');
  await digitar('09/10/2026');
  assert.match(await page.locator('.calendario-erro').innerText(), /até 08\/10\/2026/);
  await digitar('29/02/2024');
  assert.equal(await inicio.inputValue(), '2024-02-29');
  await abrir(inicio);
  await page.keyboard.press('PageDown');
  assert.equal(await mes.innerText(), 'Março de 2024');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.equal(await inicio.inputValue(), '2024-03-25', 'navegação por mês, semana e dia');
  await abrir(inicio); await page.keyboard.press('Escape');
  assert.equal(await inicio.inputValue(), '2024-03-25', 'Escape não modifica a data');
  await abrir(inicio); await page.locator('[data-cal-limpar]').click();
  await page.locator('[data-form="relatorios"] [type="submit"]').click();
  assert.equal(await inicio.evaluate(e => e.validity.valueMissing), true);
  assert.equal(await page.locator('.calendario').count(), 1, 'campo obrigatório abre o controle visível');
  assert.ok(await page.locator('.calendario-erro').innerText());
  await page.locator('[data-cal-hoje]').click();
  assert.equal(await inicio.inputValue(), '2026-10-08');

  // Agendamento em um diálogo existente: min, atalhos, foco e isolamento do fundo.
  await page.evaluate(() => { irPara('cobrancas'); modalCobrar(derivar().cobrarTec[0].tid); });
  const cobranca = page.locator('#cob-prev');
  await abrir(cobranca); await page.locator('[data-mes="-1"]').click();
  assert.equal(await mes.innerText(), 'Setembro de 2026');
  assert.equal(await page.locator('[data-mes="-1"]').isDisabled(), true);
  assert.equal(await page.locator('[data-cal-dia="2026-09-07"]').isDisabled(), true);
  assert.equal(await page.locator('.modal-fundo').first().evaluate(e => e.inert), true);
  await digitar('07/09/2026');
  assert.match(await page.locator('.calendario-erro').innerText(), /a partir de 08\/09\/2026/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal-fundo').first().evaluate(e => e.inert), false);
  assert.equal(await cobranca.locator('..').locator('button').evaluate(e => e === document.activeElement), true);
  await page.locator('[data-alvo="#cob-prev"][data-data="2026-10-09"]').first().click();
  assert.match(await cobranca.locator('..').innerText(), /09\/10\/2026/, 'atalho mantém a data visível sincronizada');
  await page.keyboard.press('Escape');

  // Sem limite superior, os meses atravessam o ano e fevereiro respeita sua duração.
  await page.evaluate(() => irPara('consulta'));
  await page.locator('.consulta-avancados summary').click();
  const consulta = page.locator('[data-form="consulta"] [name="inicio"]');
  await preencherData(consulta, '2026-12-31'); await abrir(consulta);
  await page.locator('[data-mes="1"]').click();
  assert.equal(await mes.innerText(), 'Janeiro de 2027');
  await page.locator('[data-mes="1"]').click();
  assert.equal(await mes.innerText(), 'Fevereiro de 2027');
  assert.equal(await page.locator('.calendario-dia[tabindex="0"]').getAttribute('data-cal-dia'), '2027-02-28');
  for (let n = 0; n < 12; n++) await page.keyboard.press('Tab');
  assert.equal(await page.locator('.calendario').evaluate(e => e.contains(document.activeElement)), true, 'Tab fica no calendário');
  await page.keyboard.press('Escape');
  for (const [valor, tecla, seta] of [['0001-01-01', 'ArrowLeft', '-1'], ['9999-12-31', 'ArrowRight', '1']]) {
    await preencherData(consulta, valor); await abrir(consulta);
    assert.equal(await page.locator(`[data-mes="${seta}"]`).isDisabled(), true);
    await page.keyboard.press(tecla);
    assert.equal(await page.locator('.calendario-dia[tabindex="0"]').getAttribute('data-cal-dia'), valor);
    assert.doesNotMatch(await page.locator('.calendario').innerText(), /NaN|undefined/);
    await page.keyboard.press('Escape');
  }

  // Ao salvar pela tabela, o change continua atualizando a previsão e a autoria.
  await page.evaluate(() => irPara('usadas'));
  const linha = page.locator('[data-mudar="previsao-item"]').first();
  const chave = await linha.getAttribute('data-k');
  await abrir(linha); await page.locator('[data-cal-dia="2026-10-10"]').click();
  await page.waitForFunction(k => derivar().itens.find(i => i.k === k)?.previsao === '2026-10-10', chave);
  assert.equal(await page.evaluate(k => derivar().itens.find(i => i.k === k).agendadoPor?.email, chave), 'teste.calendario@example.test');
  await page.evaluate(k => modalPrevisao([derivar().itens.find(i => i.k === k)]), chave);
  await preencherData(page.locator('#prev-data'), '2026-10-12');
  await page.locator('[data-salvar]').click();
  await page.waitForFunction(k => derivar().itens.find(i => i.k === k)?.previsao === '2026-10-12', chave);
  await page.waitForFunction(() => !document.querySelector('.modal-fundo'));

  // Aparência e limites de layout, inclusive telas baixas e movimento reduzido.
  await page.evaluate(() => irPara('relatorios')); await page.waitForFunction(() => relatorioPronto());
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const tema of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
    for (const [width, height] of [[1440,1000], [768,1024], [390,844], [320,568], [844,390]]) {
      await page.setViewportSize({ width, height }); await abrir(inicio);
      assert.equal(await page.locator('.calendario').evaluate(e => {
        const r = e.getBoundingClientRect(), c = e.querySelector('.modal-corpo');
        return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && c.scrollWidth <= c.clientWidth + 1;
      }), true, `calendário sem cortes: ${tema}/${width}x${height}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      if (height >= 568) assert.equal(await page.locator('.calendario .modal-corpo').evaluate(e => e.scrollHeight <= e.clientHeight + 1), true, 'mês inteiro visível sem rolagem');
      await page.locator('[data-mes="-1"]').click();
      assert.equal(await page.locator('.calendario-grade tbody').evaluate(e => e.getAnimations().length), 0, 'respeita movimento reduzido');
      await page.screenshot({ path: `${pasta}/${tema}-${width}.png`, animations: 'disabled' });
      await page.keyboard.press('Escape');
    }
  }
  // Toque: o gesto não muda os meses nem arrasta a tela de trás.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', e => erros.push(e.message));
  await mobile.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await mobile.waitForFunction(() => E.status === 'pronto');
  assert.equal(await mobile.evaluate(() => Acesso.modo), 'memoria');
  await mobile.evaluate(() => irPara('relatorios')); await mobile.waitForFunction(() => relatorioPronto());
  await mobile.locator('.seletor-data-botao').first().tap();
  const antes = await mobile.evaluate(() => ({ posicao: document.body.style.top || getComputedStyle(document.body).top, mes: document.querySelector('.calendario h3').textContent }));
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 500 }] });
  for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 500 - n * 25 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(250);
  assert.deepEqual(await mobile.evaluate(() => ({ posicao: document.body.style.top || getComputedStyle(document.body).top, mes: document.querySelector('.calendario h3').textContent })), antes);
  assert.equal(await mobile.evaluate(() => document.querySelector('.principal').inert && getComputedStyle(document.body).position === 'fixed'), true);
  await mobile.locator('[data-mes="-1"]').tap();
  assert.notEqual(await mobile.locator('.calendario h3').innerText(), antes.mes);
  await mobile.locator('.calendario [data-fechar]').tap();
  assert.equal(await mobile.evaluate(() => document.querySelector('.principal').inert), false);
  assert.equal(await mobile.evaluate(y => Math.abs(scrollY + parseFloat(y)) < 2, antes.posicao), true, 'devolve a posição de leitura');
  // Uma janela removida pela aplicação não impede a abertura do próximo calendário.
  await abrir(inicio);
  await page.evaluate(() => { document.querySelector('.calendario-fundo').remove(); Camadas.atualizar(); renderizar(true); });
  await abrir(inicio); assert.equal(await page.locator('.calendario').count(), 1); await page.keyboard.press('Escape');
  assert.deepEqual(erros, []);
  console.log('OK: setas, scroll/toque, teclado, meses/anos, validação, filtros, agendamentos e autoria; 10 layouts nos dois temas.');
} finally { await browser.close(); }
