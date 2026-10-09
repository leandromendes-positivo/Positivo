// Todos os responsáveis, inclusive tipos legados e nomes numéricos, são técnicos.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria', 'nunca importar no Firebase real');
  const importado = await page.evaluate(async () => {
    window.__nomesCampo = ['Ana Exemplo', '110399001', 'Legado Exemplo'];
    window.__importarCampo = async nomes => importarLote(['usadas', 'novas'].map(tipo => ({
      tipo, regiao: 'PR', nome: `PR ${tipo}.csv`, hash: tipo + nomes.join(','), avisos: [], linhasLidas: nomes.length,
      itens: nomes.map(nome => ({ tecChave: nome, tecNome: nome, mat: tipo === 'usadas' ? '123' : '456', desc: 'Peça de teste', qtd: tipo === 'usadas' ? 2 : 12, tipoEnvio: 'BACKUP', nf: 'NF-' + nome, remessa: 'REM', chamado: 'CH-' + nome, dataFT: '2026-09-20' })),
    })));
    await __importarCampo(__nomesCampo);
    const inicial = E.cadastro[idSeguro('110399001')].tipo;
    await Armazem.mesclar('cadastro/tecnicos', { t: { [idSeguro('110399001')]: { tipo: 'base' }, [idSeguro('Legado Exemplo')]: { tipo: 'ignorar', prazoUsadas: 9 } } }, true);
    await carregarTudo();
    const D = derivar();
    return { inicial, total: D.tecnicos.length, usadas: D.kpi.usadas, novas: D.kpi.novas, excesso: D.kpi.excessoNovas, atraso: calcularDesempenho().atraso.length, consulta: filtrarConsulta(linhasConsulta(), { ...FILTROS_CONSULTA, responsavel: 'base' }).length };
  });
  assert.deepEqual(importado, { inicial: 'tecnico', total: 3, usadas: 6, novas: 36, excesso: 6, atraso: 3, consulta: 6 });
  for (const pagina of ['tecnicos', 'estoque', 'consulta', 'usadas', 'cobrancas']) {
    await page.evaluate(p => irPara(p), pagina);
    assert.doesNotMatch(await page.locator('#conteudo').innerText(), /Base \/ depósito|Bases e depósitos|Ignorados|Somente técnicos|Somente bases/);
    assert.equal(await page.locator('[data-mudar="tipo-tecnico"], [data-acao="tipo-tc"], [data-acao="bases-es"], [name="responsavel"]').count(), 0);
  }
  await page.evaluate(() => irPara('tecnicos'));
  assert.equal(await page.locator('#conteudo th .ic-whatsapp').count(), 1);
  assert.equal(await page.locator('#conteudo tbody tr').count(), 3);
  const celulas = await page.locator('#conteudo table').evaluate(t => [...t.tBodies[0].rows].map(r => r.cells.length === t.tHead.rows[0].cells.length));
  assert.ok(celulas.every(Boolean), 'colunas alinhadas após retirar Tipo');
  await page.getByRole('button', { name: 'Editar 110399001', exact: true }).click();
  const modal = page.locator('.modal-fundo');
  assert.equal(await modal.locator('[name="tipo"]').count(), 0);
  assert.equal(await modal.locator('.contato-whatsapp .ic-whatsapp').count(), 1);
  await modal.locator('[name="telefone"]').fill('(41) 99999-9999');
  await modal.locator('[name="localidade"]').selectOption('interior');
  await modal.locator('[name="prazoUsadas"]').fill('8');
  await modal.locator('[data-salvar]').click();
  await modal.waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => { const c = E.cadastro['110399001']; return [c.tipo, c.localidade, c.prazoUsadas, c.nome]; }), ['tecnico', 'interior', 8, '110399001']);
  fs.mkdirSync('capturas/tecnicos-campo', { recursive: true });
  for (const tema of ['dark', 'light']) for (const largura of [1440, 390]) {
    await page.setViewportSize({ width: largura, height: 1050 });
    await page.evaluate(t => { if (document.documentElement.dataset.theme !== t) Tema.alternar(); modalCobrar('110399001'); }, tema);
    assert.equal(await page.getByRole('button', { name: 'WhatsApp', exact: true }).locator('.ic-whatsapp').count(), 1);
    assert.equal(await page.locator('#cob-link .ic-whatsapp').count(), 1);
    assert.match(await page.locator('#cob-link').getAttribute('href'), /wa.me\/5541999999999/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: `capturas/tecnicos-campo/whatsapp-${tema}-${largura}.png` });
    await page.keyboard.press('Escape');
  }
  // Retirar o identificador da próxima foto zera o saldo, sem apagar responsabilidade.
  const historico = await page.evaluate(async () => {
    await __importarCampo(__nomesCampo.filter(nome => nome !== '110399001'));
    await carregarTudo(); await carregarInventario();
    const t = derivar().mapa.get('110399001');
    const linhas = linhasInventario().filter(i => i.tid === t.tid);
    return { nome: t.nomeOriginal, usadas: t.nUsadas, novas: t.novasQtd, telefone: t.telefone, historico: linhas.map(i => [i.tipo, i.estado, i.qtd]).sort() };
  });
  assert.deepEqual(historico, { nome: '110399001', usadas: 0, novas: 0, telefone: '(41) 99999-9999', historico: [['novas', 'presumida', 12], ['usadas', 'devolvida', 2]] });
  assert.deepEqual(erros, []);
  console.log('PASSOU: técnicos numéricos e legados incluídos, classificação removida, cadastro preservado, ícones WhatsApp nos dois temas e histórico após nova importação.');
} finally { await browser.close(); }
