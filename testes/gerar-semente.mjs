// Roda a importação no navegador (banco em memória) e salva cada documento em JSON,
// para carregar no banco do painel publicado. Uso: node testes/gerar-semente.mjs <pasta-csv> <saida> <AAAA-MM-DDTHH:MM:SS>
import { createRequire } from "module"; import fs from "fs"; import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node-tools/node_modules/playwright");
const [pasta, saida, quando] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext()).newPage();
await page.addInitScript((q) => { window.__CP_AGORA = q; window.__CP_SEM_DB__ = true; }, quando);
await page.goto("file://" + path.resolve("dist/pagina-completa.html"));
await page.waitForFunction(() => typeof E !== "undefined" && E.status === "pronto");
await page.setInputFiles("#entrada-topo", fs.readdirSync(pasta).filter((f) => /\.(csv|xlsx)$/i.test(f)).map((f) => path.join(pasta, f)));
await page.waitForFunction(() => UI.im.resultado || UI.im.erro, null, { timeout: 60000 });
const erro = await page.evaluate(() => UI.im.erro);
if (erro) { console.error(erro); process.exit(1); }
await page.waitForTimeout(3500); // resumo agendado
const docs = await page.evaluate(() => Armazem.db.exportar());
fs.rmSync(saida, { recursive: true, force: true });
for (const [caminho, dados] of Object.entries(docs)) {
  const destino = path.join(saida, caminho + ".json");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(dados));
  console.log(caminho, (JSON.stringify(dados).length / 1024).toFixed(1) + " KB");
}
await browser.close();
