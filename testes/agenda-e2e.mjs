import { instalarAgendaTeste, preencherConfirmacaoTeste } from './confirmacao-ajudante.mjs';
// Compromissos por técnico/data, retorno após importação e interação do calendário.
// Dados fictícios, exclusivamente na versão local em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { preencherData } from './calendario-ajudante.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = process.argv[2] || 'capturas/agenda';
fs.mkdirSync(pasta, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-08T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  await instalarAgendaTeste(page);
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  const arquivos = fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f));
  await page.setInputFiles('#entrada-topo', arquivos);
  await page.waitForFunction(() => !!UI.im.resultado);
  const dados = await page.evaluate(async () => {
    E.usuario.email = 'lia.silva@exemplo.invalid';
    const D = derivar();
    const grupo = [...agrupar(D.itens, i => i.tid).values()].find(itens => itens.length >= 2 && itens.some(i => i.qtd > 1))
      || [...agrupar(D.itens, i => i.tid).values()].find(itens => itens.length >= 2);
    const [a, b] = grupo;
    const c = D.itens.find(i => i.tid !== a.tid);
    await agendarComEmailTeste([a], '2026-10-06');
    await agendarComEmailTeste([b], '2026-10-08');
    await agendarComEmailTeste([c], '2026-10-20');
    irPara('painel');
    document.getElementById('toasts').innerHTML = '';
    return { a, b, c, total: D.kpi.usadas };
  });
  const agenda = page.locator('.cartao-agenda');
  const botaoDia = dia => agenda.locator(`.agenda-dias [data-dia="${dia}"]`);
  assert.equal(await agenda.locator('.agenda-dias button').count(), 7);
  assert.equal(await agenda.locator('.agenda-dia').first().getAttribute('data-dia'), '2026-10-05');
  assert.equal(await agenda.locator('.agenda-dia[aria-current="date"]').getAttribute('data-dia'), '2026-10-08');
  assert.equal(await agenda.locator('.agenda-resumo > strong').innerText(), `${dados.b.qtd} ${dados.b.qtd === 1 ? 'peça prevista' : 'peças previstas'}`);
  assert.match(await agenda.locator('.autoria-previsao').innerText(), /Lia/);

  // A previsão vencida é a data prometida, e não a idade da peça ou o prazo geral.
  await agenda.locator('[data-acao="agenda-vencidas"]').click();
  assert.equal(await agenda.locator('.agenda-compromisso').count(), 1);
  assert.match(await agenda.locator('.agenda-compromisso-status').innerText(), /2 dias após a previsão/);
  assert.equal(await agenda.locator('[data-acao="agenda-reagendar"]').getAttribute('data-dia'), '2026-10-06');
  await agenda.locator('.agenda-pecas summary').click();
  assert.equal(await agenda.locator('.agenda-pecas li').count(), 1);
  assert.match(await agenda.locator('.agenda-pecas li').innerText(), new RegExp(dados.a.mat));

  // Reagendar esta data não altera o segundo compromisso do mesmo técnico.
  await agenda.locator('[data-acao="agenda-reagendar"]').click();
  await preencherConfirmacaoTeste(page,'2026-10-22');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  assert.deepEqual(await page.evaluate(({ a, b }) => [derivar().itens.find(i => i.k === a.k).previsao, derivar().itens.find(i => i.k === b.k).previsao], dados), ['2026-10-22', '2026-10-08']);
  assert.match(await agenda.locator('.agenda-vazia').innerText(), /Nenhuma previsão vencida/);
  assert.equal(await page.evaluate(() => E.devolucoes.length), 0);
  assert.equal(await page.evaluate(() => derivar().kpi.usadas), dados.total);
  await agenda.locator('.agenda-navegar [data-acao="agenda-hoje"]').click();
  assert.equal(await agenda.locator('.agenda-navegar [data-acao="agenda-hoje"]').evaluate(e => e === document.activeElement), true);
  await agenda.locator('[data-acao="agenda-mensagem"]').click();
  assert.match(await page.locator('.modal-topo h2').innerText(), /Lembrar/);
  assert.equal(await page.locator('.cobrar-resumo > div').first().locator('strong').innerText(), String(dados.b.qtd));
  await page.keyboard.press('Escape');

  // Dia vazio aponta para um compromisso além da semana visível.
  const kpi = await page.locator('.kpi-operacional').first().elementHandle();
  await botaoDia('2026-10-09').click();
  await agenda.locator('[data-acao="agenda-proxima"]').click();
  assert.equal(await agenda.locator('.agenda-dia.ativo').getAttribute('data-dia'), '2026-10-20');
  assert.equal(await agenda.locator('.agenda-dia').first().getAttribute('data-dia'), '2026-10-19');
  assert.equal(await kpi.evaluate(e => e.isConnected), true, 'navegação da agenda preserva os demais indicadores');
  assert.equal(await botaoDia('2026-10-20').evaluate(e => e === document.activeElement), true);
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowLeft');
  assert.equal(await agenda.locator('.agenda-dia.ativo').getAttribute('data-dia'), '2026-10-18');
  await page.keyboard.press('PageDown');
  assert.equal(await agenda.locator('.agenda-dia.ativo').getAttribute('data-dia'), '2026-10-25');
  await agenda.locator('[data-acao="agenda-semana"][data-passo="1"]').click();
  assert.equal(await agenda.locator('.agenda-dia.ativo').getAttribute('data-dia'), '2026-11-01');
  assert.match(await agenda.locator('.agenda-navegacao h3').innerText(), /outubro 2026 \/ novembro 2026/i);
  await page.evaluate(() => navegarAgenda('2026-12-31'));
  assert.match(await agenda.locator('.agenda-navegacao h3').innerText(), /dezembro 2026 \/ janeiro 2027/i);
  await page.evaluate(() => navegarAgenda('2028-02-29'));
  await page.keyboard.press('ArrowRight');
  assert.equal(await agenda.locator('.agenda-dia.ativo').getAttribute('data-dia'), '2028-03-01');
  // O KPI continua representando hoje + 6 dias, independente da semana consultada.
  assert.equal(await page.evaluate(() => agendaDoPainel(derivar())[0].dia), '2026-10-08');

  // Filtro de peças sem previsão corresponde exatamente ao contador da agenda.
  const semData = await page.evaluate(() => resumoAgenda(derivar()).semData.length);
  await agenda.locator('.agenda-prioridades [data-status="sem_previsao"]').click();
  assert.equal(await page.evaluate(() => UI.cob.aba), 'sem_previsao');
  assert.equal(await page.evaluate(() => filtrarCobrancas(derivar()).flatMap(t=>itensDaAba(t,'sem_previsao',hojeISO(),'todas')).length), semData);
  await page.evaluate(() => irPara('painel'));
  await page.evaluate(async ({ a }) => { await agendarComEmailTeste([derivar().itens.find(i => i.k === a.k)], '2026-10-06'); navegarAgenda('2026-10-08'); }, dados);

  // Aparência, textos completos e ações acessíveis em desktop, tablet e celular.
  for (const tema of ['light', 'dark']) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== tema) await page.locator('.acoes-topo [data-acao="tema"]').click();
    for (const largura of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width: largura, height: 1100 });
      await page.waitForTimeout(300); // O painel redesenha os gráficos após redimensionar.
      await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; navegarAgenda('2026-10-08'); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${tema}/${largura}: sem transbordamento da página`);
      assert.equal(await agenda.evaluate(e => e.scrollWidth > e.clientWidth), false, `${tema}/${largura}: agenda dentro do cartão`);
      await agenda.screenshot({ path: `${pasta}/${tema}-${largura}.png` });
      const datasCortadas = await agenda.locator('.agenda-dia').evaluateAll(es => es.filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().height < 44).map(e => ({ dia: e.dataset.dia, scroll: e.scrollWidth, client: e.clientWidth, height: e.getBoundingClientRect().height })));
      assert.deepEqual(datasCortadas, [], `${tema}/${largura}: datas sem cortes`);
      await agenda.locator('[data-acao="agenda-vencidas"]').click();
      await agenda.screenshot({ path: `${pasta}/${tema}-${largura}-vencidas.png` });
    }
  }

  // A animação começa ao passar o cursor, termina uma vez e respeita movimento reduzido.
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => navegarAgenda('2026-10-08'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(0, 0);
  await botaoDia('2026-10-09').hover();
  assert.equal(await botaoDia('2026-10-09').locator('.agenda-folha').evaluate(e => getComputedStyle(e).animationName), 'agenda-folha');
  assert.equal(await botaoDia('2026-10-09').locator('.agenda-folha').evaluate(e => getComputedStyle(e).animationIterationCount), '1');
  await page.waitForTimeout(550);
  assert.equal(await botaoDia('2026-10-09').locator('.agenda-folha').evaluate(e => e.getAnimations().some(a => a.playState === 'running')), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await botaoDia('2026-10-10').click();
  assert.equal(await agenda.evaluate(e => e.getAnimations({ subtree: true }).some(a => a.playState === 'running')), false);

  // A nova planilha confirma a saída; a previsão histórica não mantém a peça na agenda.
  const atualizadas = arquivos.map(f => ({ name: path.basename(f), mimeType: 'text/csv', buffer: Buffer.from(fs.readFileSync(f).toString('latin1').split('\n').filter(l => !l.includes(dados.b.chamado)).join('\n'), 'latin1') }));
  await page.setInputFiles('#entrada-topo', atualizadas);
  await page.waitForFunction(() => E.importacoes.length === 2 && !!UI.im.resultado);
  await page.evaluate(() => { irPara('painel'); navegarAgenda('2026-10-08'); });
  assert.equal(await page.evaluate(() => resumoAgenda(derivar()).hoje.length), 0);
  assert.equal(await agenda.locator('.agenda-compromisso').count(), 0);
  assert.equal(await page.evaluate(() => derivar().kpi.usadas), dados.total - dados.b.qtd);
  assert.equal(await page.evaluate(() => E.devolucoes.length), 1);
  assert.deepEqual(erros, []);
  console.log('PASSOU: quantidades, autoria, compromissos por data, reagendamento isolado, mensagens, baixa após importação, filtros, semanas/anos/bissexto, teclado, animação finita, movimento reduzido e 8 layouts.');
} finally { await browser.close(); }
