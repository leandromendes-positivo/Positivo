// Fluxo local da central de operações. Nunca importa dados no Firebase real.
// python3 build.py; python3 -m http.server 8000 --directory dist
// PW_PATH=/caminho/playwright CHROMIUM=/usr/bin/chromium node testes/operacao-e2e.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright");
const saida = process.argv[2] || "capturas/operacao";
fs.mkdirSync(saida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const page = await context.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = "2026-10-05T09:00:00"; });
  await page.goto(process.env.URL_PAINEL_TESTE || "http://127.0.0.1:8000/pagina-completa.html");
  await page.waitForFunction(() => E.status === "pronto");
  assert.equal(await page.evaluate(() => Acesso.modo), "memoria", "teste exige o HTML local sem Firebase");
  assert.equal(await page.locator(".boas-vindas").count(), 1);
  await page.locator(".hero-arte").evaluate((img) => img.decode());
  assert.ok(await page.locator(".hero-arte").evaluate((img) => img.naturalWidth > 0));

  const arquivos = fs.readdirSync("exemplos").filter((f) => f.endsWith(".csv")).map((f) => path.resolve("exemplos", f));
  const parcial = await context.newPage();
  await parcial.goto(process.env.URL_PAINEL_TESTE || "http://127.0.0.1:8000/pagina-completa.html");
  await parcial.waitForFunction(() => E.status === "pronto");
  assert.equal(await parcial.evaluate(() => Acesso.modo), "memoria");
  await parcial.setInputFiles("#entrada-topo", arquivos.filter((f) => /PR Usadas/.test(f)));
  await parcial.waitForFunction(() => !!UI.im.resultado);
  await parcial.locator('[data-nav="painel"]').click();
  assert.equal(await parcial.locator(".indicadores-operacao .kpi").last().locator(".kpi-valor").innerText(), "—", "sem relatório de novas não significa estoque zero");
  assert.match(await parcial.locator(".cartao-reposicao").innerText(), /Falta a planilha/);
  await parcial.locator('[data-acao="painel-mapa-modo"][data-modo="novas"]').click();
  assert.equal(await parcial.locator('.mapa-estado[role="button"]').count(), 0);
  await parcial.close();
  await page.setInputFiles("#entrada-topo", arquivos);
  await page.waitForFunction(() => !!UI.im.resultado);
  await page.locator('[data-nav="painel"]').click();
  assert.equal(await page.locator(".mapa-estado").count(), 27);
  assert.equal(await page.locator('.mapa-estado[role="button"]').count(), 2);
  assert.equal(await page.locator(".fila-operacao li").count(), 3);
  assert.equal(await page.locator(".anel-prazos strong").innerText(), "50%");

  // Estados sem planilha não são mostrados como zero pendências.
  assert.match(await page.locator('.mapa-estado[aria-label^="Acre,"]').getAttribute("aria-label"), /sem planilha/);
  const sc = page.locator('.mapa-estado[data-regiao="SC"]');
  await sc.focus(); await page.keyboard.press("Enter");
  assert.equal(await page.locator(".mapa-detalhe h3").innerText(), "Santa Catarina");
  assert.equal(await page.locator(".mapa-numero").innerText(), "1\npeças para cobrar");
  await page.evaluate(() => { UI.us.tid = "filtro-antigo"; UI.us.busca = "filtro-antigo"; });
  await page.locator('[data-acao="painel-regiao-abrir"]').click();
  assert.deepEqual(await page.evaluate(() => [UI.pagina, UI.us.regiao, UI.us.tid, UI.us.busca]), ["usadas", "SC", "", ""]);
  await page.locator('[data-nav="painel"]').click();
  await page.locator('[data-acao="painel-mapa-modo"][data-modo="novas"]').click();
  await page.locator('[data-acao="painel-regiao-abrir"]').click();
  assert.deepEqual(await page.evaluate(() => [UI.pagina, UI.es.regiao, UI.es.bases]), ["estoque", "SC", false]);
  await page.locator('[data-nav="painel"]').click();

  // Cobrança real pela interface atualiza a fila e a agenda, mas não dá baixa.
  await page.locator('.fila-operacao [data-acao="cobrar"]').first().click();
  await page.fill('input[name="previsao"]', "2026-10-08");
  await page.locator("[data-registrar]").click();
  await page.waitForFunction(() => !document.querySelector(".modal") && derivar().kpi.cobrarTecnicos === 2);
  await page.locator('[data-acao="painel-dia"][data-dia="2026-10-08"]').click();
  assert.equal(await page.locator(".agenda-resumo > strong").innerText(), "2 peças previstas");
  assert.equal(await page.evaluate(() => derivar().kpi.usadas), 10);
  assert.equal(await page.evaluate(() => E.devolucoes.length), 0);

  // Uma previsão de hoje deve virar cobrança no dia seguinte.
  await page.evaluate(async () => { await definirPrevisao([derivar().cobrarTec[0].itensCobrar[0]], "2026-10-05"); });
  await page.locator('[data-acao="painel-fila"][data-fila="hoje"]').click();
  assert.equal(await page.locator(".fila-operacao li").count(), 1);
  await page.evaluate(() => { window.__CP_AGORA = "2026-10-06T09:00:00"; mudou(); });
  await page.locator('[data-acao="painel-fila"][data-fila="vencidas"]').click();
  assert.equal(await page.locator(".fila-operacao li").count(), 1);
  await page.locator('.cartao-fila [data-acao="painel-cobrancas"]').click();
  assert.equal(await page.evaluate(() => UI.cob.aba), "vencidas");
  assert.equal(await page.locator(".cob").count(), 1);

  // A quantidade vem de Qtd, não do número de linhas ou de técnicos.
  assert.deepEqual(await page.evaluate(() => {
    const [hoje] = agendaDoPainel({ hoje: "2026-10-06", itens: [
      { tid: "A", previsao: "2026-10-06", qtd: 3 }, { tid: "A", previsao: "2026-10-06", qtd: 2 },
    ] });
    return [hoje.qtd, hoje.tecnicos.size];
  }), [5, 1]);

  const dia2 = arquivos.map((f) => {
    let texto = fs.readFileSync(f).toString("latin1");
    if (/PR Usadas/.test(f)) texto = texto.split("\n").filter((l) => !l.includes("60000000004")).join("\n");
    return { name: path.basename(f), mimeType: "text/csv", buffer: Buffer.from(texto, "latin1") };
  });
  await page.setInputFiles("#entrada-topo", dia2);
  await page.waitForFunction(() => !!UI.im.resultado && E.importacoes.length === 2);
  await page.locator('[data-nav="painel"]').click();
  assert.equal(await page.evaluate(() => derivar().kpi.usadas), 9);
  assert.equal(await page.evaluate(() => E.devolucoes.length), 1);
  assert.equal(await page.locator('.grafico[data-grafico="evolucao"] svg').count(), 1);
  assert.equal(await page.locator(".cartao-devolucoes .lista-simples li").count(), 1);
  await page.locator('[data-acao="painel-periodo"][data-periodo="7"]').click();
  assert.equal(await page.evaluate(() => historicoDoPainel().length), 2);
  await page.locator('[data-acao="alternar-tabela"][data-grafico="evolucao"]').click();
  assert.equal(await page.locator(".cartao-evolucao tbody tr").count(), 2);
  await page.locator('[data-acao="alternar-tabela"][data-grafico="evolucao"]').click();
  await page.locator('[data-acao="painel-reposicao"]').click();
  assert.deepEqual(await page.evaluate(() => [UI.pagina, UI.es.status, UI.es.regiao, UI.es.bases]), ["estoque", "abaixo", "", false]);
  await page.locator('[data-nav="painel"]').click();
  await page.locator('[data-acao="painel-fila"][data-fila="cobrar"]').click();
  await page.locator('[data-acao="painel-mapa-modo"][data-modo="usadas"]').click();
  await page.evaluate(() => { document.getElementById("toasts").innerHTML = ""; });
  await page.locator(".hero-arte").evaluate((img) => img.decode());
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${saida}/claro.png`, fullPage: true });
  await page.screenshot({ path: `${saida}/claro-topo.png` });
  await page.locator('.acoes-topo [data-acao="tema"]').click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.screenshot({ path: `${saida}/escuro.png`, fullPage: true });
  await page.screenshot({ path: `${saida}/escuro-topo.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem overflow em ${width}px`);
    await page.screenshot({ path: `${saida}/celular-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".operacao-hero").evaluate((el) => getComputedStyle(el).animationName), "none");
  assert.deepEqual(erros, []);
  console.log("PASSOU: mapa e filtros, cobrança, agenda, previsões vencidas, quantidade, devolução na nova planilha, evolução, reposição, temas e celular (320/390px).");
  await context.close();
} finally {
  await browser.close();
}
