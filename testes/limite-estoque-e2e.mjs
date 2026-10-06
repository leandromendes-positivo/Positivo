// Regressão do teto de novas, usando somente dados fictícios no HTML em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { montarAviso } from '../aviso/enviar-aviso.mjs';
import { recalcularResumo } from '../aviso/recalcular-resumo.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria', 'nunca importar em produção');
  await page.evaluate(async () => {
    await salvarConfig({ meta: 10, tolerancia: 3 }); // configuração antiga, mantida no banco
    const linha = (nome, qtd, tipoEnvio = 'BACKUP') => ({ tecChave: nome, tecNome: nome, mat: '111', desc: 'Peça fictícia', tipoEnvio, qtd });
    window.__loteLimite = [0, 1, 9, 10, 11, 13, 14].map(q => linha(`Teste Limite ${q}`, Math.max(1, q)));
    window.__loteLimite.push(linha('Teste Próprio', 8), linha('Teste Sem Limite', 100), linha('Teste Ignorado', 500), linha('110399001', 500), linha('Teste Limite 10', 100, 'PP'));
    window.__importarLimite = async itens => importarLote([{ tipo: 'novas', regiao: 'AC', nome: 'AC Novas.csv', itens, linhasLidas: itens.length, avisos: [], hash: String(itens.length) }]);
    await window.__importarLimite(window.__loteLimite);
    const tid = nome => Object.entries(E.cadastro).find(([, c]) => c.nome === nome)[0];
    await salvarTecnico(tid('Teste Próprio'), { meta: 7 });
    await salvarTecnico(tid('Teste Sem Limite'), { meta: 0 });
    await salvarTecnico(tid('Teste Ignorado'), { tipo: 'ignorar' });
    await salvarConfig({ tiposIgnorados: ['PP'] });
    // Desaparecer da nova planilha gera saldo zero, preservando o cadastro.
    await window.__importarLimite(window.__loteLimite.filter(n => n.tecNome !== 'Teste Limite 0'));
    await carregarTudo(); // verifica a configuração legada persistida
    irPara('painel');
  });
  const estados = await page.evaluate(() => derivar().tecnicos.filter(t => t.nomeOriginal.startsWith('Teste Limite ')).map(t => [Number(t.nomeOriginal.split(' ').at(-1)), t.novasQtd, t.statusNovas, t.excessoNovas]).sort((a,b) => a[0]-b[0]));
  assert.deepEqual(estados, [[0,0,'ideal',0],[1,1,'ideal',0],[9,9,'ideal',0],[10,10,'ideal',0],[11,11,'acima',1],[13,13,'acima',3],[14,14,'acima',4]]);
  assert.deepEqual(await page.locator('.kpi-estoque .kpi-partes strong').allTextContents(), ['4','4','1']);
  const resumo = await page.evaluate(() => montarResumo());
  assert.deepEqual(resumo.estoque, { regra: 'limite_maximo', excesso: 9, acima: 4, ideal: 4, totalNovas: 166 });
  const aviso = montarAviso(resumo, '2026-10-05');
  assert.match(aviso.texto, /4 técnicos dentro do limite e 4 técnicos acima; 9 peças em excesso/);
  assert.doesNotMatch(aviso.html, /abaixo da meta|repor|reposição/);
  const legado = montarAviso({ ...resumo, estoque: { abaixo: [{ nome: 'Legado' }], ideal: 2, acima: 1 } }, '2026-10-05');
  assert.match(legado.texto, /consulte o painel atualizado/);

  // O cálculo usado no aviso diário lê os documentos persistidos com a mesma regra.
  const docs = await page.evaluate(() => Armazem.db.exportar());
  const snapshot = (id, dados) => ({ id, exists: dados !== undefined, data: () => dados });
  const db = {
    doc: caminho => ({ get: async () => snapshot(caminho.split('/').at(-1), docs[caminho]) }),
    collection: caminho => {
      let linhas = Object.entries(docs).filter(([c]) => c.startsWith(caminho + '/') && c.split('/').length === 2).map(([c,d]) => snapshot(c.split('/')[1], d));
      const q = {
        where: (f, op, v) => { assert.equal(op, '>='); linhas = linhas.filter(d => d.data()[f] >= v); return q; },
        orderBy: (f, sentido) => { linhas.sort((a,b) => String(a.data()[f]).localeCompare(String(b.data()[f])) * (sentido === 'desc' ? -1 : 1)); return q; },
        limit: n => { linhas = linhas.slice(0,n); return q; },
        get: async () => ({ docs: linhas }),
      }; return q;
    },
  };
  const servidor = await recalcularResumo(db, '2026-10-05');
  assert.deepEqual(JSON.parse(JSON.stringify(servidor.estoque)), resumo.estoque);

  await page.locator('[data-acao="painel-mapa-modo"][data-modo="novas"]').click();
  assert.match(await page.locator('.mapa-numero').innerText(), /4\s+técnicos acima do limite/);
  assert.match(await page.locator('.mapa-risco').innerText(), /50%/);
  assert.equal(await page.locator('.excesso-lista li').count(), 4);
  await page.locator('[data-acao="painel-excesso"]').click();
  assert.equal(await page.locator('.tabela-estoque tbody > tr').count(), 4);
  assert.doesNotMatch(await page.locator('.tabela-estoque').innerText(), /Teste Limite (0|1|9|10)\s/);
  await page.locator('.chip[data-status="ideal"]').click();
  assert.equal(await page.locator('.tabela-estoque tbody > tr').count(), 4);
  assert.match(await page.locator('.tabela-estoque').innerText(), /Teste Limite 0/);
  assert.doesNotMatch(await page.locator('.tabela-estoque').innerText(), /Repor|Excesso de|undefined|NaN/);
  await page.locator('.tabela-estoque [data-acao="tecnico"]').filter({ hasText: 'Teste Limite 0' }).click();
  assert.match(await page.locator('.ficha-corpo').innerText(), /Dentro do limite/);
  assert.match(await page.locator('.ficha-corpo').innerText(), /Sem peças novas no relatório/);

  const exportacoes = await page.evaluate(async () => {
    const original = exportarExcel, saidas = [];
    exportarExcel = async (nome, planilhas) => saidas.push({ nome, planilhas });
    try { await exportarEstoque(); await exportarTecnicos(); await exportarTudo(); }
    finally { exportarExcel = original; }
    return saidas;
  });
  const estoque = exportacoes[0].planilhas[0];
  const col = nome => estoque.colunas.findIndex(c => c.titulo === nome);
  const zero = estoque.linhas.find(l => l[0] === 'Teste Limite 0');
  assert.equal(zero[col('Excesso')], 0);
  assert.equal(zero[col('Situação')], 'Dentro do limite');
  const onze = estoque.linhas.find(l => l[0] === 'Teste Limite 11');
  assert.equal(onze[col('Excesso')], 1);
  assert.equal(onze[col('Limite máximo')], 10);
  for (const exportacao of exportacoes) assert.ok(exportacao.planilhas.some(p => p.linhas.some(l => l[0] === 'Teste Limite 0')), 'saldo zero continua nas exportações');

  await page.evaluate(async () => { await salvarConfig({ tolerancia: 100 }); await carregarTudo(); });
  assert.equal(await page.evaluate(() => derivar().kpi.acima), 4, 'tolerância legada nunca aumenta o teto');
  // Todas as peças devolvidas: não pedir reposição nem ocultar técnicos com zero.
  await page.evaluate(async () => { await window.__importarLimite([]); await carregarTudo(); irPara('painel'); });
  assert.match(await page.locator('.cartao-excesso').innerText(), /Nenhum estoque acima do limite/);
  assert.deepEqual(await page.locator('.kpi-estoque .kpi-partes strong').allTextContents(), ['8','0','1']);
  assert.deepEqual(erros, []);
  console.log('PASSOU: 0–10 regular, 11+ em excesso, tolerância legada ignorada, limites pessoais, filtros, mapa, saldo zero, exportações e aviso diário.');
} finally { await browser.close(); }
