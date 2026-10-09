// Resumo e exportação preservam o significado da lista de cobrança selecionada.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.evaluate(() => {
    E.cadastro = { ana: { nome: 'Ana Exemplo', regiao: 'PR' }, bruno: { nome: 'Bruno Exemplo', regiao: 'SC' } };
    E.catalogo = { RAM: 'Memória RAM', SSD: 'SSD 256 GB' };
    const u = (k, tid, qtd, dataFT) => ({ k, tid, regiao: tid === 'ana' ? 'PR' : 'SC', qtd, dataFT, desde: dataFT, mat: 'RAM', chamado: k, nf: '', remessa: '' });
    E.usadas = [u('breve', 'ana', 2, '2026-09-29'), u('antiga', 'ana', 3, '2026-09-15'), u('vencida', 'ana', 4, '2026-09-20'), u('futura', 'bruno', 5, '2026-09-15'), u('hoje', 'bruno', 6, '2026-09-20')];
    E.novas = [{ tid: 'ana', regiao: 'PR', qtd: 12, desde: '2026-09-29', mat: 'SSD', tipoEnvio: 'BACKUP', linhas: 1 }];
    E.indice.arquivos = Object.fromEntries(['novas:PR','usadas:PR','usadas:SC'].map(k => [k,{ em: '2026-10-05 09:00', arquivo: k + '.csv' }]));
    E.acomp = { ana: { itens: { vencida: { p: '2026-10-04' } } }, bruno: { itens: { futura: { p: '2026-10-07' }, hoje: { p: '2026-10-05' } } } };
    mudou(); irPara('cobrancas');
    window.__exportarResumoOriginal = exportarExcel;
    exportarExcel = async (nome, abas) => { window.__exportacaoResumo = { nome, abas }; };
    copiarTexto = async texto => { window.__resumoCopiado = texto; };
  });
  const casos = [
    ['cobrar','Cobrar hoje',7], ['vencidas','Previsões vencidas',4], ['vencendo','Vencem em breve',2],
    ['aguardando','Com previsão',11], ['previsoes','Previsões de hoje',6], ['sem_previsao','Sem previsão',5], ['todos','Todos com pendência',20],
  ];
  for (const [aba, rotulo, qtd] of casos) {
    await page.locator(`[data-acao="aba-cob"][data-aba="${aba}"]`).click();
    await page.locator('[data-acao="copiar-resumo"]').click();
    const texto = await page.evaluate(() => __resumoCopiado);
    assert.ok(texto.includes(`Controle de peças — ${rotulo}`));
    assert.match(texto, /Peças usadas/);
    assert.ok(texto.includes(`· ${qtd} peças`), `${rotulo}: total do recorte`);
    assert.doesNotMatch(texto, /Total da operação|Técnicos para cobrar/);
    await page.locator('[data-acao="exportar-cobrancas"]').click();
    const x = await page.evaluate(() => __exportacaoResumo), resumo = Object.fromEntries(x.abas[0].linhas);
    assert.equal(x.abas[0].nome, 'Resumo da lista'); assert.equal(x.abas[1].nome, rotulo);
    assert.equal(resumo.Lista, rotulo); assert.equal(resumo['Tipo de peça'], 'Peças usadas'); assert.equal(resumo['Peças nesta lista'], qtd);
    assert.equal(resumo['Data de referência'], '05/10/2026');
    assert.equal(x.abas[1].linhas.reduce((s,l) => s + l[17], 0), qtd);
    assert.ok(x.abas[1].linhas.every(l => l.length === x.abas[1].colunas.length));
    assert.ok(x.nome.endsWith('-usadas-2026-10-05.xlsx'));
  }
  await page.locator('[data-acao="aba-cob"][data-aba="vencendo"]').click();
  await page.locator('[data-acao="regiao-cob"][data-regiao="PR"]').click();
  await page.locator('[data-digitar="busca-cob"]').fill('Ana');
  await page.locator('[data-digitar="busca-cob"]').press('Enter');
  const filtrado = await page.evaluate(() => resumoTexto());
  assert.match(filtrado, /Região: PR/); assert.match(filtrado, /Busca por técnico: Ana/);
  assert.match(filtrado, /2 peças, mais antiga nesta lista com 6 dias/);
  assert.doesNotMatch(filtrado, /20 dias|previsão vencida|Bruno/);
  // Exportação de novas e de ambos os tipos segue a seleção, sem misturar totais globais.
  for (const [tipo, rotulo, qtd] of [['novas','Peças novas',12], ['todas','Peças novas e usadas',14]]) {
    await page.locator(`[data-acao="tipo-cob"][data-tipo="${tipo}"]`).click();
    await page.locator('[data-acao="exportar-cobrancas"]').click();
    const x = await page.evaluate(() => __exportacaoResumo), resumo = Object.fromEntries(x.abas[0].linhas);
    assert.equal(resumo['Tipo de peça'], rotulo); assert.equal(resumo['Peças nesta lista'], qtd);
    assert.equal(resumo.Região, 'PR'); assert.equal(resumo['Busca por técnico'], 'Ana');
    assert.ok(x.nome.includes(`-${tipo}-`));
  }
  // Arquivo real mantém a identificação ao abrir no Excel, inclusive códigos/tipos.
  await page.evaluate(() => { exportarExcel = __exportarResumoOriginal; });
  fs.mkdirSync('capturas/resumos', { recursive: true });
  const download = page.waitForEvent('download');
  await page.locator('[data-acao="exportar-cobrancas"]').click();
  const arquivo = await download;
  assert.equal(arquivo.suggestedFilename(), 'cobrancas-vencem-em-breve-todas-2026-10-05.xlsx');
  await arquivo.saveAs('capturas/resumos/lista.xlsx');
  const livro = await page.evaluate(async bytes => {
    const XLSX = await carregarSheetJS(), x = XLSX.read(new Uint8Array(bytes), { type: 'array' });
    return { nomes: x.SheetNames, resumo: XLSX.utils.sheet_to_json(x.Sheets[x.SheetNames[0]], { header: 1 }), pecas: XLSX.utils.sheet_to_json(x.Sheets[x.SheetNames[1]]) };
  }, [...fs.readFileSync('capturas/resumos/lista.xlsx')]);
  assert.deepEqual(livro.nomes, ['Resumo da lista','Vencem em breve']);
  assert.equal(Object.fromEntries(livro.resumo.slice(1))['Peças nesta lista'], 14);
  assert.deepEqual(livro.pecas.map(p => [p.Tipo, p.Quantidade]), [['Usada',2],['Nova',12]]);
  // Lista vazia e filtros pessoais/de notificação continuam identificados.
  const vazio = await page.evaluate(async () => {
    Object.assign(UI.cob, { busca: 'Ninguém', somenteMeus: true, foco: 'sem_previsao' });
    exportarExcel = async (nome, abas) => { window.__exportacaoResumo = { nome, abas }; };
    await exportarCobrancas(); return { texto: resumoTexto(), resumo: Object.fromEntries(__exportacaoResumo.abas[0].linhas), linhas: __exportacaoResumo.abas[1].linhas };
  });
  assert.match(vazio.texto, /Vencem em breve/); assert.match(vazio.texto, /Nenhum técnico/);
  assert.equal(vazio.resumo['Peças nesta lista'], 0); assert.equal(vazio.resumo.Registros, 'Somente meus agendamentos');
  assert.match(vazio.resumo['Filtro de notificação'], /2 dias/); assert.deepEqual(vazio.linhas, []);
  assert.deepEqual(erros, []);
  console.log('PASSOU: sete listas identificadas, filtros, tipos, quantidades e idade no recorte, resumo copiado e Excel real com contexto.');
} finally { await browser.close(); }
