// Teste de ponta a ponta: abre o painel no Chromium, importa as planilhas e confere os números.
// Uso: node testes/e2e.mjs <pasta-com-os-csv> <pasta-de-saida-das-capturas>
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node-tools/node_modules/playwright");

const pastaCSV = process.argv[2];
const saida = process.argv[3] || "capturas";
fs.mkdirSync(saida, { recursive: true });
const pagina = "file://" + path.resolve("dist/pagina-completa.html");
const arquivos = fs.readdirSync(pastaCSV).filter((f) => f.endsWith(".csv")).map((f) => path.join(pastaCSV, f));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text()); });
await page.addInitScript(() => { window.__CP_AGORA = "2026-10-05T14:00:00"; });
await page.goto(pagina);
await page.waitForFunction(() => typeof E !== "undefined" && E.status === "pronto");
await page.screenshot({ path: `${saida}/00-vazio.png`, fullPage: true });

await page.setInputFiles("#entrada-topo", arquivos);
await page.waitForFunction(() => UI.im.resultado || UI.im.erro, null, { timeout: 60000 });
const erroImp = await page.evaluate(() => UI.im.erro);
if (erroImp) { console.error("ERRO NA IMPORTAÇÃO:", erroImp); }
const r1 = await page.evaluate(() => {
  const D = derivar();
  return { kpi: D.kpi, faixas: D.faixas.map((f) => [f.rotulo, f.valor]), porRegiao: D.porRegiao, cobrar: D.cobrarTec.slice(0, 8).map((t) => [t.nome, t.regiao, t.nCobrar, t.maxDias]), resultados: UI.im.resultado.resultados.map((r) => [r.nome, r.tipo, r.regiao, r.linhas, r.itens, r.qtd, r.entradas, r.saidas]), docs: Object.keys(Armazem.db.exportar()).length };
});
console.log(JSON.stringify(r1, null, 1));
await page.screenshot({ path: `${saida}/01-importar-resultado.png`, fullPage: true });

for (const [pag, nome] of [["painel", "02-painel"], ["cobrancas", "03-cobrancas"], ["usadas", "04-usadas"], ["estoque", "05-estoque"], ["tecnicos", "06-tecnicos"], ["config", "08-config"]]) {
  await page.evaluate((p) => irPara(p), pag);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${saida}/${nome}.png`, fullPage: true });
}
// ficha de um técnico
await page.evaluate(() => irPara("tecnicos", { tid: derivar().cobrarTec[0].tid }));
await page.waitForTimeout(200);
await page.screenshot({ path: `${saida}/07-ficha.png`, fullPage: true });

// janela de cobrança e registro com previsão
await page.evaluate(() => irPara("cobrancas"));
await page.click(".cob .btn.prim");
await page.waitForSelector(".modal");
await page.screenshot({ path: `${saida}/09-modal-cobrar.png` });
await page.fill('input[name="previsao"]', "2026-10-08");
await page.fill('input[name="obs"]', "Vai deixar na base na quinta");
await page.click("[data-registrar]");
await page.waitForTimeout(300);
const aposCob = await page.evaluate(() => { const D = derivar(); return { cobrarTec: D.kpi.cobrarTecnicos, aguardando: D.kpi.aguardando }; });
console.log("após registrar cobrança com previsão:", JSON.stringify(aposCob));

// ---------- DIA 2: algumas peças devolvidas, outras novas
const dir2 = fs.mkdtempSync("/tmp/claude-0/dia2-");
for (const f of arquivos) {
  const buf = fs.readFileSync(f);
  let txt = buf.toString("latin1");
  const nome = path.basename(f);
  if (/Usadas/i.test(nome)) {
    const linhas = txt.split(/\r?\n/);
    // remove 1 de cada 3 linhas (devolvidas) e acrescenta uma peça nova
    const mantidas = linhas.filter((l, i) => i === 0 || !l.trim() || i % 3 !== 0);
    const exemplo = linhas[1].split(";");
    exemplo[7] = "99999999999"; exemplo[8] = "06/10/2026 09:00:00";
    mantidas.splice(1, 0, exemplo.join(";"));
    txt = mantidas.join("\r\n");
  }
  fs.writeFileSync(path.join(dir2, nome), Buffer.from(txt, "latin1"));
}
await page.evaluate(() => { window.__CP_AGORA = "2026-10-06T08:30:00"; mudou(); });
await page.setInputFiles("#entrada-topo", fs.readdirSync(dir2).map((f) => path.join(dir2, f)));
await page.waitForFunction(() => !UI.im.processando && UI.im.resultado && UI.im.resultado.lote !== window.__lote1, null, { timeout: 60000 });
const r2 = await page.evaluate(() => {
  const D = derivar();
  return { kpi: D.kpi, devolucoes: E.devolucoes.length, historico: E.historico.map((h) => [h.data, h.tot.usadas, h.tot.atrasadas]), imp: E.importacoes.map((i) => [i.em, i.devolvidas, i.desfeito]), resultados: UI.im.resultado.resultados.map((r) => [r.nome, r.entradas, r.saidas, r.saidasQtd]) };
});
console.log("DIA 2:", JSON.stringify(r2, null, 1));
await page.screenshot({ path: `${saida}/10-dia2-importar.png`, fullPage: true });
await page.evaluate(() => irPara("painel"));
await page.waitForTimeout(250);
await page.screenshot({ path: `${saida}/11-dia2-painel.png`, fullPage: true });

// desfazer a última importação
await page.evaluate(() => irPara("importar"));
await page.click('[data-acao="desfazer"]');
await page.click("[data-ok]");
await page.waitForFunction(() => E.importacoes[0].desfeito === true || E.importacoes.some((i) => i.desfeito), null, { timeout: 20000 });
await page.waitForTimeout(400);
const r3 = await page.evaluate(() => { const D = derivar(); return { usadas: D.kpi.usadas, devolucoes: E.devolucoes.length, indice: Object.fromEntries(Object.entries(E.indice.arquivos).map(([k, v]) => [k, v && v.gen])) }; });
console.log("APÓS DESFAZER:", JSON.stringify(r3));

// tema escuro e celular
await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); irPara("painel"); });
await page.waitForTimeout(250);
await page.screenshot({ path: `${saida}/12-painel-escuro.png`, fullPage: true });
await page.evaluate(() => { document.documentElement.removeAttribute("data-theme"); });
await page.setViewportSize({ width: 400, height: 860 });
await page.evaluate(() => irPara("painel"));
await page.waitForTimeout(300);
await page.screenshot({ path: `${saida}/13-celular-painel.png`, fullPage: true });
await page.evaluate(() => irPara("cobrancas"));
await page.waitForTimeout(300);
await page.screenshot({ path: `${saida}/14-celular-cobrancas.png`, fullPage: true });
const larguraExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log("rolagem horizontal no celular (px):", larguraExtra);

console.log("ERROS:", erros.length ? erros.join("\n") : "nenhum");
await browser.close();
