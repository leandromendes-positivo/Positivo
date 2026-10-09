// Termômetro com inventário fictício em memória; nenhum acesso ao Firebase real.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { instalarAgendaTeste } from './confirmacao-ajudante.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
fs.mkdirSync('capturas/termometro', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T12:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await instalarAgendaTeste(page);
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'incompleta');
  assert.equal(await page.locator('.termometro-marcador').count(), 0);
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => UI.im.resultado);
  await page.evaluate(() => { window.__estoqueTermometro = JSON.stringify(E); irPara('painel'); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'critica');
  assert.deepEqual(await page.locator('[data-fator="usadas"] .termometro-detalhes b').allTextContents(), ['5','3','2'], 'o detalhamento separa prazo, atraso comum e crítico');
  assert.equal(await page.locator('.termometro-frentes > strong').innerText(), '2 / 4');
  await page.locator('.termometro-criterios summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.termometro-criterios').getAttribute('open'), '');
  assert.match(await page.locator('.termometro-regras').innerText(), /25%/);
  await page.keyboard.press('Enter');
  await page.locator('[data-prioridade="usadas"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'consulta', 'a ação prioritária abre o recorte correspondente');
  await page.evaluate(() => irPara('painel'));
  const atrasadas = await page.evaluate(() => situacaoOperacao().atrasadas);
  await page.locator('[data-fator="usadas"]').click();
  assert.equal(await page.evaluate(() => UI.pagina), 'consulta');
  assert.equal(await page.locator('.consulta-metricas dd').first().innerText(), String(atrasadas));
  await page.evaluate(() => irPara('painel'));
  await page.locator('[data-fator="excesso"]').click();
  assert.equal(await page.evaluate(() => UI.es.status), 'acima');

  // Estoque baixo é saudável. A regra usa quantidade, prazo individual e a base de hoje.
  await page.evaluate(() => {
    window.baseSaudavel = () => {
      const e = JSON.parse(window.__estoqueTermometro);
      for (const k of ['usadas','novas','cadastro','indice','contatos','agendamentos','acompLegado']) E[k] = e[k];
      window.__CP_AGORA = '2026-10-05T12:00:00';
      E.usadas.forEach(i => i.dataFT = hojeISO()); E.novas.forEach(i => { i.qtd = 1; i.desde = hojeISO(); });
      Object.values(E.indice.arquivos).forEach(f => f.em = hojeISO() + 'T09:00:00');
      combinarAcompanhamento(); mudou(); irPara('painel');
    };
    baseSaudavel();
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'controlada');
  await page.screenshot({ path: 'capturas/termometro/controlada.png' });
  await page.evaluate(() => {
    E.usadas = [{ ...E.usadas[0], qtd: 24, dataFT: '2026-09-27' }, { ...E.usadas[1], qtd: 76, dataFT: hojeISO() }]; mudou();
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'atencao');
  await page.evaluate(() => { E.usadas[0].qtd = 25; E.usadas[1].qtd = 75; mudou(); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'critica');
  await page.evaluate(() => { E.usadas[0].qtd = 1; E.usadas[1].qtd = 99; E.usadas[0].dataFT = '2026-09-20'; mudou(); });
  assert.equal(await page.evaluate(() => situacaoOperacao().criticas), 1);
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'critica');
  await page.evaluate(() => { E.cadastro[E.usadas[0].tid].prazoUsadas = 20; mudou(); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'controlada', 'prazo personalizado é respeitado');

  // Somente e-mail formal elimina a pendência do aviso; a resposta é registrada pelo operador.
  await page.evaluate(async () => {
    baseSaudavel(); const t = derivar().tecnicos.find(t => t.tipo === 'tecnico' && t.novasTodas);
    const i = novasParaCobranca(t)[0]; window.__itemTermometro = { tid: t.tid, k: i.k };
    await registrarCobranca(t.tid, { canal: 'whatsapp', previsao: '', obs: '', itens: [i], tipo: 'novas' });
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().semRetorno), 1);
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'atencao');
  await page.evaluate(() => renderizar(true)); await page.locator('[data-fator="respostas"]').click();
  assert.equal(await page.locator('.resposta-cartao').count(), 1);
  await page.evaluate(async () => {
    const { tid, k } = __itemTermometro, i = novasParaCobranca(derivar().mapa.get(tid)).find(i => i.k === k);
    await registrarCobranca(tid, { canal: 'email', previsao: '', obs: '', itens: [i], tipo: 'novas' });
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'controlada', 'e-mail enviado hoje ainda não tem resposta atrasada');
  await page.evaluate(() => {
    window.__CP_AGORA = '2026-10-06T12:00:00'; Object.values(E.indice.arquivos).forEach(f => f.em = hojeISO()+'T09:00:00'); mudou();
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'atencao');
  await page.evaluate(async () => {
    const { tid, k } = __itemTermometro; await agendarComEmailTeste([novasParaCobranca(derivar().mapa.get(tid)).find(i => i.k === k)], '2026-10-07');
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'controlada');
  await page.evaluate(() => {
    window.__CP_AGORA = '2026-10-08T12:00:00'; Object.values(E.indice.arquivos).forEach(f => f.em = hojeISO()+'T09:00:00'); mudou(); irPara('painel');
  });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'critica');
  assert.equal(await page.evaluate(() => situacaoOperacao().vencidas), 1);
  assert.deepEqual(await page.locator('[data-fator="vencidas"] .termometro-detalhes b').allTextContents(), ['0','1'], 'previsões vencidas distinguem usadas e novas');
  assert.equal(await page.locator('[data-prioridade="vencidas"]').count(), 1);
  await page.locator('[data-fator="vencidas"]').click();
  assert.deepEqual(await page.evaluate(() => [UI.cob.tipo, UI.cob.aba]), ['todas','vencidas']);
  assert.equal(await page.locator('.cob').count(), 1);

  await page.evaluate(() => { baseSaudavel(); Object.values(E.indice.arquivos).forEach(f => f.em = '2026-10-04T09:00:00'); mudou(); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'incompleta', 'base antiga nunca aparece verde');
  await page.evaluate(() => { baseSaudavel(); delete E.indice.arquivos['novas:PR']; mudou(); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'incompleta', 'planilha ausente não representa saldo zero');
  await page.evaluate(() => { delete E.indice.arquivos['novas:SC']; mudou(); renderizar(true); });
  assert.equal(await page.locator('[data-fator="excesso"] .termometro-medida strong').innerText(), '—', 'sem planilha de novas, o cartão não mostra estoque zerado');
  await page.evaluate(() => { baseSaudavel(); E.usadas = []; E.novas = []; mudou(); renderizar(true); });
  assert.equal(await page.evaluate(() => situacaoOperacao().nivel), 'controlada', 'inventário vazio importado é conhecido');
  assert.equal(await page.locator('.boas-vindas').count(), 0);

  await page.evaluate(() => { baseSaudavel(); E.usadas = JSON.parse(__estoqueTermometro).usadas; document.getElementById('toasts').innerHTML = ''; mudou(); renderizar(true); });
  await page.waitForTimeout(120); // permite concluir a atualização de tela agendada pelo modelo
  for (const theme of ['light','dark']) {
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    for (const width of [1440,1024,768,390,320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.termometro-operacao').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.termometro-operacao').evaluate(e => e.scrollWidth > e.clientWidth), false);
      assert.equal(await page.locator('.termometro-marcador').evaluate(e => getComputedStyle(e).animationName), 'none');
      assert.equal(await page.locator('.termometro-microbarra > i').first().evaluate(e => getComputedStyle(e).animationName), 'none');
      await page.locator('.termometro-criterios summary').click();
      assert.equal(await page.locator('.termometro-operacao').evaluate(e => e.scrollWidth > e.clientWidth), false, 'critérios abertos também cabem na tela');
      await page.locator('.termometro-criterios summary').click();
      await page.locator('.termometro-operacao').screenshot({ path: `capturas/termometro/${theme}-${width}.png` });
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.termometro-marcador').evaluate(e => getComputedStyle(e).animationIterationCount), '1');
  assert.deepEqual(erros, []);
  console.log('PASSOU: faixas do termômetro, dados ausentes/antigos/vazios, prazos individuais, e-mail, previsões novas, atalhos, temas, responsividade e movimento reduzido.');
} finally { await browser.close(); }
