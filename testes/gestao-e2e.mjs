// Indicadores, risco por estado e visual das telas com dados fictícios locais.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const saida = process.argv[2] || 'capturas/gestao';
fs.mkdirSync(saida, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, colorScheme: 'dark' });
  const erros = []; page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter((f) => f.endsWith('.csv')).map((f) => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  await page.locator('[data-nav="painel"]').click();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.locator('.kpi-arte').first().evaluate(async (e) => { const img = new Image(); img.src = getComputedStyle(e).backgroundImage.slice(5,-2); await img.decode(); });
  assert.equal(await page.locator('.kpi-operacional').count(), 4);
  const ordem = await page.evaluate(() => {
    const p = document.querySelector('.indicadores-operacao').getBoundingClientRect();
    const fila = document.querySelector('.cartao-fila').getBoundingClientRect();
    return p.bottom < fila.top;
  });
  assert.equal(ordem, true);
  assert.deepEqual(await page.locator('.kpi-usadas .kpi-partes strong').allTextContents(), ['5', '5']);
  assert.deepEqual(await page.locator('.kpi-cobrancas .kpi-partes strong').allTextContents(), ['3', '0']);
  assert.deepEqual(await page.locator('.kpi-estoque .kpi-partes strong').allTextContents(), ['2', '3', '0']);

  // O estado amplia sem alterar a cor de risco, o estado selecionado ou o alvo do clique.
  const estado = page.locator('.mapa-estado[data-uf="PR"]');
  await estado.scrollIntoViewIfNeeded();
  const antes = await estado.evaluate((el) => ({ caixa: el.getBoundingClientRect().toJSON(), cor: getComputedStyle(el.querySelector('path')).fill, selecionado: UIpainel.regiao }));
  await estado.locator('path').hover();
  await page.waitForFunction(() => document.querySelector('.mapa-destaque[data-uf="PR"]') && new DOMMatrix(getComputedStyle(document.querySelector('.mapa-destaque')).transform).a > 1.1);
  const depois = await estado.evaluate((el) => {
    const destaque = document.querySelector('.mapa-destaque');
    return { largura: el.getBoundingClientRect().width, ampliada: destaque.getBoundingClientRect().width, cor: getComputedStyle(destaque.querySelector('path')).fill, eventos: getComputedStyle(destaque).pointerEvents, selecionado: UIpainel.regiao };
  });
  assert.equal(depois.largura, antes.caixa.width);
  assert.ok(depois.ampliada > depois.largura);
  assert.equal(depois.cor, antes.cor);
  assert.equal(depois.eventos, 'none');
  assert.equal(depois.selecionado, antes.selecionado);
  await page.locator('.cartao-mapa').screenshot({ path: `${saida}/mapa-ampliado.png`, animations: 'disabled' });
  await page.mouse.move(10, 10);
  await page.waitForFunction(() => !document.querySelector('.mapa-destaque'));
  await page.keyboard.press('Tab');
  await estado.focus();
  await page.waitForFunction(() => !!document.querySelector('.mapa-destaque'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.mapa-destaque'));
  await estado.evaluate((el) => el.blur());

  const metricas = await page.evaluate(() => {
    const D = { hoje: '2026-10-05', cfg: { prazo: 7 }, kpi: { usadas: 5, atrasadas: 2 },
      itens: [{ regiao: 'PR', qtd: 3, dias: 4 }, { regiao: 'PR', qtd: 2, dias: 20, atrasada: true }],
      cobrarTec: [{ ultimaCobranca: null }, { ultimaCobranca: { em: '2026-10-05T08:00:00' } }],
      frescor: [{ tipo: 'novas', regiao: 'PR', em: '2026-10-05T09:00:00' }],
      tecnicos: [
        { tipo: 'tecnico', temDados: true, regiao: 'PR', novasQtd: 3, meta: 10, statusNovas: 'ideal' },
        { tipo: 'tecnico', temDados: true, regiao: 'PR', novasQtd: 20, meta: 10, statusNovas: 'acima' },
        { tipo: 'tecnico', temDados: true, regiao: 'SC', novasQtd: 0, meta: 10, statusNovas: 'ideal' },
      ] };
    const a = indicadoresOperacionais(D);
    return [a.noPrazo, a.idadeMedia, a.criticas, a.semContatoHoje, a.estoque.dentro.length, a.excesso, riscoEstado(D, { regiao: 'PR', total: 5 }, false).percentual];
  });
  assert.deepEqual(metricas, [.6, 10.4, 2, 1, 1, 10, 40]);
  assert.deepEqual(await page.evaluate(() => [0, 10, 25, 50, 75].map((n) => riscoEstado({}, { acima: n, ideal: 100 - n }, true).nivel)), ['baixo', 'baixo', 'moderado', 'alto', 'critico']);
  assert.equal(await page.evaluate(() => riscoEstado({ itens: [] }, { regiao: 'PR', total: 0 }, false).percentual), 0);
  // Uma planilha vazia já importada é dado conhecido; não equivale a ausência de relatório.
  assert.equal(await page.evaluate(() => dadosMapa({ porRegiao: [], frescor: [{ regiao: 'AC', tipo: 'usadas', em: '2026-10-05' }] })[0].total), 0);

  const parcial = await browser.newPage();
  await parcial.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await parcial.waitForFunction(() => E.status === 'pronto');
  assert.equal(await parcial.evaluate(() => Acesso.modo), 'memoria');
  await parcial.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter((f) => f.endsWith('.csv') && f !== 'SC Novas.csv').map((f) => path.resolve('exemplos', f)));
  await parcial.waitForFunction(() => !!UI.im.resultado);
  await parcial.locator('[data-nav="estoque"]').click();
  assert.equal(await parcial.locator('.kpi-valor').nth(2).innerText(), '1', 'SC sem relatório não conta como estoque dentro do limite');
  assert.match(await parcial.locator('.tabela-estoque tbody tr').filter({ hasText: 'Carlos' }).innerText(), /Sem relatório/);
  await parcial.close();

  // Quatro níveis de risco devem continuar distintos, inclusive quando selecionados.
  const cores = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'mapa-brasil';
    el.innerHTML = '<svg>' + ['baixo','moderado','alto','critico'].map((n) => `<g class="mapa-estado risco-${n} selecionado"><path d="M0 0H10V10Z"/></g>`).join('') + '</svg>';
    document.body.append(el);
    const c = [...el.querySelectorAll('path')].map((p) => getComputedStyle(p).fill); el.remove(); return c;
  });
  assert.equal(new Set(cores).size, 4);
  // A base neutra não deve apagar as cores funcionais nem prejudicar a leitura.
  for (const tema of ['dark', 'light']) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== tema) await page.locator('.acoes-topo [data-acao="tema"]').click();
    const paleta = await page.evaluate(() => {
      const luminancia = (cor) => {
        const c = cor.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
      };
      const contraste = (a, b) => { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const probe = document.createElement('span'); document.body.append(probe);
      const cor = (v) => { probe.style.color = `var(--${v})`; return getComputedStyle(probe).color; };
      const razoes = ['ink', 'muted', 'good-ink', 'warn-ink', 'crit-ink', 'info-ink'].map((v) => [v, contraste(cor(v), cor('surface'))]);
      razoes.push(['ação principal', contraste(cor('accent-ink'), cor('accent'))]);
      const botao = getComputedStyle(document.querySelector('.acoes-topo .btn.prim'));
      razoes.push(['botão renderizado', contraste(botao.color, botao.backgroundColor)]);
      const categorias = [...document.querySelectorAll('.kpi-icone')].map((e) => getComputedStyle(e).color);
      const el = document.createElement('div');
      el.className = 'mapa-brasil';
      el.innerHTML = '<svg>' + ['baixo','moderado','alto','critico'].map((n) => `<g class="mapa-estado risco-${n}"><path d="M0 0H10V10Z"/><text>UF</text></g>`).join('') + '</svg>';
      document.body.append(el);
      for (const g of el.querySelectorAll('g')) razoes.push([g.className.baseVal, contraste(getComputedStyle(g.querySelector('text')).fill, getComputedStyle(g.querySelector('path')).fill)]);
      probe.remove(); el.remove();
      return { categorias, razoes };
    });
    assert.equal(new Set(paleta.categorias).size, 4, `categorias distintas: ${tema}`);
    for (const [nome, razao] of paleta.razoes) assert.ok(razao >= 4.5, `contraste ${tema}/${nome}: ${razao.toFixed(2)}`);
  }
  await page.locator('.acoes-topo [data-acao="tema"]').click();
  const card = page.locator('.kpi-operacional').first();
  await card.hover({ position: { x: 20, y: 20 } });
  await page.waitForFunction(() => document.querySelector('.kpi-operacional').style.getPropertyValue('--inclina-x') !== '');
  await page.mouse.move(10, 10);
  assert.equal(await card.evaluate((el) => el.style.getPropertyValue('--inclina-x')), '');

  // Os atalhos dos indicadores limpam os filtros de consultas anteriores.
  await page.evaluate(() => { UI.us.regiao = 'ZZ'; UI.us.busca = 'antigo'; UI.us.sel.add('invisivel'); });
  await card.click();
  assert.deepEqual(await page.evaluate(() => [UI.us.regiao, UI.us.busca, UI.us.status, UI.us.sel.size]), ['', '', 'todas', 0]);
  assert.equal(await page.locator('[data-acao="aba-us"][data-aba="pendentes"] .contador').innerText(), '10', 'soma peças, inclusive chamados com mais de uma unidade');
  assert.equal(await page.locator('[data-acao="status-us"][data-status="todas"] span').innerText(), '10');
  await page.locator('[data-nav="painel"]').click();
  await page.evaluate(() => { UI.es.regiao = 'ZZ'; UI.es.status = 'acima'; });
  await page.locator('.kpi-estoque').click();
  assert.deepEqual(await page.evaluate(() => [UI.es.regiao, UI.es.status]), ['', '']);

  // Todas as telas mantêm o contexto e não geram rolagem horizontal da página.
  for (const pagina of ['painel', 'cobrancas', 'usadas', 'estoque', 'tecnicos', 'importar', 'config']) {
    await page.locator(`[data-nav="${pagina}"]`).click();
    await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; window.scrollTo(0, 0); });
    if (pagina !== 'painel') assert.equal(await page.locator('.secao-resumo').count(), 1);
    await page.screenshot({ path: `${saida}/${pagina}-desktop.png`, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow: ${pagina}`);
    await page.screenshot({ path: `${saida}/${pagina}-celular.png`, animations: 'disabled', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
  }
  await page.locator('[data-nav="painel"]').click();
  // A imagem cobre todo o cartão, mantendo 3:2 no recorte, e os valores cabem.
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const leituraCabe = await page.locator('.kpi-usadas .kpi-leitura').evaluate((el) => {
      const valor = el.querySelector('.kpi-valor');
      const antes = valor.textContent; valor.textContent = '2.005';
      const range = document.createRange(); range.selectNodeContents(valor);
      const r = range.getBoundingClientRect(), leitura = el.getBoundingClientRect();
      const cabe = r.right <= leitura.right && r.left >= leitura.left;
      valor.textContent = antes; return cabe;
    });
    assert.equal(leituraCabe, true, `valor legível em ${width}px`);
    const fundo = await card.evaluate((el) => {
      const r = el.getBoundingClientRect(), f = el.querySelector('.kpi-imagem').getBoundingClientRect();
      const a = getComputedStyle(el.querySelector('.kpi-arte'));
      return { largura: Math.abs(r.width - f.width), altura: Math.abs(r.height - f.height), proporcao: parseFloat(a.width) / parseFloat(a.height) };
    });
    assert.ok(fundo.largura <= 2.1 && fundo.altura <= 2.1, `fundo preenche o cartão em ${width}px`);
    assert.ok(Math.abs(fundo.proporcao - 1.5) < .01, 'imagem sem distorção');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await estado.locator('path').hover();
  assert.equal(await page.locator('.mapa-destaque').count(), 0, 'ampliação respeita movimento reduzido');
  await card.hover({ position: { x: 20, y: 20 } });
  assert.equal(await card.evaluate((e) => e.style.getPropertyValue('--inclina-x')), '');
  assert.equal(await card.evaluate((e) => getComputedStyle(e).transform), 'none');
  assert.deepEqual(erros, []);
  console.log('PASSOU: quantidades, cálculos ponderados, estoque conhecido, risco por estado, contraste nos dois temas, imagens, indicadores e sete telas no desktop/celular.');
} finally { await browser.close(); }
