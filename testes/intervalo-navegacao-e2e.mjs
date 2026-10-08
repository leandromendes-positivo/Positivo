// Intervalos inclusivos, acervo antigo e navegação. Somente dados fictícios locais.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { preencherData } from './calendario-ajudante.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/intervalo-navegacao'; fs.mkdirSync(pasta, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-18T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  await page.evaluate(async () => {
    const tid = derivar().tecnicos.find(t => t.nome.startsWith('Ana')).tid;
    const usadas = [
      ['primeira', '2024-01-10', '2024-01-05', 2], ['ultima', '2024-01-12', '2024-01-01', 3],
      ['antes', '2024-01-09', '2024-01-01', 4], ['depois', '2024-01-13', '2024-01-01', 5],
      ['no-dia', '2024-01-11', '2024-01-11', 1], ['uso-inicio', '2024-01-16', '2024-01-10', 7], ['uso-fim', '2024-01-20', '2024-01-12', 11],
    ];
    for (const [k, em, dataFT, qtd] of usadas) await Armazem.gravar(`devolucoes/${k}`, { data: em, itens: [[k, tid, '99999', k, dataFT, qtd, em + ' 23:59', diffDias(dataFT, em), 'PR', k, qtd, 7, dataFT]] });
    for (const [k, em, desde, qtd, destino] of [
      ['nova-inicio', '2024-01-10', '2024-01-05', 2, 'devolucao'], ['nova-fim', '2024-01-12', '2024-01-01', 3, 'devolucao'],
      ['usada-inicio', '2024-01-10', '2024-01-05', 4, 'uso'], ['usada-fim', '2024-01-12', '2024-01-05', 6, 'uso'],
      ['usada-fora', '2024-01-13', '2024-01-05', 8, 'uso'], ['pendente', '2024-01-11', '2024-01-05', 9, 'pendente'],
    ]) await Armazem.gravar(`movimentos/${k}`, { data: em, itens: [{ k, tid, mat: '99999', regiao: 'PR', qtd, em: em + ' 23:59', desde, dias: diffDias(desde, em), prazo: 7, destino }] });
    await carregarTudo(); irPara('painel');
  });
  assert.equal(await page.evaluate(() => E.devolucoes.some(i => i.em.startsWith('2024'))), false, 'acervo antigo fora da carga operacional');
  await page.locator('[data-valor="intervalo"]').click();
  const form = page.locator('[data-form="ranking-intervalo"]');
  async function aplicar(inicio, fim) {
    await preencherData(form.locator('[name="inicio"]'), inicio); await preencherData(form.locator('[name="fim"]'), fim);
    await form.locator('[type="submit"]').click();
    await page.waitForFunction(() => !!dadosDesempenhoRanking());
  }
  await aplicar('2024-01-10', '2024-01-12');
  assert.deepEqual(await page.evaluate(() => {
    const r = dadosDesempenhoRanking(); return [r.inicio, r.fim, r.atraso[0].atrasadas, r.atraso[0].abertas, r.atraso[0].encerradas, r.pontualidade[0].noPrazo, r.pontualidade[0].devolvidas, r.uso[0].uso];
  }), ['2024-01-10', '2024-01-12', 8, 5, 3, 3, 6, 19]);
  assert.match(await page.locator('.desempenho-topo p').innerText(), /10\/01\/2024 a 12\/01\/2024/);
  await page.locator('.ranking-pontualidade .rank-item').first().click();
  assert.match(await page.locator('.modal').innerText(), /10\/01\/2024 a 12\/01\/2024/);
  assert.equal(await page.locator('.modal tbody tr').count(), 3);
  await page.keyboard.press('Escape');
  await page.locator('[data-acao="ranking-filtro"][data-valor="novas"]').click();
  assert.deepEqual(await page.evaluate(() => { const r = dadosDesempenhoRanking(); return [r.atraso[0].atrasadas, r.pontualidade[0].noPrazo, r.uso[0].uso, r.pendentes[0].qtd]; }), [3,2,10,9]);
  await page.locator('[data-mudar="ranking-regiao"]').selectOption('SC');
  assert.equal(await page.locator('.rank-item').count(), 0);
  await page.locator('[data-mudar="ranking-regiao"]').selectOption('');
  await aplicar('2024-01-12', '2024-01-12');
  assert.equal(await page.evaluate(() => dadosDesempenhoRanking().uso[0].uso), 6, 'intervalo de um único dia');
  // Erros não trocam o intervalo aplicado nem alteram os indicadores.
  await preencherData(form.locator('[name="inicio"]'), '2024-01-13');
  await form.locator('[type="submit"]').click();
  assert.match(await form.locator('[role="alert"]').innerText(), /igual ou posterior/);
  assert.equal(await page.evaluate(() => UIranking.inicio), '2024-01-12');
  // Uma atribuição externa também continua sujeita à validação nativa do formulário.
  await form.locator('[name="fim"]').evaluate(el => { el.value = '2027-01-01'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await form.locator('[type="submit"]').click();
  assert.equal(await form.locator('[name="fim"]').evaluate(e => e.validity.rangeOverflow), true);
  assert.equal(await page.evaluate(() => UIranking.fim), '2024-01-12');
  await preencherData(form.locator('[name="inicio"]'), '');
  await form.locator('[type="submit"]').click();
  assert.equal(await form.locator('[name="inicio"]').evaluate(e => e.validity.valueMissing), true);
  assert.equal(await page.evaluate(() => { try { periodoDesempenho('intervalo', hojeISO(), { inicio: '2024-02-30', fim: '2024-03-01' }); return false; } catch { return true; } }), true);
  await aplicar('2024-01-10', '2024-01-12');
  await page.locator('[data-valor="semana"]').click();
  assert.equal(await form.count(), 0);
  assert.deepEqual(await page.evaluate(() => [dadosDesempenhoRanking().inicio, dadosDesempenhoRanking().fim]), ['2026-10-12','2026-10-18']);
  await page.locator('[data-valor="mes"]').click();
  assert.equal(await page.evaluate(() => dadosDesempenhoRanking().inicio), '2026-10-01');
  await page.locator('[data-valor="intervalo"]').click();
  assert.equal(await form.locator('[name="inicio"]').inputValue(), '2024-01-10');
  // Uma falha de leitura nunca deve parecer ausência de registros; há tentativa explícita.
  await page.evaluate(() => {
    const original = Armazem.consultar;
    Armazem.consultar = async function(...args) { if (args[0] === 'devolucoes') { Armazem.consultar = original; throw new Error('Falha simulada'); } return original.apply(this, args); };
    limparHistoricoRanking(); renderizar(true);
  });
  await page.locator('[data-acao="ranking-recarregar"]').waitFor();
  assert.equal(await page.locator('.ranking-grade').count(), 0);
  await page.locator('[data-acao="ranking-recarregar"]').click();
  await page.waitForFunction(() => !!dadosDesempenhoRanking());
  for (const tema of ['light','dark']) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== tema) await page.locator('.acoes-topo [data-acao="tema"]').click();
    await page.locator('.desempenho').screenshot({ path: `${pasta}/intervalo-${tema}.png`, animations: 'disabled' });
    for (const width of [320,390,900,1024,1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem overflow ${tema}/${width}`);
    }
    await page.locator('.btn-recolher-menu').click();
    assert.equal(await page.locator('.rail').isVisible(), false);
    assert.equal(await page.locator('.btn-mostrar-menu').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.principal').evaluate(e => Math.round(e.getBoundingClientRect().width)), 1440);
    assert.equal(await page.locator('.btn-mostrar-menu').evaluate(e => e === document.activeElement), true);
    await page.locator('.desempenho').screenshot({ path: `${pasta}/ampliado-${tema}.png`, animations: 'disabled' });
    await page.locator('.btn-mostrar-menu').press('Enter');
    assert.equal(await page.locator('.rail').isVisible(), true);
    assert.equal(await page.locator('.btn-recolher-menu').evaluate(e => e === document.activeElement), true);
  }
  // Setas funcionam também quando o menu lateral está escondido.
  await page.locator('.btn-recolher-menu').click();
  const nav = page.locator('.navegacao-secoes-topo');
  assert.equal(await nav.locator('[data-direcao="anterior"]').isDisabled(), true);
  await nav.locator('[data-direcao="proxima"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'cobrancas');
  assert.equal(await page.locator('#titulo').evaluate(e => e === document.activeElement), true);
  await page.locator('.navegacao-secoes-rodape [data-direcao="proxima"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'usadas');
  await nav.locator('[data-direcao="anterior"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'cobrancas');
  await page.reload(); await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.locator('.rail').isVisible(), false, 'preferência lembrada ao recarregar');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.rail').isVisible(), true, 'menu móvel independente');
  await page.locator('.btn-menu').click();
  await page.locator('[data-nav="conta"]').click();
  assert.equal(await nav.locator('[data-direcao="proxima"]').isDisabled(), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator('.rail').isVisible(), false);
  await page.locator('.btn-mostrar-menu').click();
  assert.equal(await page.locator('.rail').isVisible(), true);
  // Setas nunca oferecem seções administrativas para um usuário comum.
  await page.evaluate(() => { Acesso.modo = 'firebase'; Acesso.perfil = { ativo: true, perfil: 'usuario' }; irPara('tecnicos'); });
  assert.match(await nav.locator('[data-direcao="proxima"]').getAttribute('aria-label'), /Relatórios/);
  await nav.locator('[data-direcao="proxima"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'relatorios');
  assert.match(await nav.locator('[data-direcao="proxima"]').getAttribute('aria-label'), /Minha conta/);
  await nav.locator('[data-direcao="proxima"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'conta');
  await page.evaluate(() => { historicoRanking.devolucoes = [{ k: 'privado' }]; bloquearSessao(); });
  assert.equal(await page.evaluate(() => historicoRanking.devolucoes.length), 0, 'cache apagado ao revogar acesso');
  assert.equal(await nav.isVisible(), false);
  assert.deepEqual(erros, []);
  console.log('PASSOU: intervalo inclusivo, datas inválidas, acervo antigo, falha de leitura, filtros e detalhes, temas, menu recolhível, persistência, setas e celular.');
} finally { await browser.close(); }
