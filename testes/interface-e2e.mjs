// Regressão dos estados de seleção, botões, avisos e janelas. Somente dados fictícios em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const saida = process.argv[2] || 'capturas/interface';
fs.mkdirSync(saida, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => {
    window.__CP_AGORA = '2026-10-05T09:00:00';
    // Resolve transparências contra as superfícies efetivamente herdadas.
    window.contrasteInterface = (el) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.canvas.width = ctx.canvas.height = 1;
      const rgb = (s) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = s; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v); };
      const sobre = (f, b) => f.slice(0, 3).map((v, i) => v * f[3] + b[i] * (1 - f[3])).concat(1);
      const luz = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const camadas = []; let atual = el;
      while (atual) { const cor = rgb(getComputedStyle(atual).backgroundColor); camadas.push(cor); if (cor[3] === 1) break; atual = atual.parentElement; }
      let fundo = [255, 255, 255, 1]; for (const c of camadas.reverse()) fundo = sobre(c, fundo);
      const estilo = getComputedStyle(el), cor = rgb(estilo.color); cor[3] *= Number(estilo.opacity);
      const a = luz(sobre(cor, fundo)), b = luz(fundo);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
  });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter((f) => f.endsWith('.csv')).map((f) => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  const contraste = async (el, contexto, minimo = 4.5) => {
    const r = await el.evaluate((e) => window.contrasteInterface(e));
    assert.ok(r >= minimo, `${contexto}: contraste ${r.toFixed(2)}:1`);
  };
  const estados = async (el, contexto) => {
    await page.mouse.move(0, 0); await el.evaluate((e) => e.blur());
    await contraste(el, contexto + '/normal');
    await el.hover(); await contraste(el, contexto + '/cursor');
    await page.mouse.move(0, 0); await el.focus(); await contraste(el, contexto + '/foco');
  };
  const dentroDaTela = async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem horizontal na página');
    assert.equal(await page.locator('.modal').evaluate((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), true, 'janela dentro da tela');
    assert.equal(await page.locator('.modal-corpo').evaluate((e) => e.scrollWidth > e.clientWidth), false, 'conteúdo da janela sem corte lateral');
  };
  for (const tema of ['dark', 'light']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== tema) await page.locator('.acoes-topo [data-acao="tema"]').click();
    await page.locator('[data-nav="usadas"]').click();
    await page.selectOption('[data-mudar="tecnico-us"]', '');
    if (await page.locator('[data-acao="lote-limpar"]').count()) await page.locator('[data-acao="lote-limpar"]').click();
    const todos = page.locator('[data-mudar="marcar-pagina"]');
    await todos.check();
    assert.equal(await page.locator('.lote-resumo strong').innerText(), '10 peças selecionadas');
    assert.match(await page.locator('.lote-resumo small').innerText(), /9 registros/);
    const duplo = await page.evaluate(() => derivar().itens.find((i) => i.qtd === 2).k);
    const selecaoDupla = page.locator(`[data-mudar="marcar"][data-k=${JSON.stringify(duplo)}]`);
    await selecaoDupla.uncheck();
    assert.equal(await todos.evaluate((e) => e.indeterminate), true);
    assert.equal(await page.locator('.lote-resumo strong').innerText(), '8 peças selecionadas');
    assert.equal(await selecaoDupla.evaluate((e) => document.activeElement === e), true, 'seleção mantém foco por teclado');
    await todos.check();
    await page.mouse.move(0, 0);
    const fundos = await page.locator('tr.selecionada').evaluateAll((es) => es.map((e) => getComputedStyle(e).backgroundColor));
    assert.equal(new Set(fundos).size, 1, 'linhas pares e ímpares preservam a seleção');
    for (const acao of ['lote-previsao', 'lote-cobranca', 'lote-limpar']) await estados(page.locator(`[data-acao="${acao}"]`), `${tema}/${acao}`);
    await page.locator('[data-acao="lote-cobranca"]').hover();
    await page.locator('.barra-lote').screenshot({ path: `${saida}/${tema}-selecao.png` });
    await page.locator('[data-acao="lote-cobranca"]').click();
    assert.match(await page.locator('.toast').last().innerText(), /um técnico só/);
    await page.evaluate(() => document.getElementById('toasts').innerHTML = '');
    await page.locator('[data-acao="lote-previsao"]').click();
    assert.equal(await page.locator('.modal-sub').innerText(), '10 peças');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await dentroDaTela();
      for (const el of await page.locator('.modal-rodape .btn').all()) await estados(el, `${tema}/previsão/${width}`);
      await page.locator('.modal').screenshot({ path: `${saida}/${tema}-previsao-${width}.png` });
    }
    const ultimo = page.locator('.modal-rodape .btn').last();
    await ultimo.focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('.modal').contains(document.activeElement)), true, 'Tab permanece na janela');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await ultimo.evaluate((e) => document.activeElement === e), true);
    const previsao = tema === 'dark' ? '2026-10-08' : '2026-10-09';
    await page.fill('#prev-data', previsao);
    await page.locator('[data-salvar]').click();
    await page.waitForFunction(() => !document.querySelector('.modal'));
    await page.waitForFunction((data) => [...document.querySelectorAll('[data-mudar="previsao-item"]')].every((e) => e.value === data), previsao);
    assert.equal(await page.locator('[data-acao="lote-previsao"]').evaluate((e) => e === document.activeElement), true, 'foco restaurado após atualizar a tabela');
    assert.match(await page.locator('.toast').last().innerText(), /10 peças/);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.barra-lote').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.barra-lote').evaluate((e) => e.scrollWidth > e.clientWidth), false);
      await page.locator('.barra-lote').screenshot({ path: `${saida}/${tema}-selecao-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-acao="lote-limpar"]').click();
    assert.equal(await page.locator('.barra-lote').count(), 0);
    await page.evaluate(() => document.getElementById('toasts').innerHTML = '');
    const tid = await page.evaluate(() => derivar().itens.find((i) => i.qtd === 2).tid);
    await page.selectOption('[data-mudar="tecnico-us"]', tid);
    await todos.check();
    await page.locator('[data-acao="lote-cobranca"]').click();
    assert.match(await page.locator('.modal-sub').innerText(), /^3 peças/);
    assert.match(await page.locator('#cob-form small').innerText(), /3 peças/);
    for (const el of await page.locator('.modal .btn').all()) await estados(el, `${tema}/cobrança/${await el.innerText()}`);
    await page.locator('.modal [data-acao="editar-tecnico"]').click();
    assert.equal(await page.locator('.modal').count(), 2);
    assert.equal(await page.locator('.modal').evaluateAll((es) => new Set(es.map((e) => e.getAttribute('aria-labelledby'))).size), 2, 'cada janela tem título próprio');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal').count(), 1, 'Escape fecha somente a janela superior');
    await page.setViewportSize({ width: 320, height: 844 }); await dentroDaTela();
    await page.locator('.modal').screenshot({ path: `${saida}/${tema}-cobranca-celular.png` });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Uma confirmação sem formulário também recebe foco; cancelar não executa a ação.
    await page.evaluate(() => { confirmar({ titulo: 'Confirmar alteração', texto: 'Revisão de interface com dados fictícios.', perigo: true }); });
    await page.waitForFunction(() => document.querySelector('.modal').contains(document.activeElement));
    for (const el of await page.locator('.modal .btn').all()) await estados(el, `${tema}/confirmação/${await el.innerText()}`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal').count(), 0);
    await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; toast('Previsão atualizada.', 'ok', { duracao: 60000, acao: 'Desfazer', aoAgir: () => { window.__acaoAviso = true; } }); });
    await estados(page.locator('.toast .btn'), `${tema}/aviso-desfazer`);
    await contraste(page.locator('.toast > .ic'), `${tema}/ícone-aviso`, 3);
    await page.locator('.toast').screenshot({ path: `${saida}/${tema}-aviso.png` });
    await page.locator('.toast .btn').click();
    assert.equal(await page.evaluate(() => window.__acaoAviso), true);
    await page.locator('[data-acao="lote-limpar"]').click();
  }
  assert.deepEqual(erros, []);
  console.log('PASSOU: contraste normal/cursor/foco, seleção parcial, quantidades, linhas selecionadas, previsão em lote, cobrança, avisos e janelas nos dois temas e no celular.');
} finally { await browser.close(); }
