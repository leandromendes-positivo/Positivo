// Teste do painel com o banco no Firebase, usando os emuladores oficiais (Auth + Firestore).
//
//   1. firebase emulators:start --only auth,firestore --project demo-controle-pecas
//      (com firestore.rules liberando teste@exemplo.com)
//   2. python3 -m http.server 8000 --directory dist/site
//   3. node testes/firebase-e2e.mjs exemplos capturas
//
// FIREBASE_SDK_DIR: pasta com cópias locais do SDK (firebase-*-compat.js), se o navegador de
// teste não alcançar www.gstatic.com.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node-tools/node_modules/playwright");

const [pastaCSV = "exemplos", saida = "capturas"] = process.argv.slice(2);
fs.mkdirSync(saida, { recursive: true });
const URL_SITE = process.env.URL_SITE || "http://127.0.0.1:8000/index.html";
const arquivos = fs.readdirSync(pastaCSV).filter((f) => /\.csv$/i.test(f)).map((f) => path.join(pastaCSV, f));
const CONFIG = { apiKey: "chave-de-teste", authDomain: "demo-controle-pecas.firebaseapp.com", projectId: "demo-controle-pecas" };
const falhas = [];
const conferir = (cond, msg) => { console.log(`${cond ? "ok  " : "FALHOU"} ${msg}`); if (!cond) falhas.push(msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function abrir({ email = "teste@exemplo.com", agora = "2026-10-05T09:00:00", login = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (process.env.FIREBASE_SDK_DIR) {
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => {
      const nome = r.request().url().split("/").pop();
      r.fulfill({ path: path.join(process.env.FIREBASE_SDK_DIR, nome), contentType: "application/javascript" });
    });
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => falhas.push("erro na página: " + e.message));
  await page.addInitScript(({ cfg, email, agora, login }) => {
    window.CP_FIREBASE = cfg;
    window.__CP_FIREBASE_EMULADOR__ = true;
    window.__CP_AGORA = agora;
    if (login) window.__CP_LOGIN_TESTE__ = { sub: "uid-" + email, email, email_verified: true };
  }, { cfg: CONFIG, email, agora, login });
  await page.goto(URL_SITE);
  return { ctx, page };
}
const pronto = (page) => page.waitForFunction(() => typeof E !== "undefined" && (E.status === "pronto" || E.status === "erro"), null, { timeout: 30000 });
const numeros = (page) => page.evaluate(() => {
  const D = derivar();
  return { modo: Acesso.modo, online: Armazem.online, email: Acesso.usuario && Acesso.usuario.email, usadas: D.kpi.usadas, atrasadas: D.kpi.atrasadas, cobrar: D.kpi.cobrarTecnicos, novas: D.kpi.novas, devolucoes: E.devolucoes.length, importacoes: E.importacoes.length };
});

// 1) primeira importação
let { ctx, page } = await abrir();
await pronto(page);
let n = await numeros(page);
conferir(n.modo === "firebase" && n.online && n.email === "teste@exemplo.com", `entrou no Firebase como ${n.email}`);
await page.setInputFiles("#entrada-topo", arquivos);
await page.waitForFunction(() => UI.im.resultado || UI.im.erro, null, { timeout: 60000 });
const erroImp = await page.evaluate(() => UI.im.erro);
conferir(!erroImp, "importação sem erro" + (erroImp ? `: ${erroImp}` : ""));
n = await numeros(page);
conferir(n.usadas === 10 && n.atrasadas === 5 && n.cobrar === 3 && n.novas === 46, `números do dia 1: ${JSON.stringify(n)}`);
// cobrança com previsão
await page.evaluate(() => irPara("cobrancas"));
await page.click(".cob .btn.prim");
await page.waitForSelector(".modal");
await page.fill('input[name="previsao"]', "2026-10-08");
await page.click("[data-registrar]");
await page.waitForFunction(() => !document.querySelector(".modal"));
await page.waitForTimeout(800);
await page.screenshot({ path: `${saida}/fb-1-cobrancas.png`, fullPage: true });
await ctx.close();

// 2) reabrir: os dados vêm do Firestore
({ ctx, page } = await abrir());
await pronto(page);
n = await numeros(page);
conferir(n.usadas === 10 && n.cobrar === 2 && n.importacoes === 1, `dados persistidos após reabrir: ${JSON.stringify(n)}`);
const cobrancas = await page.evaluate(() => Object.values(E.acomp).reduce((s, a) => s + (a.cobrancas || []).length, 0));
conferir(cobrancas === 1, `cobrança registrada guardada (${cobrancas})`);
await ctx.close();

// 3) dia seguinte: uma peça usada devolvida
const dir2 = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "dia2-"));
for (const f of arquivos) {
  let txt = fs.readFileSync(f).toString("latin1");
  if (/PR Usadas/i.test(f)) txt = txt.split("\n").filter((l) => !l.includes("60000000004")).join("\n");
  fs.writeFileSync(path.join(dir2, path.basename(f)), Buffer.from(txt, "latin1"));
}
({ ctx, page } = await abrir({ agora: "2026-10-06T08:30:00" }));
await pronto(page);
await page.setInputFiles("#entrada-topo", fs.readdirSync(dir2).map((f) => path.join(dir2, f)));
await page.waitForFunction(() => UI.im.resultado || UI.im.erro, null, { timeout: 60000 });
await ctx.close();
({ ctx, page } = await abrir({ agora: "2026-10-06T09:00:00" }));
await pronto(page);
n = await numeros(page);
conferir(n.usadas === 9 && n.devolucoes === 1 && n.importacoes === 2, `dia 2 com devolução gravada: ${JSON.stringify(n)}`);
await page.evaluate(() => irPara("painel"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${saida}/fb-2-painel-dia2.png`, fullPage: true });
await ctx.close();

// Novas: saída persistida, classificação entre dispositivos e reversão da importação.
({ ctx, page } = await abrir({ agora: "2026-10-13T10:00:00" }));
await pronto(page);
conferir(await page.evaluate(() => firebase.app().options.projectId === 'demo-controle-pecas'), 'movimentações usam somente o projeto de demonstração');
const segundo = await abrir({ agora: "2026-10-13T10:00:00" });
await pronto(segundo.page);
const loteNovas = await page.evaluate(async () => {
  const itens = E.novas.filter(n => n.regiao === 'PR').map(n => ({ tecChave: E.cadastro[n.tid].chave, tecNome: E.cadastro[n.tid].nome, mat: n.mat, desc: E.catalogo[n.mat], tipoEnvio: n.tipoEnvio, qtd: n.qtd === 9 ? 6 : n.qtd }));
  return (await importarLote([{ tipo: 'novas', regiao: 'PR', nome: 'PR Novas.csv', itens, linhasLidas: itens.length, avisos: [], hash: 'novas-13' }])).lote;
});
await segundo.page.waitForFunction(() => E.movimentos.length === 1);
conferir(await segundo.page.evaluate(() => E.movimentos[0].qtd === 3 && E.movimentos[0].destino === 'pendente'), 'baixa de 3 peças aparece no outro dispositivo');
await segundo.page.evaluate(() => classificarSaida(E.movimentos[0].k, 'uso', 2));
await page.waitForFunction(() => E.movimentos.length === 2 && E.movimentos.some(m => m.destino === 'uso' && m.qtd === 2));
await page.reload(); await pronto(page);
conferir(await page.evaluate(() => calcularDesempenho({ tipo: 'novas' }).uso[0]?.uso === 2 && E.movimentos.some(m => m.destino === 'pendente' && m.qtd === 1)), 'classificação parcial persiste e conserva o saldo após reabrir');
await page.evaluate(async (lote) => desfazerImportacao(E.importacoes.find(i => i.id === lote)), loteNovas);
await segundo.page.waitForFunction(() => E.movimentos.length === 0);
conferir(true, 'desfazer remove a movimentação nos dois dispositivos');
// Prazos próprios acompanham o cadastro entre dispositivos e podem voltar à regra geral.
const tidPrazos = await page.evaluate(async () => {
  const tid = derivar().tecnicos.find(t => t.nome.startsWith('Ana')).tid;
  await salvarTecnico(tid, { prazoUsadas: 21, prazoNovas: 14 });
  return tid;
});
await segundo.page.waitForFunction(tid => prazoDoTecnico(tid) === 21 && prazoDoTecnico(tid, 'novas') === 14, tidPrazos);
conferir(await segundo.page.evaluate(tid => derivar().mapa.get(tid).nAtrasadas === 0, tidPrazos), 'prazos personalizados recalculam pendências no outro dispositivo');
await page.reload(); await pronto(page);
conferir(await page.evaluate(tid => E.cadastro[tid].prazoUsadas === 21 && E.cadastro[tid].prazoNovas === 14, tidPrazos), 'prazos personalizados persistem após reabrir');
await segundo.page.evaluate(tid => salvarTecnico(tid, { prazoUsadas: null, prazoNovas: null }), tidPrazos);
await page.waitForFunction(tid => E.cadastro[tid].prazoUsadas === null && E.cadastro[tid].prazoNovas === null, tidPrazos);
conferir(await page.evaluate(tid => prazoDoTecnico(tid) === prazoGeral() && prazoDoTecnico(tid, 'novas') === prazoGeral('novas'), tidPrazos), 'retorno à regra geral sincroniza os dois tipos');
await segundo.ctx.close(); await ctx.close();

// 4) conta sem permissão
({ ctx, page } = await abrir({ email: "intruso@exemplo.com" }));
await pronto(page);
const negado = await page.evaluate(() => ({ status: E.status, codigo: E.erroCodigo }));
conferir(negado.status === "erro" && negado.codigo === "sem_permissao", `conta não autorizada é barrada: ${JSON.stringify(negado)}`);
await page.screenshot({ path: `${saida}/fb-3-sem-permissao.png` });
await ctx.close();

// 5) tela de entrada (sem login automático)
({ ctx, page } = await abrir({ login: false }));
await page.waitForSelector("#acesso:not([hidden]) #entrar-google", { timeout: 30000 });
conferir(true, "tela de entrada com Google aparece");
await page.screenshot({ path: `${saida}/fb-4-entrada.png` });
await ctx.close();

await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S):\n- ${falhas.join("\n- ")}` : "\nTUDO CERTO");
process.exit(falhas.length ? 1 : 0);
