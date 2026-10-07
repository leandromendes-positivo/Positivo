// Executar somente na versão em memória. Confere arquivos reais e seus dados.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/relatorios'; fs.mkdirSync(pasta, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-07T12:00:00-03:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria', 'nunca gravar dados fictícios no Firebase');
  await page.locator('#nav [data-pagina="relatorios"]').click();
  await page.waitForFunction(() => relatorioPronto());
  assert.equal(await page.locator('.rel-kpis article').count(), 6);
  // Exportação vazia também deve gerar um documento válido, incluindo SVGs vazios no PDF.
  const baixar = async (formato, nome) => {
    const evento = page.waitForEvent('download', { timeout: 90000 });
    await page.locator(`[data-acao="relatorios-exportar"][data-formato="${formato}"]`).click();
    const download = await evento; await download.saveAs(`${pasta}/${nome}`);
    await page.waitForFunction(() => !UIrelatorios.exportando);
  };
  await baixar('pdf', 'vazio.pdf'); await baixar('excel', 'vazio.xlsx');
  await page.evaluate(async () => {
    E.config = { ...PADROES, meta: 10, tiposIgnorados: ['Extra'] };
    E.cadastro = {
      ana: { nome: 'Ana Exemplo', regiao: 'PR', localidade: 'capital', prazoUsadas: 3 },
      bruno: { nome: 'Bruno Exemplo', regiao: 'SC', localidade: 'interior', meta: 5, prazoNovas: 10 },
      base: { nome: 'BASE EXCLUIR', regiao: 'PR', tipo: 'base' },
      ignorado: { nome: 'IGNORADO EXCLUIR', regiao: 'PR', tipo: 'ignorar' },
    };
    for (let n = 0; n < 25; n++) E.cadastro['zero' + n] = { nome: 'Técnico sem peças ' + String(n).padStart(2, '0'), regiao: 'PR' };
    E.catalogo = { '000123': 'Memória RAM 8 GB', '000456': 'SSD NVMe 512 GB', '000789': '=HYPERLINK("https://example.test", "Texto literal")', '000999': 'Placa principal' };
    const u = (k, tid, regiao, qtd, dataFT) => ({ k, tid, regiao, qtd, dataFT, desde: dataFT, mat: '000123', chamado: k });
    E.usadas = [u('u1', 'ana', 'PR', 8, '2026-09-29'), u('u2', 'bruno', 'SC', 3, '2026-10-05'), u('base', 'base', 'PR', 50, '2026-09-01'), u('ignorado', 'ignorado', 'PR', 50, '2026-09-01')];
    const n = (tid, regiao, qtd, mat, tipoEnvio = 'Padrão') => ({ k: tid + mat, tid, regiao, qtd, mat, tipoEnvio, desde: '2026-10-01' });
    E.novas = [n('ana', 'PR', 12, '000456'), n('ana', 'PR', 4, '000789', 'Extra'), n('bruno', 'SC', 6, '000999'), n('base', 'PR', 90, '000456')];
    E.indice.arquivos = Object.fromEntries(['usadas:PR', 'novas:PR', 'usadas:SC', 'novas:SC'].map(c => [c, { em: '2026-10-07 09:00', arquivo: c + '.csv' }]));
    E.acomp = { ana: { itens: { u1: { p: '2026-10-09', agendadoPor: { email: 'leandro.exemplo@example.test' } } }, cobrancas: [] } };
    const d = (k, tid, mat, qtd, em, dias, regiao, prazo) => [k, tid, mat, k, '2026-09-25', qtd, em, dias, regiao, 'lote', qtd, prazo];
    await Armazem.gravar('devolucoes/periodo', { data: '2026-10-05', itens: [d('d1', 'ana', '000123', 4, '2026-10-02', 2, 'PR', 3), d('d2', 'bruno', '000456', 3, '2026-10-05', 8, 'SC', 7), d('db', 'base', '000123', 70, '2026-10-03', 2, 'PR', 7)] });
    await Armazem.gravar('devolucoes/antiga', { data: '2026-05-02', itens: [d('antiga', 'ana', '000123', 2, '2026-05-02', 2, 'PR', 3)] });
    const m = (k, tid, regiao, qtd, destino, dias = 9) => ({ k, tid, regiao, qtd, destino, dias, prazo: 7, mat: '000456', desde: '2026-09-25', em: '2026-10-04' });
    await Armazem.gravar('movimentos/periodo', { data: '2026-10-04', itens: [m('m1', 'ana', 'PR', 5, 'devolucao'), m('m2', 'bruno', 'SC', 2, 'uso'), m('m3', 'bruno', 'SC', 9, 'pendente'), m('m4', 'ana', 'PR', 1, 'transferencia')] });
    E.devolucoes = []; E.movimentos = []; mudou(); renderizar(true);
  });
  await page.waitForFunction(() => relatorioPronto());
  const resumo = await page.evaluate(() => {
    const r = calcularRelatorio(); return { k: r.k, ana: r.tecnicos.find(t => t.tid === 'ana'), bruno: r.tecnicos.find(t => t.tid === 'bruno'), total: r.tecnicos.length };
  });
  assert.equal(resumo.k.estoque, 33); assert.equal(resumo.k.atrasadas, 8, 'previsão futura não apaga a idade acima do prazo individual');
  assert.equal(resumo.k.devolvidas, 12); assert.equal(resumo.k.noPrazo, 4); assert.equal(resumo.k.pontualidade, 1 / 3);
  assert.equal(resumo.k.uso, 2); assert.equal(resumo.k.classificar, 9); assert.equal(resumo.k.transferidas, 1);
  assert.equal(resumo.k.excesso, 3); assert.equal(resumo.ana.excesso, 2, 'envio ignorado fora do cálculo do limite'); assert.equal(resumo.bruno.excesso, 1);
  assert.equal(resumo.total, 27); assert.equal(await page.locator('.rel-tabela tbody tr').count(), 20);
  await page.locator('[data-alvo="relatorios"][data-p="2"]').click(); assert.equal(await page.locator('.rel-tabela tbody tr').count(), 7);
  await baixar('excel', 'relatorio.xlsx'); await baixar('pdf', 'relatorio.pdf');
  // Filtros reais pelo formulário, incluindo histórico anterior a 120 dias.
  const formulario = page.locator('[data-form="relatorios"]');
  await formulario.locator('[name="inicio"]').fill('2026-05-01'); await formulario.locator('[name="fim"]').fill('2026-05-31');
  await formulario.locator('[type="submit"]').click();
  assert.equal(await page.evaluate(() => calcularRelatorio().k.devolvidas), 2);
  assert.equal(await page.evaluate(() => calcularRelatorio().k.estoque), 33, 'datas não escondem estoque atual');
  await formulario.locator('[name="inicio"]').fill('2026-10-07'); await formulario.locator('[name="fim"]').fill('2026-10-01');
  await formulario.locator('[type="submit"]').click(); assert.match(await formulario.locator('[role="alert"]').innerText(), /posterior/);
  assert.equal(await page.evaluate(() => UIrelatorios.filtros.inicio), '2026-05-01', 'intervalo inválido não substitui o aplicado');
  await page.locator('[data-acao="relatorios-limpar"]').click();
  await formulario.locator('[name="tipo"]').selectOption('novas'); await formulario.locator('[name="tid"]').selectOption('bruno');
  await formulario.locator('[name="localidade"]').selectOption('interior'); await formulario.locator('[name="regiao"]').selectOption('SC');
  await formulario.locator('[type="submit"]').click();
  assert.deepEqual(await page.evaluate(() => { const r = calcularRelatorio(); return [r.k.estoque, r.k.atrasadas, r.k.devolvidas, r.k.uso, r.k.classificar, r.k.excesso]; }), [6, 0, 0, 2, 9, 1]);
  await baixar('excel', 'filtrado.xlsx'); await baixar('pdf', 'filtrado.pdf');
  await page.locator('[data-acao="relatorios-limpar"]').click();
  // Falha de leitura não disponibiliza arquivo parcial; retry deve recuperar.
  await page.evaluate(() => { window.__consultaOriginal = Armazem.consultar; Armazem.consultar = async () => { throw new Error('Falha simulada no histórico'); }; relatorioHistorico.chave = ''; renderizar(true); });
  await page.getByText('Não foi possível consultar o histórico', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-formato="excel"]').isDisabled(), true);
  await page.evaluate(() => { Armazem.consultar = window.__consultaOriginal; });
  await page.locator('[data-acao="relatorios-atualizar"]').click(); await page.waitForFunction(() => relatorioPronto());
  // Um gráfico editável por quadro e dados tabulares acessíveis na interface.
  assert.equal(await page.locator('.rel-grafico svg').count(), 4);
  await page.locator('.rel-dados-grafico summary').first().click(); assert.match(await page.locator('.rel-dados-grafico[open]').innerText(), /Dentro do prazo/i);
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
  for (const tema of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, tema);
    for (const largura of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width: largura, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${pasta}/${tema}-${largura}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${tema}/${largura}: sem rolagem lateral da página`);
      const caixa = await page.locator('.rel-tabela').evaluate(el => ({ tabela: el.scrollWidth, janela: el.closest('.tabela-rolagem').clientWidth, overflow: getComputedStyle(el.closest('.tabela-rolagem')).overflowX }));
      if (largura <= 768) assert.equal(caixa.overflow, 'auto');
      if (largura === 390) {
        await page.locator('.rel-consolidado h2').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${pasta}/${tema}-tabela-mobile.png` });
        assert.equal(await page.locator('.rel-tabela tbody td').first().isVisible(), true);
        await page.locator('.rel-tabela').evaluate(el => { el.closest('.tabela-rolagem').scrollLeft = 100; });
        assert.equal(await page.locator('.rel-tabela').evaluate(el => el.closest('.tabela-rolagem').scrollLeft > 0), true);
      }
    }
  }
  await page.evaluate(() => {
    window.__leiturasPendentes = [];
    Armazem.consultar = () => new Promise(resolve => window.__leiturasPendentes.push(resolve));
    relatorioHistorico.chave = ''; renderizar(true);
  });
  await page.waitForFunction(() => window.__leiturasPendentes.length === 2);
  await page.evaluate(async () => {
    bloquearSessao();
    window.__leiturasPendentes[0]([{ id: 'privado', itens: [['privado', 'ana', '000123', '', '', 1, '2026-10-01', 1, 'PR']] }]);
    window.__leiturasPendentes[1]([{ id: 'privado', itens: [{ k: 'privado', tid: 'ana', qtd: 1 }] }]);
    await new Promise(resolve => setTimeout(resolve, 0));
    Armazem.consultar = window.__consultaOriginal;
  });
  assert.equal(await page.evaluate(() => relatorioHistorico.devolucoes.length + relatorioHistorico.movimentos.length), 0, 'revogação limpa o cache de relatórios');
  assert.deepEqual(erros, []);
  console.log('OK: menu, cálculos, filtros, acervo antigo, erro/retry, downloads reais, paginação e responsividade em dois temas.');
} finally { await browser.close(); }
