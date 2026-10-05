// Aviso diário do Controle de Peças: lê resumo/atual no Firestore e manda por e-mail
// quem cobrar hoje. Roda no GitHub Actions (.github/workflows/aviso-diario.yml).
//
// Variáveis de ambiente:
//   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase (segredo do repositório)
//   GMAIL_USUARIO             Gmail que envia (ex.: painel@gmail.com)
//   GMAIL_SENHA_APP           senha de app desse Gmail (não é a senha normal)
//   EMAIL_PARA                quem recebe (opcional; vários separados por vírgula; padrão: o próprio Gmail)
//   PAINEL_URL                link do painel, vai no fim da mensagem
//   AVISO_SIMULAR=1           só mostra a mensagem no terminal, sem enviar
//   AVISO_DATA=AAAA-MM-DD     usa outra data como "hoje" (testes)
//   FIRESTORE_EMULATOR_HOST + FIREBASE_PROJETO   para testar com o emulador

import { fileURLToPath } from "node:url";

const pad = (n) => String(n).padStart(2, "0");
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const pecas = (n) => `${n} ${n === 1 ? "peça" : "peças"}`;
const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Data de hoje em Brasília, AAAA-MM-DD. */
export function hojeBrasilia(agora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

// o painel guarda listas dentro de listas como {cp_lista: [...]}
function decodificar(v) {
  if (Array.isArray(v)) return v.map(decodificar);
  if (v && typeof v === "object") {
    const k = Object.keys(v);
    if (k.length === 1 && k[0] === "cp_lista" && Array.isArray(v.cp_lista)) return v.cp_lista.map(decodificar);
    return Object.fromEntries(k.map((x) => [x, decodificar(v[x])]));
  }
  return v;
}

/** Monta assunto, texto e HTML do aviso a partir do resumo gravado pelo painel. */
export function montarAviso(resumo, hoje, painel = "") {
  const titulo = `Peças para cobrar hoje — ${ddmm(hoje)}`;
  if (!resumo) {
    const texto = `${titulo}\n\nO painel ainda não tem dados. Importe as planilhas do dia.${painel ? `\n\n${painel}` : ""}`;
    return { assunto: titulo, texto, html: `<p>${escHtml(texto).replace(/\n/g, "<br>")}</p>` };
  }
  const dia = resumo.dias && resumo.dias[hoje];
  if (!dia) {
    const texto = `${titulo}\n\nAs planilhas não são importadas há vários dias e o controle está desatualizado. Importe as planilhas do dia no painel.${painel ? `\n\n${painel}` : ""}`;
    return { assunto: `${titulo} (desatualizado)`, texto, html: `<p>${escHtml(texto).replace(/\n/g, "<br>")}</p>` };
  }
  const prazo = resumo.prazo || 7;
  const n = dia.totalTecnicos || 0;
  const tecnicos = (q) => `${q} ${q === 1 ? "técnico" : "técnicos"}`;
  const cabecalho = n ? `${tecnicos(n)} para cobrar · ${pecas(dia.totalPecas)} com mais de ${prazo} dias` : "Nenhum técnico precisa ser cobrado hoje.";
  const itens = (dia.cobrar || []).slice(0, 10).map((c) => {
    let l = `${c.nome} (${c.regiao}) — ${pecas(c.pecas)}, mais antiga com ${c.maxDias} dias`;
    if (c.previsaoVencida > 0) l += " · previsão vencida";
    if (c.ultimaCobranca) l += ` · última cobrança ${ddmm(c.ultimaCobranca)}`;
    return l;
  });
  const resto = n - itens.length;
  const extras = [];
  if (dia.previsoes && dia.previsoes.length) {
    extras.push("Prometeram devolver hoje: " + dia.previsoes.map((x) => `${x.nome} (${pecas(x.pecas)})`).join(", "));
  }
  const est = resumo.estoque || {};
  extras.push(`Estoque de novas: ${tecnicos((est.abaixo || []).length)} abaixo da meta e ${est.acima || 0} acima.`);
  const ultima = (resumo.atualizacao || []).map((a) => a.em || "").sort().pop() || "";
  if (ultima.slice(0, 10) !== hoje) extras.push("Lembrete: importe as planilhas de hoje no painel para atualizar as devoluções.");

  const texto = [
    titulo, "", cabecalho, ...itens.map((l) => `• ${l}`),
    ...(resto > 0 ? [`e mais ${tecnicos(resto)}`] : []),
    "", ...extras, ...(painel ? ["", painel] : []),
  ].join("\n");
  const p = (t) => `<p style="margin:6px 0">${escHtml(t)}</p>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111a22;line-height:1.5">
<h2 style="margin:0 0 8px;font-size:18px">${escHtml(titulo)}</h2>
${p(cabecalho)}
${itens.length ? `<ul style="padding-left:18px;margin:4px 0 8px">${itens.map((l) => `<li>${escHtml(l)}</li>`).join("")}</ul>` : ""}
${resto > 0 ? p(`e mais ${tecnicos(resto)}`) : ""}
${extras.map(p).join("\n")}
${painel ? `<p style="margin:14px 0 0"><a href="${escHtml(painel)}">Abrir o painel</a></p>` : ""}
</div>`;
  return { assunto: n ? `${titulo} (${tecnicos(n)})` : titulo, texto, html };
}

async function principal() {
  const env = process.env;
  const simular = env.AVISO_SIMULAR === "1";
  const emulador = env.FIRESTORE_EMULATOR_HOST;
  if (!emulador && !env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("Aviso diário ainda não configurado: falta o segredo FIREBASE_SERVICE_ACCOUNT. Nada foi enviado.");
    return;
  }
  if (!simular && (!env.GMAIL_USUARIO || !env.GMAIL_SENHA_APP)) {
    console.log("Aviso diário ainda não configurado: faltam os segredos GMAIL_USUARIO e GMAIL_SENHA_APP. Nada foi enviado.");
    return;
  }
  const { default: admin } = await import("firebase-admin");
  if (emulador) admin.initializeApp({ projectId: env.FIREBASE_PROJETO || "demo-controle-pecas" });
  else admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  const snap = await admin.firestore().doc("resumo/atual").get();
  const resumo = snap.exists ? decodificar(snap.data()) : null;
  const aviso = montarAviso(resumo, env.AVISO_DATA || hojeBrasilia(), env.PAINEL_URL || "");
  if (simular) {
    console.log(`Assunto: ${aviso.assunto}\n\n${aviso.texto}`);
    return;
  }
  const { default: nodemailer } = await import("nodemailer");
  const envio = nodemailer.createTransport({ service: "gmail", auth: { user: env.GMAIL_USUARIO, pass: env.GMAIL_SENHA_APP } });
  const para = env.EMAIL_PARA || env.GMAIL_USUARIO;
  await envio.sendMail({ from: `Controle de Peças <${env.GMAIL_USUARIO}>`, to: para, subject: aviso.assunto, text: aviso.texto, html: aviso.html });
  console.log(`Aviso enviado para ${para}: ${aviso.assunto}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error("Falha no aviso diário:", e.message || e); process.exit(1); });
}
