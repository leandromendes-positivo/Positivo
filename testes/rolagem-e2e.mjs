// Rolagem de tabelas com mouse, teclado e toque. Somente dados fictícios em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const saida = process.argv[2] || 'capturas/rolagem';
fs.mkdirSync(saida, { recursive: true });
const erros = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce', hasTouch: true });
  page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  // Mais de uma página: a barra nativa fica muito abaixo da área visível.
  await page.evaluate(() => {
    const item = E.usadas[0];
    E.usadas.push(...Array.from({ length: 60 }, (_, n) => ({ ...item, k: `rolagem-ficticia-${n}`, chamado: `TESTE-${n}` })));
    E.devolucoes.push({ ...item, em: '2026-10-04', dias: 12, qtd: 1 });
    E.rev++;
    irPara('usadas');
  });
  const barra = page.locator('.rolagem-horizontal');
  const range = barra.locator('input');
  async function apontar(tabela) {
    await page.waitForFunction(el => !!el.id, await tabela.elementHandle());
    await tabela.evaluate(el => {
      document.activeElement?.blur();
      const corpo = el.closest('.modal-corpo');
      if (corpo) corpo.scrollTop += el.getBoundingClientRect().top - corpo.getBoundingClientRect().top - 20;
      else window.scrollBy(0, el.getBoundingClientRect().top - 180);
      el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    await page.waitForFunction(id => {
      const b = document.querySelector('.rolagem-horizontal');
      return !b.hidden && b.querySelector('input').getAttribute('aria-controls') === id;
    }, await tabela.getAttribute('id')).catch(async erro => {
      console.error(await tabela.evaluate(el => ({ id: el.id, largura: el.clientWidth, conteudo: el.scrollWidth, caixa: el.getBoundingClientRect().toJSON(), area: el.closest('.modal-corpo')?.getBoundingClientRect().toJSON(), barra: document.querySelector('.rolagem-horizontal').outerHTML })));
      await page.screenshot({ path: `${saida}/falha.png` });
      throw erro;
    });
    await page.waitForFunction(el => Math.abs(document.querySelector('.rolagem-horizontal').getBoundingClientRect().width - el.clientWidth) < 3, await tabela.elementHandle());
    const rect = await barra.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= page.viewportSize().width + 1 && rect.y >= 0 && rect.y + rect.height <= page.viewportSize().height, 'barra inteira dentro da tela');
  }
  async function conferirColunas(tabela) {
    await apontar(tabela);
    await range.focus(); await page.keyboard.press('Home');
    assert.equal(await tabela.evaluate(el => el.scrollLeft), 0);
    await barra.locator('[data-rolagem="proxima"]').click();
    assert.ok(await tabela.evaluate(el => el.scrollLeft > 0), 'seta avança sem Shift');
    await range.focus(); await page.keyboard.press('End');
    assert.equal(await tabela.evaluate(el => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft) <= 1), true, 'última coluna alcançável');
    assert.equal(await barra.locator('[data-rolagem="proxima"]').isDisabled(), true);
    await page.keyboard.press('Home');
    assert.equal(await barra.locator('[data-rolagem="anterior"]').isDisabled(), true);
  }
  let tabela = page.locator('#conteudo .tabela-rolagem').first();
  await conferirColunas(tabela);
  assert.ok(await tabela.evaluate(el => el.getBoundingClientRect().bottom > innerHeight * 2), 'teste cobre lista longa');
  // Arraste real do controle, roda do mouse e sincronização da rolagem nativa.
  let caixa = await range.boundingBox();
  const alca = await range.evaluate(el => parseFloat(el.style.getPropertyValue('--alca')));
  await page.mouse.move(caixa.x + alca / 2, caixa.y + caixa.height / 2);
  await page.mouse.down(); await page.mouse.move(caixa.x + caixa.width, caixa.y + caixa.height / 2, { steps: 12 }); await page.mouse.up();
  assert.equal(await tabela.evaluate(el => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft) <= 1), true, 'arraste alcança o fim');
  await page.keyboard.press('Home');
  await range.hover(); await page.mouse.wheel(0, 100);
  await page.waitForFunction(() => Number(document.querySelector('.rolagem-horizontal input').value) > 0);
  await tabela.evaluate(el => { el.scrollLeft = 70; });
  await page.waitForFunction(() => Number(document.querySelector('.rolagem-horizontal input').value) === 70);
  await page.screenshot({ path: `${saida}/usadas-desktop.png` });
  // No fim, a barra tem espaço próprio e não cobre os botões de paginação.
  await page.locator('[data-acao="pagina"][data-alvo="us"]').last().scrollIntoViewIfNeeded();
  await page.locator('[data-acao="pagina"][data-alvo="us"]').last().click();
  await page.waitForFunction(() => UI.us.pagina === 2);
  tabela = page.locator('#conteudo .tabela-rolagem').first();
  await conferirColunas(tabela);
  await page.evaluate(() => { UI.us.pagina = 1; renderizar(true); });
  // Todas as seções, ambas as paletas e larguras de computador/tablet/celular.
  const paginas = ['painel', 'cobrancas', 'usadas', 'devolvidas', 'consulta', 'inventario', 'estoque', 'tecnicos', 'ficha-novas', 'importar', 'config', 'usuarios', 'conta'];
  for (const tema of ['dark', 'light']) {
    await page.evaluate(tema => document.documentElement.dataset.theme = tema, tema);
    for (const width of [1366, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 768 });
      for (const pagina of paginas) {
        await page.evaluate(pagina => {
          UI.us.aba = pagina === 'devolvidas' ? 'devolvidas' : 'pendentes';
          if (pagina === 'ficha-novas') {
            const t = derivar().tecnicos.find(t => t.tipo === 'tecnico' && t.novasLinhas.length);
            UI.ficha.aba = 'novas'; irPara('tecnicos', { tid: t.tid });
          } else irPara(pagina === 'devolvidas' ? 'usadas' : pagina);
          if (pagina === 'cobrancas') { UI.cob.abertos = new Set(derivar().cobrarTec.map(t => t.tid)); renderizar(true); }
        }, pagina);
        if (pagina === 'inventario') await page.waitForFunction(() => !UIinventario.carregando);
        await page.waitForFunction(() => [...document.querySelectorAll('.tabela-rolagem')].every(el => el.id));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${tema}/${width}/${pagina}: sem corte na página`);
        assert.equal(await page.locator('#conteudo table').evaluateAll(es => es.every(el => el.closest('.tabela-rolagem'))), true, `${pagina}: tabelas protegidas`);
        for (const t of await page.locator('#conteudo .tabela-rolagem').all()) {
          if (await t.evaluate(el => el.scrollWidth > el.clientWidth + 1)) await conferirColunas(t);
        }
        if (pagina === 'ficha-novas' && width === 390) await page.screenshot({ path: `${saida}/ficha-novas-${tema}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => irPara('usadas'));
  tabela = page.locator('#conteudo .tabela-rolagem').first();
  await apontar(tabela);
  const larguraAntes = await tabela.evaluate(el => el.clientWidth);
  await page.evaluate(() => MenuLateral.alternar());
  await page.waitForFunction(antes => document.querySelector('#conteudo .tabela-rolagem').clientWidth > antes, larguraAntes);
  await apontar(tabela);
  assert.ok(Math.abs((await barra.boundingBox()).width - await tabela.evaluate(el => el.clientWidth)) < 3, 'barra acompanha a largura ao recolher o menu');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => document.querySelector('.rolagem-horizontal').hidden);
  assert.equal(await tabela.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'tabela que cabe não precisa de barra');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => MenuLateral.alternar());
  await apontar(tabela);
  // Filtros sem resultados removem a barra antiga; novas renderizações a restauram.
  await page.evaluate(() => { UI.us.busca = 'SEM-RESULTADO-FICTICIO'; renderizar(true); });
  await page.waitForFunction(() => document.querySelector('.rolagem-horizontal').hidden);
  await page.evaluate(() => { UI.us.busca = ''; renderizar(true); });
  await apontar(page.locator('#conteudo .tabela-rolagem').first());
  // Toque no controle em uma tela estreita.
  await page.setViewportSize({ width: 390, height: 844 });
  tabela = page.locator('#conteudo .tabela-rolagem').first();
  await apontar(tabela); await range.focus(); await page.keyboard.press('Home');
  caixa = await range.boundingBox();
  await page.touchscreen.tap(caixa.x + caixa.width - 2, caixa.y + caixa.height / 2);
  assert.ok(await tabela.evaluate(el => el.scrollLeft > 0), 'toque move as colunas');
  // Janela real de detalhes de ranking: controle dentro da área do diálogo.
  await page.evaluate(() => { irPara('painel'); modalRanking(derivar().cobrarTec[0].tid, 'atraso'); });
  tabela = page.locator('.modal .tabela-rolagem');
  await conferirColunas(tabela);
  assert.equal(await page.locator('.modal').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), true, 'janela de ranking sem corte lateral');
  assert.equal(await barra.evaluate(el => !!el.closest('.modal')), true, 'barra participa da navegação do diálogo');
  assert.equal(await barra.evaluate(el => el.getBoundingClientRect().bottom <= el.closest('.modal').querySelector('.modal-rodape').getBoundingClientRect().top), true, 'barra não cobre rodapé do diálogo');
  await page.screenshot({ path: `${saida}/ranking-celular.png` });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.querySelector('.modal').contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.modal') && document.querySelector('.principal > .rolagem-horizontal'));
  // Cadastro/conta renderizados sem iniciar Firebase nem gravar contas reais.
  await page.evaluate(() => {
    if (Armazem.online) throw Error('Teste exige armazenamento em memória');
    Acesso.modo = 'firebase'; Acesso.perfil = { ativo: true, perfil: 'administrador' };
    Acesso.usuario = { email: 'ana.ficticia@example.test' };
    E.usuarios = [{ email: 'ana.ficticia@example.test', ativo: true, perfil: 'administrador', principal: true }];
    irPara('usuarios');
  });
  await conferirColunas(page.locator('#conteudo .tabela-rolagem'));
  await page.evaluate(() => irPara('conta'));
  await page.waitForFunction(() => document.querySelector('.rolagem-horizontal').hidden);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(erros, []);
  console.log('PASSOU: todas as páginas em 1366/1024/390/320px e dois temas; tabelas longas, arraste, setas, teclado, roda, toque, paginação, filtros, menu recolhido, fichas, cadastro e detalhes de ranking.');
} finally { await browser.close(); }
