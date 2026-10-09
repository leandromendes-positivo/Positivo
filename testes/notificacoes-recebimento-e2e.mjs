// Recebimento por conta/navegador, com recarga real usando apenas Firebase emulado.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prepararEmulador } from './emulador.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
await prepararEmulador();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  // O fuso do dispositivo é propositalmente diferente do fuso da operação.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce' });
  if (process.env.FIREBASE_SDK_DIR) await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ path: path.join(process.env.FIREBASE_SDK_DIR, r.request().url().split('/').pop()), contentType: 'application/javascript' }));
  await ctx.addInitScript(() => {
    window.__CP_AGORA = localStorage.getItem('relogio-notificacao-teste') || '2026-10-09T13:25:00Z';
    window.CP_FIREBASE = { apiKey: 'chave-de-teste', authDomain: 'demo-controle-pecas.firebaseapp.com', projectId: 'demo-controle-pecas' };
    window.__CP_FIREBASE_EMULADOR__ = true;
    window.__CP_LOGIN_TESTE__ = { sub: 'uid-teste@exemplo.com', email: 'teste@exemplo.com', email_verified: true };
  });
  const page = await ctx.newPage(), erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.fs.app.options.projectId), 'demo-controle-pecas');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  const instante = '2026-10-09T13:25:00.000Z';
  const chave = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('cp-notificacoes-recebidas-v1-')));
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).estoque.em, chave), instante, 'recebido antes de abrir o sino');
  const clock = async iso => page.evaluate(iso => { window.__CP_AGORA = iso; localStorage.setItem('relogio-notificacao-teste', iso); }, iso);
  const carimbo = () => page.locator('[data-notif-id="estoque"] time');
  const abrir = async () => { await page.locator('#botao-notificacoes').click(); await carimbo().waitFor(); };
  await clock('2026-10-09T14:30:00Z');
  await abrir();
  assert.equal(await carimbo().innerText(), 'Recebida em 09/10/2026 às 10:25');
  assert.equal(await carimbo().getAttribute('datetime'), instante);
  assert.match(await page.locator('[data-notif-local]').innerText(), /Horário de Brasília/);
  await page.locator('[data-notif-leitura="estoque"]').click();
  assert.equal(await carimbo().getAttribute('datetime'), instante);
  await page.locator('[data-notif-leitura="estoque"]').click();
  assert.equal(await carimbo().getAttribute('datetime'), instante);
  await page.locator('[data-notif-todas-lidas]').click();
  await page.keyboard.press('Escape'); await abrir();
  assert.equal(await carimbo().getAttribute('datetime'), instante, 'reabrir preserva recebimento');
  // A recarga busca novamente a base persistida; não antecipa um recebimento novo.
  await page.reload(); await page.waitForFunction(() => E.status === 'pronto'); await abrir();
  assert.equal(await carimbo().getAttribute('datetime'), instante, 'recarga preserva o recebimento');
  assert.equal(await page.locator('[data-notif-id="estoque"]').getAttribute('class'), 'notif-item lida', 'leitura anterior permanece compatível');
  // Outra aba da mesma conta usa o mesmo carimbo.
  const outra = await ctx.newPage(); await outra.goto(page.url());
  await outra.waitForFunction(() => E.status === 'pronto'); await outra.locator('#botao-notificacoes').click();
  assert.equal(await outra.locator('[data-notif-id="estoque"] time').getAttribute('datetime'), instante);
  await outra.close();
  // Mudanças relevantes são uma nova atualização, com seu próprio recebimento.
  await clock('2026-10-09T15:40:00Z');
  await page.evaluate(() => { window.__saldoRecebimento = structuredClone(E.novas); E.novas.find(n => n.qtd === 500).qtd++; mudou(); });
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T15:40:00.000Z');
  assert.equal(await page.locator('[data-notif-id="estoque"]').getAttribute('class'), 'notif-item nao-lida');
  await clock('2026-10-09T16:45:00Z');
  await page.evaluate(() => { E.novas.forEach(n => n.qtd = 0); mudou(); });
  assert.equal(await carimbo().count(), 0);
  assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).estoque, chave), undefined);
  await clock('2026-10-09T17:50:00Z');
  await page.evaluate(() => { E.novas = structuredClone(__saldoRecebimento); mudou(); });
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T17:50:00.000Z', 'mesma pendência após resolução recebe novo horário');
  // Troca de conta não reutiliza a data de recebimento da pessoa anterior.
  await clock('2026-10-09T18:55:00Z');
  await page.evaluate(() => { window.__contaRecebimento = Acesso.usuario; Acesso.usuario = { uid: 'outra-conta', email: 'outra@example.test' }; Notificacoes.atualizar(); });
  await abrir();
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T18:55:00.000Z');
  await page.evaluate(() => { Acesso.usuario = __contaRecebimento; Notificacoes.atualizar(); }); await abrir();
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T17:50:00.000Z');
  // Dado local inválido é descartado, sem exibir HTML ou data inválida.
  await page.evaluate(k => {
    const r = JSON.parse(localStorage.getItem(k)); r.estoque.em = '<img src=x onerror="window.__xss=1">'; localStorage.setItem(k, JSON.stringify(r));
  }, chave);
  await page.reload(); await page.waitForFunction(() => E.status === 'pronto'); await abrir();
  assert.equal(await carimbo().innerText(), 'Recebida em 09/10/2026 às 15:55');
  assert.equal(await page.locator('[data-notif-lista] img').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  const registro = await page.evaluate(k => localStorage.getItem(k), chave);
  assert.doesNotMatch(registro, /email|exemplo.com|nome|telefone|token/i, 'salva apenas versão e carimbo por categoria');
  // Sem armazenamento, mantém o carimbo na memória mesmo depois de ler.
  await clock('2026-10-09T19:00:00Z');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Teste', 'QuotaExceededError'); };
    E.novas.find(n => n.qtd === 500).qtd++; mudou();
  });
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T19:00:00.000Z');
  await page.evaluate(() => { window.__CP_AGORA = '2026-10-09T20:10:00Z'; });
  await page.locator('[data-notif-leitura="estoque"]').click();
  assert.equal(await carimbo().getAttribute('datetime'), '2026-10-09T19:00:00.000Z');
  assert.match(await page.locator('[data-notif-local]').innerText(), /apenas enquanto esta página/);
  fs.mkdirSync('capturas/notificacoes-recebimento', { recursive: true });
  for (const tema of ['dark','light']) for (const width of [1440, 320]) {
    await page.evaluate(t => document.documentElement.dataset.theme = t, tema);
    await page.setViewportSize({ width, height: 1000 });
    await carimbo().scrollIntoViewIfNeeded();
    const retangulo = await carimbo().boundingBox();
    assert.ok(retangulo.x >= 0 && retangulo.x + retangulo.width <= width, `${tema}/${width}: data e hora cabem na tela`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: `capturas/notificacoes-recebimento/${tema}-${width}.png` });
  }
  assert.deepEqual(erros, []);
  console.log('PASSOU: recebimento anterior à abertura, fuso de Brasília, leitura, recarga Firebase, abas/contas, alterações, reincidência, dados inválidos, armazenamento bloqueado e temas em 320–1440px.');
} finally { await browser.close(); }
