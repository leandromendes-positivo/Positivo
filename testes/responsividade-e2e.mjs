// Navegação por toque, isolamento das camadas e limites de layout. Dados só em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/responsividade'; fs.mkdirSync(pasta, { recursive: true });
const erros = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; irPara('painel'); });
  const cdp = await page.context().newCDPSession(page);
  async function gesto(x, y, fim) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let n = 1; n <= 10; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (fim - y) * n / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Aguarda a inércia do gesto; não confundir scrollTop intermediário com repouso.
    await page.waitForTimeout(300);
  }
  async function semCorte(contexto) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${contexto}: página sem corte lateral`);
  }
  async function janelaNaTela() {
    assert.equal(await page.locator('.modal').last().evaluate(el => {
      const r = el.getBoundingClientRect(), c = el.querySelector('.modal-corpo'), f = el.querySelector('.modal-rodape').getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && c.scrollWidth <= c.clientWidth + 1 && f.bottom <= innerHeight;
    }), true, 'janela, corpo e ações dentro da tela');
  }
  for (const tema of ['dark', 'light']) {
    await page.evaluate(tema => document.documentElement.dataset.theme = tema, tema);
    for (const [width, height] of [[320,568], [390,844], [844,390], [768,1024], [900,600]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { irPara('painel'); scrollTo(0, 700); });
      const antes = await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top);
      await page.locator('.btn-menu').tap();
      await page.waitForFunction(() => document.documentElement.classList.contains('rolagem-bloqueada'));
      assert.ok(Math.abs(await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top) - antes) <= 1, 'abrir menu não desloca a página');
      assert.equal(await page.locator('.principal').evaluate(el => el.inert), true);
      const nav = page.locator('#nav');
      assert.equal(await nav.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1), true, 'menu cabe inclusive na horizontal');
      await nav.evaluate(el => { el.scrollTop = 0; });
      const r = await nav.boundingBox(), fim = Math.min(height - 24, r.y + r.height - 24);
      const podeRolar = await nav.evaluate(el => el.scrollHeight > el.clientHeight);
      await gesto(width / 2, fim, r.y + 30);
      if (podeRolar) assert.ok(await nav.evaluate(el => el.scrollTop > 0), 'o menu recebe o arraste do dedo');
      assert.ok(Math.abs(await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top) - antes) <= 1, 'gesto no menu não rola o fundo');
      await nav.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await gesto(width / 2, fim, r.y + 30);
      assert.ok(Math.abs(await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top) - antes) <= 1, 'limite do menu não transfere rolagem para a página');
      await page.locator('#nav a').last().focus(); await page.keyboard.press('Tab');
      assert.equal(await page.locator('.btn-menu').evaluate(el => el === document.activeElement), true, 'Tab permanece no menu');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#nav a').last().evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('/');
      assert.equal(await page.evaluate(() => document.querySelector('.rail').contains(document.activeElement)), true, 'atalho não acessa o fundo');
      await page.screenshot({ path: `${pasta}/menu-${tema}-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => scrollY), 700, 'fechar restaura a posição original');
      await page.locator('.btn-menu').tap();
      await page.locator('[data-nav="usadas"]').tap();
      assert.equal(await page.evaluate(() => UI.pagina), 'usadas');
      assert.equal(await page.evaluate(() => scrollY), 0, 'navegar inicia a seção no topo');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rolagem-bloqueada')), false);
      // Área escurecida, quando exposta, também fecha sem perder a posição.
      if (height > 800) {
        await page.evaluate(() => scrollTo(0, 400)); await page.locator('.btn-menu').tap();
        const bottom = await nav.evaluate(el => el.getBoundingClientRect().bottom);
        await page.evaluate(() => { window.__gestos = []; window.__registrarGesto = e => window.__gestos.push([e.type,e.clientX,e.clientY,e.target.className]); for (const tipo of ['pointerdown','pointerup','click','touchcancel']) document.addEventListener(tipo, window.__registrarGesto); });
        await gesto(width / 2, height - 12, bottom + 10);
        assert.equal(await page.evaluate(() => scrollY), 0);
        await page.touchscreen.tap(width / 2, height - 12);
        await page.waitForFunction(() => !document.documentElement.classList.contains('rolagem-bloqueada'), null, { timeout: 5000 }).catch(async erro => {
          console.error(JSON.stringify({ width, height, bottom, estado: await page.evaluate(() => ({ gestos: window.__gestos, viewport: [innerHeight,visualViewport.height,visualViewport.offsetTop,visualViewport.scale], elemento: document.elementFromPoint(innerWidth / 2, innerHeight - 12)?.outerHTML.slice(0,200), menu: document.querySelector('.app').className, nav: document.querySelector('#nav').getBoundingClientRect().toJSON() })) }));
          await page.screenshot({ path: `${pasta}/falha-menu.png` }); throw erro;
        });
        assert.equal(await page.evaluate(() => scrollY), 400);
        await page.evaluate(() => { for (const tipo of ['pointerdown','pointerup','click','touchcancel']) document.removeEventListener(tipo, window.__registrarGesto); });
      }
    }
  }
  // Mudar de orientação ou atravessar o breakpoint não deixa o corpo bloqueado.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { irPara('painel'); scrollTo(0, 600); });
  await page.locator('.btn-menu').tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => document.querySelector('#nav').getBoundingClientRect().bottom <= innerHeight + 1);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('rolagem-bloqueada'));
  assert.equal(await page.evaluate(() => scrollY), 600);
  assert.equal(await page.locator('.principal').evaluate(el => el.inert), false);
  // Todas as páginas, inclusive filtros expandidos, gráficos em tabela e fichas.
  for (const tema of ['dark', 'light']) {
    await page.evaluate(tema => document.documentElement.dataset.theme = tema, tema);
    for (const [width, height] of [[320,568], [390,844], [600,800], [768,1024], [844,390], [900,600], [901,600], [1024,768], [1280,720], [1920,1080]]) {
      await page.setViewportSize({ width, height });
      for (const pagina of ['painel','cobrancas','usadas','consulta','inventario','estoque','tecnicos','importar','config','ficha-novas']) {
        await page.evaluate(pagina => {
          if (pagina === 'ficha-novas') {
            irPara('tecnicos', { tid: derivar().tecnicos.find(t => t.tipo === 'tecnico' && t.novasLinhas.length).tid }); UI.ficha.aba = 'novas'; renderizar(true);
          } else irPara(pagina);
          document.querySelectorAll('details').forEach(el => { el.open = true; });
          if (pagina === 'painel') { UIpainel.tabelas = new Set(['idade','evolucao']); renderizar(true); }
        }, pagina);
        if (pagina === 'inventario') await page.waitForFunction(() => !UIinventario.carregando);
        await semCorte(`${tema}/${width}/${pagina}`);
        assert.deepEqual(await page.locator('.cob-acoes .btn').evaluateAll(es => es.filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.textContent)), [], 'ações de cobrança sem textos cortados');
      }
      await page.evaluate(() => { irPara('painel'); scrollTo(0, 600); });
      const antes = await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top);
      for (const tipo of ['cadastro','previsao','cobranca','ranking']) {
        await page.evaluate(tipo => {
          const t = derivar().cobrarTec[0];
          if (tipo === 'cadastro') modalTecnico(t.tid);
          if (tipo === 'previsao') modalPrevisao(t.usadas);
          if (tipo === 'cobranca') modalCobrar(t.tid);
          if (tipo === 'ranking') modalRanking(t.tid, 'atraso');
        }, tipo);
        await janelaNaTela();
        const corpo = page.locator('.modal-corpo');
        await corpo.evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert.ok(Math.abs(await page.locator('#conteudo').evaluate(el => el.getBoundingClientRect().top) - antes) <= 1, 'modal não desloca o fundo');
        for (const campo of await page.locator('.modal input:not([type="checkbox"]):not([type="range"]), .modal select, .modal textarea').all()) {
          assert.ok(await campo.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), 'campos de toque evitam zoom automático');
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => scrollY), 600);
      }
    }
  }
  // Diálogo sobre diálogo: fechar o de cima mantém o fundo travado.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => modalCobrar(derivar().cobrarTec[0].tid));
  await page.locator('.modal [data-acao="editar-tecnico"]').click();
  assert.equal(await page.locator('.modal-fundo').first().evaluate(el => el.inert), true);
  await page.setViewportSize({ width: 390, height: 340 }); // área útil reduzida, como com teclado
  await janelaNaTela();
  await page.locator('.modal').last().locator('[name="obs"]').fill('Texto fictício para conferir a rolagem do formulário.');
  await janelaNaTela();
  await page.screenshot({ path: `${pasta}/formulario-altura-reduzida.png` });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rolagem-bloqueada')), true);
  assert.equal(await page.locator('.modal-fundo').evaluate(el => el.inert), false);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rolagem-bloqueada')), false);
  // Conta e cadastro: renderizar dados fictícios, sem inicializar Firebase.
  await page.evaluate(() => {
    if (Armazem.online) throw Error('Teste exige memória');
    Acesso.modo = 'firebase'; Acesso.perfil = { ativo: true, perfil: 'administrador' };
    Acesso.usuario = { email: 'ana.responsividade@empresa-ficticia.example' };
    E.usuarios = [{ ...Acesso.usuario, ativo: true, perfil: 'administrador', principal: true }];
  });
  for (const width of [320,768,1024,1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const pagina of ['conta','usuarios']) { await page.evaluate(pagina => irPara(pagina), pagina); await semCorte(pagina); }
    await page.evaluate(() => modalUsuario()); await janelaNaTela(); await page.keyboard.press('Escape');
  }
  // Tela real de login com provedor simulado; nenhum acesso externo é iniciado.
  await page.evaluate(() => {
    pedirLogin({ onAuthStateChanged(fn) { window.__terminarLogin = fn; return () => {}; } }, {});
  });
  for (const tema of ['dark','light']) {
    await page.evaluate(tema => document.documentElement.dataset.theme = tema, tema);
    for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,600],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator('#acesso').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'login sem corte lateral');
      await page.locator('#entrar-microsoft').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#entrar-microsoft').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, 'provedores alcançáveis na tela de login');
      if (width === 390) await page.screenshot({ path: `${pasta}/login-${tema}.png` });
    }
  }
  await page.evaluate(() => window.__terminarLogin({ email: 'teste@example.test' }));
  await page.waitForFunction(() => !document.documentElement.classList.contains('rolagem-bloqueada'));
  assert.equal(await page.locator('.principal').evaluate(el => el.inert), false);
  assert.deepEqual(erros, []);
  console.log('PASSOU: gestos reais de toque, rolagem isolada, posição preservada, foco/Escape, orientação, 320–1920px, dois temas, páginas e filtros, janelas aninhadas, altura reduzida, conta/cadastro e login.');
} finally { await browser.close(); }
