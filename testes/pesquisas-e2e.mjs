// Autocomplete em dados fictícios, exclusivamente na versão local em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/pesquisas'; fs.mkdirSync(pasta, { recursive: true });
const erros = [];
async function abrir(opcoes = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce', ...opcoes });
  page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-08T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.evaluate(() => {
    E.cadastro = {
      ana: { nome: 'ANA LÚCIA', regiao: 'PR', tipo: 'tecnico', email: 'ana.lucia@exemplo.invalid', localidade: 'capital' },
      bruno: { nome: 'BRUNO SILVA', regiao: 'SC', tipo: 'tecnico', localidade: 'interior' },
      base: { nome: 'BASE EXEMPLO', regiao: 'PR', tipo: 'base' },
    };
    E.catalogo = { '111': 'Memória RAM 8 GB', '222': 'SSD NVMe 512 GB', '333': 'Tela LCD', '444': 'Peça histórica', '555': '<img src=x onerror="window.__injetado=true">' };
    const peca = (k, tid, regiao, mat) => ({ k, tid, regiao, mat, qtd: 2, dataFT: '2026-09-28', desde: '2026-09-28', chamado: 'CH-' + k, nf: 'NF-' + k, remessa: 'REM-' + k });
    E.usadas = [peca('u1', 'ana', 'PR', '111'), peca('u2', 'ana', 'PR', '222'), peca('u3', 'ana', 'PR', '111'), peca('u4', 'bruno', 'SC', '333'), peca('u5', 'ana', 'PR', '555')];
    E.novas = [peca('n1', 'ana', 'PR', '111'), peca('n2', 'bruno', 'SC', '222'), peca('n3', 'base', 'PR', '333')];
    E.devolucoes = [{ ...peca('d1', 'ana', 'PR', '444'), em: '2026-10-07', dias: 9, prazo: 7 }];
    for (let n = 0; n < 8; n++) {
      const tid = 'tec' + n;
      E.cadastro[tid] = { nome: 'TÉCNICO EXEMPLO ' + n, regiao: 'PR', tipo: 'tecnico' };
      E.usadas.push(peca('extra' + n, tid, 'PR', '111'));
    }
    E.indice.arquivos = Object.fromEntries(['usadas:PR', 'novas:PR', 'usadas:SC', 'novas:SC'].map(c => [c, { em: '2026-10-08 09:00', arquivo: c + '.csv' }]));
    mudou(); irPara('tecnicos');
    document.getElementById('toasts').innerHTML = '';
  });
  await page.addStyleTag({ content: '#aviso-armazem { display:none!important; }' });
  return page;
}
const popup = page => page.locator('.pesquisa-sugestoes:visible');
const opcoes = page => popup(page).locator('[role="option"]');
async function sugerir(page, campo, texto) {
  await campo.fill(texto);
  await page.waitForTimeout(320); // atravessa o debounce real e a reconstrução da tela
  assert.equal(await campo.evaluate(el => el === document.activeElement), true, 'digitação mantém o foco');
  assert.equal(await campo.getAttribute('aria-expanded'), 'true');
}
async function limites(page, contexto) {
  const r = await popup(page).boundingBox(), v = page.viewportSize();
  assert.ok(r.x >= 7 && r.x + r.width <= v.width - 7 && r.y >= 0 && r.y + r.height <= v.height, `${contexto}: sugestões dentro da tela`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${contexto}: sem rolagem lateral da página`);
}
try {
  const page = await abrir();
  const tecnico = page.locator('[data-digitar="busca-tc"]');
  await sugerir(page, tecnico, 'lucia');
  assert.equal(await opcoes(page).count(), 1);
  assert.match(await opcoes(page).innerText(), /Ana Lúcia.*\n.*PR/);
  await page.keyboard.press('ArrowDown');
  assert.ok(await tecnico.getAttribute('aria-activedescendant'));
  await page.keyboard.press('Enter');
  assert.equal(await tecnico.inputValue(), 'Ana Lúcia');
  assert.equal(await page.locator('.tabela tbody tr').count(), 1);
  assert.equal(await tecnico.getAttribute('aria-expanded'), 'false');
  await sugerir(page, tecnico, 'ana.lucia@');
  await opcoes(page).first().click();
  assert.equal(await tecnico.inputValue(), 'Ana Lúcia', 'contato encontra o cadastro do técnico');

  await sugerir(page, tecnico, 'tecnico');
  assert.equal(await opcoes(page).count(), 6, 'lista compacta mesmo com muitos resultados');
  await page.keyboard.press('ArrowUp');
  assert.equal(await opcoes(page).last().getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await popup(page).count(), 0);
  await tecnico.press('Enter');
  assert.equal(await tecnico.inputValue(), 'tecnico', 'Enter sem seleção pesquisa o texto, sem escolher sozinho');
  assert.equal(await page.locator('.tabela tbody tr').count(), 8);
  await tecnico.fill('nao-existe');
  await page.evaluate(() => renderizar()); // atualização externa enquanto a pessoa ainda pesquisa
  await page.keyboard.press('Tab');
  await page.waitForTimeout(320);
  assert.equal(await page.locator('.pesquisa-executar').evaluate(el => el === document.activeElement), true, 'Tab alcança a lupa sem perder foco no debounce');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => UI.tc.busca), 'nao-existe');
  await tecnico.fill('');
  await page.locator('.pesquisa-executar').click();
  assert.equal(await page.locator('.tabela tbody tr').count(), 10);

  // Mudança de página não é desfeita por uma pesquisa pendente.
  await tecnico.fill('bruno');
  await page.locator('[data-nav="usadas"]').click();
  await page.waitForTimeout(320);
  assert.equal(await page.evaluate(() => UI.pagina), 'usadas');
  const usada = page.locator('[data-digitar="busca-us"]');
  await page.locator('[data-mudar="regiao-us"]').selectOption('PR');
  await sugerir(page, usada, 'tela');
  assert.equal(await opcoes(page).count(), 0, 'não sugere peça de outra região');
  await sugerir(page, usada, 'memoria');
  assert.equal(await opcoes(page).count(), 1, 'repetições da mesma peça são agrupadas por código');
  assert.match(await opcoes(page).innerText(), /Código 111/);
  await opcoes(page).first().click();
  assert.equal(await usada.inputValue(), '111');
  assert.equal(await page.evaluate(() => UI.us.regiao), 'PR');
  assert.ok(await page.locator('#area-usadas tbody tr').count() > 1);
  await sugerir(page, usada, 'ch-u2');
  await opcoes(page).first().click();
  assert.equal(await page.locator('#area-usadas tbody tr').count(), 1);
  await sugerir(page, usada, 'img');
  assert.equal(await popup(page).locator('img').count(), 0);
  assert.equal(await page.evaluate(() => !!window.__injetado), false, 'descrições são texto, nunca HTML executável');
  await page.locator('[data-acao="aba-us"][data-aba="devolvidas"]').click();
  await sugerir(page, usada, 'historica');
  assert.equal(await opcoes(page).count(), 1);
  await opcoes(page).first().click();
  assert.equal(await usada.inputValue(), '444');

  for (const [pagina, chave] of [['cobrancas', 'busca-cob'], ['estoque', 'busca-es']]) {
    await page.evaluate(p => irPara(p), pagina);
    await sugerir(page, page.locator(`[data-digitar="${chave}"]`), 'lucia');
    await opcoes(page).first().click();
    assert.equal(await page.locator(`[data-digitar="${chave}"]`).inputValue(), 'Ana Lúcia');
  }
  await page.evaluate(() => { UIinventario.devolucoes = E.devolucoes; UIinventario.chave = chaveInventario(); UIinventario.estado = 'devolvidas'; irPara('inventario'); });
  const historico = page.locator('[data-digitar="inventario-busca"]');
  await sugerir(page, historico, 'memoria'); assert.equal(await opcoes(page).count(), 0);
  await sugerir(page, historico, 'historica'); await opcoes(page).first().click();
  assert.equal(await historico.inputValue(), '444');

  // Consulta avançada usa os filtros em edição e conserva múltiplos materiais.
  await page.evaluate(() => irPara('consulta'));
  const form = page.locator('[data-form="consulta"]');
  const peca = form.locator('[name="busca"]');
  await form.locator('[name="regiao"]').selectOption('PR');
  await sugerir(page, peca, 'tela'); assert.equal(await opcoes(page).count(), 0);
  await sugerir(page, peca, '111; ssd'); await opcoes(page).first().click();
  assert.equal(await peca.inputValue(), '111; 222');
  assert.equal(await page.evaluate(() => UIconsulta.filtros.regiao), 'PR');
  await sugerir(page, form.locator('[name="tecnico"]'), 'lucia');
  await opcoes(page).first().click();
  assert.equal(await form.locator('[name="tid"]').inputValue(), 'ana');
  await form.locator('[name="tecnico"]').fill('bruno');
  assert.equal(await form.locator('[name="tid"]').inputValue(), '', 'editar o nome remove a seleção anterior');
  await form.locator('[name="tecnico"]').fill('');
  await peca.fill('');
  await form.locator('summary').click();
  const documento = form.locator('[name="documento"]');
  await sugerir(page, documento, 'NF-u2'); await opcoes(page).first().click();
  assert.equal(await documento.inputValue(), 'NF-u2');
  assert.equal(await page.locator('.tabela-consulta tbody tr').count(), 1);

  await page.evaluate(() => irPara('relatorios'));
  await page.waitForFunction(() => relatorioPronto());
  await page.evaluate(() => modalPecasRelatorio());
  const rel = page.locator('[data-rel-peca-busca]');
  await sugerir(page, rel, 'memoria');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 1, 'primeiro Escape fecha apenas as sugestões');
  await rel.click(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  assert.equal(await rel.inputValue(), '111');
  assert.equal(await page.locator('[data-rel-pecas-lista] tbody tr').count(), 1);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.modal').count(), 0);

  // Composição de texto não deve ser interrompida pelo redesenho da página.
  await page.evaluate(() => { UI.tc.busca = ''; irPara('tecnicos'); });
  await tecnico.focus(); await tecnico.dispatchEvent('compositionstart');
  await tecnico.evaluate(el => { el.value = 'lucia'; el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })); });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => UI.tc.busca), '');
  await tecnico.dispatchEvent('compositionend'); await page.waitForTimeout(320);
  assert.equal(await page.evaluate(() => UI.tc.busca), 'lucia');
  assert.equal(await tecnico.getAttribute('aria-expanded'), 'true');
  await page.close();

  // Toque real, rolagem da lista e limites em celular/tablet/desktop, nos dois temas.
  const mobile = await abrir({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const busca = mobile.locator('[data-digitar="busca-tc"]');
  for (const tema of ['dark', 'light']) {
    await mobile.evaluate(t => document.documentElement.dataset.theme = t, tema);
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 1050]]) {
      await mobile.setViewportSize({ width, height });
      await busca.scrollIntoViewIfNeeded();
      await sugerir(mobile, busca, 'tecnico');
      await limites(mobile, `${tema}/${width}`);
      await mobile.screenshot({ path: `${pasta}/${tema}-${width}.png` });
      await opcoes(mobile).first().tap();
      assert.equal(await busca.inputValue(), 'Técnico Exemplo 0');
      assert.equal(await busca.getAttribute('aria-expanded'), 'false');
      await busca.fill('bruno'); await mobile.locator('.pesquisa-executar').tap();
      assert.equal(await mobile.locator('.tabela tbody tr').count(), 1);
    }
    await mobile.setViewportSize({ width: 390, height: 640 });
    await mobile.evaluate(() => irPara('relatorios'));
    await mobile.waitForFunction(() => relatorioPronto());
    await mobile.evaluate(() => modalPecasRelatorio());
    const relMobile = mobile.locator('[data-rel-peca-busca]');
    await sugerir(mobile, relMobile, 'memoria');
    await limites(mobile, `${tema}/janela`);
    await opcoes(mobile).first().tap();
    assert.equal(await relMobile.inputValue(), '111');
    assert.equal(await mobile.locator('[data-rel-pecas-lista] tbody tr').count(), 1);
    await mobile.keyboard.press('Escape');
    await mobile.evaluate(() => irPara('tecnicos'));
  }
  await mobile.setViewportSize({ width: 390, height: 844 });
  await sugerir(mobile, busca, 'tecnico');
  const antes = await mobile.evaluate(() => scrollY), r = await popup(mobile).boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  const x = r.x + r.width / 2, y = r.y + r.height - 25;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - n * 15 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(320);
  assert.equal(await mobile.evaluate(() => scrollY), antes, 'rolar sugestões não arrasta a página');
  assert.ok(await popup(mobile).evaluate(el => el.scrollTop > 0));
  await opcoes(mobile).last().tap();
  assert.equal(await busca.inputValue(), 'Técnico Exemplo 5');
  await sugerir(mobile, busca, 'lucia');
  await mobile.evaluate(() => { document.getElementById('acesso').hidden = false; Camadas.atualizar(); });
  assert.equal(await popup(mobile).count(), 0, 'sugestões não permanecem sobre a tela de acesso');
  await mobile.close();

  // Compatibilidade sem Popover API: a lista não fica presa em contêineres com recorte.
  const legado = await abrir();
  await legado.evaluate(() => {
    delete HTMLElement.prototype.showPopover; delete HTMLElement.prototype.hidePopover;
    UI.tc.busca = ''; renderizar(true);
  });
  const buscaLegado = legado.locator('[data-digitar="busca-tc"]');
  await sugerir(legado, buscaLegado, 'lucia');
  await opcoes(legado).first().click();
  assert.equal(await buscaLegado.inputValue(), 'Ana Lúcia');
  await sugerir(legado, buscaLegado, 'tecnico');
  await legado.evaluate(() => irPara('painel'));
  assert.equal(await legado.locator('body > .pesquisa-sugestoes').count(), 0, 'sem listas órfãs ao navegar');
  await legado.close();
  assert.deepEqual(erros, []);
  console.log('OK: sugestões nas 7 seções, filtros, seleção, lupa, teclado, composição, toque e limites nos dois temas.');
} finally { await browser.close(); }
