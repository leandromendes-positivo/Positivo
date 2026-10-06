"use strict";
/* ==========================================================================
   Utilitários: texto, datas, números, hash e ícones.
   ========================================================================== */

// ----------------------------------------------------------------- texto
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const semAcentos = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpar = (s) => String(s == null ? "" : s).replace(/﻿/g, "").replace(/\s+/g, " ").trim();
const chaveTexto = (s) => limpar(semAcentos(limpar(s))).toUpperCase();
const normBusca = (s) => semAcentos(String(s == null ? "" : s)).toLowerCase();

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "van", "von"]);

/** 'MARIA EXEMPLO DA SILVA ' -> 'Maria Exemplo da Silva' */
function nomeBonito(s) {
  const t = limpar(s);
  if (!t || !/[A-Za-zÀ-ÿ]/.test(t) || t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(" ").map((p, i) =>
    i > 0 && PARTICULAS.has(p) ? p : p.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join("-")
  ).join(" ");
}
const primeiroNome = (s) => (nomeBonito(s).split(" ")[0] || "");
function iniciais(s) {
  const partes = nomeBonito(s).split(" ").filter((p) => p && !PARTICULAS.has(p));
  if (!partes.length) return "?";
  if (/^\d+$/.test(partes[0])) return partes[0].slice(-2);
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}
/** '000000000011192470' -> '11192470' (código SAP sem zeros à esquerda) */
function codigoMaterial(c) {
  c = limpar(c);
  return /^\d+$/.test(c) ? (c.replace(/^0+/, "") || "0") : c;
}
function parseQtd(s, padrao = 1) {
  let t = limpar(s);
  if (!t) return padrao;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : padrao;
}
const palavra = (n, um, varios) => (n === 1 ? um : varios);
const plural = (n, um, varios) => `${fmtNum(n)} ${palavra(n, um, varios)}`;

const UFS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

/** Sigla do estado no nome do arquivo: 'PR Usadas.csv' -> 'PR' */
function regiaoDoNome(nome) {
  const base = semAcentos(String(nome || "").replace(/\.[^.]+$/, ""));
  const tokens = base.split(/[^A-Za-z]+/).filter(Boolean);
  for (const t of tokens) if (UFS[t]) return t;                 // sigla em maiúsculas
  for (const t of [tokens[0], tokens[tokens.length - 1]])        // minúsculas só no começo/fim
    if (t && UFS[t.toUpperCase()]) return t.toUpperCase();
  return null;
}
function tipoDoNome(nome) {
  const b = normBusca(nome);
  if (/usad|defeit|retorno|devol/.test(b)) return "usadas";
  if (/nova|novo|estoque|backup|saldo/.test(b)) return "novas";
  return null;
}

// ----------------------------------------------------------------- datas
// Datas guardadas como texto local: dia 'AAAA-MM-DD', data/hora 'AAAA-MM-DD HH:MM'.
const pad2 = (n) => String(n).padStart(2, "0");
function agora() {
  const fixo = typeof window !== "undefined" && window.__CP_AGORA;
  return fixo ? new Date(fixo) : new Date();
}
/** Horário de autoria vem do servidor e é exibido no fuso da operação. */
function dataHoraBrasilia(data) {
  const partes = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(data);
  const p = Object.fromEntries(partes.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}.${String(data.getMilliseconds()).padStart(3,'0')}`;
}
const isoDia = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isoDataHora = (d) => `${isoDia(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const hojeISO = () => isoDia(agora());
const agoraISO = () => isoDataHora(agora());
function carimbo(d = agora()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
/** 'AAAA-MM-DD...' -> nº de dias desde 1970 (meia-noite local, sem fuso) */
function numDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN;
}
const diffDias = (de, ate) => numDia(ate) - numDia(de);
function somaDias(iso, n) {
  const d = new Date(numDia(iso) * 86400000 + n * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
/** Converte '05/10/2026 08:54:00', ISO ou nº serial do Excel em 'AAAA-MM-DD HH:MM'. */
function parseDataTexto(s) {
  if (s instanceof Date && !isNaN(s)) return isoDataHora(s);
  const t = limpar(s);
  if (!t) return null;
  let m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  if (m) {
    let ano = +m[3];
    if (ano < 100) ano += 2000;
    const mes = +m[2], dia = +m[1];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${ano}-${pad2(mes)}-${pad2(dia)} ${pad2(+(m[4] || 0))}:${pad2(+(m[5] || 0))}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${pad2(+(m[4] || 0))}:${pad2(+(m[5] || 0))}`;
  if (/^\d{5}(\.\d+)?$/.test(t)) {             // serial do Excel
    const serial = Number(t);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400000);
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
    }
  }
  return null;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
function fmtData(iso, curto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "—";
  return curto ? `${m[3]}/${m[2]}` : `${m[3]}/${m[2]}/${m[1]}`;
}
function fmtDataHora(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : fmtData(iso);
}
function fmtDataExtensa(iso) {
  const n = numDia(iso);
  if (isNaN(n)) return "";
  const d = new Date(n * 86400000);
  return `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
/** 'hoje às 08:12', 'ontem às 17:40', 'há 3 dias' */
function fmtQuando(iso) {
  if (!iso) return "nunca";
  const dias = diffDias(iso.slice(0, 10), hojeISO());
  const hora = /[ T](\d{2}:\d{2})/.exec(iso);
  if (dias <= 0) return hora ? `hoje às ${hora[1]}` : "hoje";
  if (dias === 1) return hora ? `ontem às ${hora[1]}` : "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return `em ${fmtData(iso)}`;
}
/** Para previsões futuras/passadas: 'hoje', 'amanhã', 'sex, 09/10' */
function fmtPrevisao(iso) {
  const d = diffDias(hojeISO(), iso);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  const n = numDia(iso);
  const dia = new Date(n * 86400000).getUTCDay();
  return `${SEMANA[dia].slice(0, 3)}, ${fmtData(iso, true)}`;
}
function saudacao() {
  const h = agora().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// --------------------------------------------------------------- números
const NF = new Intl.NumberFormat("pt-BR");
const NF1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const fmtNum = (n) => (n == null || isNaN(n) ? "—" : NF.format(n));
const fmtNum1 = (n) => (n == null || isNaN(n) ? "—" : NF1.format(n));
const fmtPct = (n) => (n == null || isNaN(n) ? "—" : `${NF1.format(n * 100)}%`);
function fmtCompacto(n) {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return `${NF1.format(n / 1e6)} mi`;
  if (Math.abs(n) >= 1e4) return `${NF1.format(n / 1e3)} mil`;
  return NF.format(n);
}

// ------------------------------------------------------------------ hash
/** cyrb53: hash de 53 bits, estável entre navegadores. */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hash36 = (s) => cyrb53(String(s)).toString(36);

/** Id seguro para o banco: letras, números e _ - . (até 120 caracteres). */
function idSeguro(chave) {
  const base = semAcentos(chave).toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_\-.]/g, "").replace(/^\.+/, "");
  if (base && base.length <= 120) return base;
  return "T" + hash36(chave);
}

// ------------------------------------------------------------------ misc
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function agrupar(lista, chave) {
  const m = new Map();
  for (const x of lista) {
    const k = chave(x);
    let g = m.get(k);
    if (!g) m.set(k, (g = []));
    g.push(x);
  }
  return m;
}
const somar = (lista, f) => lista.reduce((s, x) => s + (f ? f(x) : x), 0);
function comparar(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}
function soDigitos(s) { return String(s || "").replace(/\D/g, ""); }
/** Telefone para o link do WhatsApp (55 + DDD + número). */
function telefoneWhats(tel) {
  let d = soDigitos(tel);
  if (!d) return "";
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}
function fmtTelefone(tel) {
  let d = soDigitos(tel);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || "";
}

// ----------------------------------------------------------------- ícones
// Traços 24x24 no estilo "linha", desenhados para este painel.
const ICONES = {
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sino: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  retorno: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  caixa: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  ajustes: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  mensagem: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4-1L3 20l1.2-4.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  telefone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  desfazer: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  seta: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  direita: '<path d="m9 18 6-6-6-6"/>',
  esquerda: '<path d="m15 18-6-6 6-6"/>',
  cima: '<path d="m18 15-6-6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  arquivo: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
  lapis: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  filtro: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  quebra: '<path d="M9 2v4"/><path d="M15 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 13 6 6"/><path d="m15 13-6 6"/>',
  sobe: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  desce: '<path d="m7 7 10 10"/><path d="M17 8v9H8"/>',
  tabela: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M8 17V11"/><path d="M13 17V7"/><path d="M18 17v-4"/>',
  base: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mais: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  lixo: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  nuvem: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A7 7 0 1 0 6 18.3"/><path d="M17.5 19H8"/>',
  externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
function icone(nome, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ""}</svg>`;
}
