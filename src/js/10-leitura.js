/* ==========================================================================
   Leitura dos relatórios de peças (CSV exportado pelo sistema ou .xlsx).

   Formato de referência (separado por ";", codificação Latin-1):
     Técnico;Nota Fiscal;Remessa;Material Solicitado;Material Solicitado Descrição;
     Material Enviado;Material Enviado Descrição;Chamado;TIPO|Data FT;Qtd;
   - Novas  têm a coluna TIPO (BACKUP, PP, REP. BACKUP...)
   - Usadas têm a coluna Data FT (dia em que a peça foi trocada no chamado)
   ========================================================================== */

class ErroLeitura extends Error {
  constructor(msg, extra = {}) { super(msg); this.extra = extra; }
}

// campo interno -> cabeçalhos aceitos (sem acento, minúsculos, só letras/números)
const CAMPOS = {
  tecnico: ["tecnico", "nometecnico", "tecnicoresponsavel", "nomedotecnico"],
  nf: ["notafiscal", "nf", "nfe", "numeronf", "numeronotafiscal"],
  remessa: ["remessa", "numeroremessa"],
  matSol: ["materialsolicitado", "codmaterialsolicitado"],
  descSol: ["materialsolicitadodescricao", "descricaomaterialsolicitado"],
  mat: ["materialenviado", "material", "codmaterial", "codigomaterial", "codigodomaterial"],
  desc: ["materialenviadodescricao", "descricaomaterialenviado", "descricao", "descricaomaterial", "descricaodomaterial"],
  chamado: ["chamado", "numerochamado", "numerodochamado", "os", "ordemdeservico"],
  tipoEnvio: ["tipo", "tipoenvio", "tipodeenvio", "tipoderemessa"],
  dataFT: ["dataft", "datafechamento", "datadefechamento", "datatroca", "datadatroca"],
  qtd: ["qtd", "qtde", "quantidade", "qt", "quant"],
};
const CAMPO_POR_CABECALHO = new Map();
for (const [campo, nomes] of Object.entries(CAMPOS)) for (const n of nomes) CAMPO_POR_CABECALHO.set(n, campo);
const normCabecalho = (s) => semAcentos(limpar(s)).toLowerCase().replace(/[^a-z0-9]/g, "");

// ------------------------------------------------------------------ texto
function decodificar(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder("utf-8").decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch (_) {
    return new TextDecoder("windows-1252").decode(b); // Latin-1 dos relatórios do sistema
  }
}
function separador(texto) {
  const amostra = texto.slice(0, 20000).split("\n").slice(0, 20).join("\n");
  let melhor = ";", max = 0;
  for (const s of [";", "\t", ",", "|"]) {
    const n = amostra.split(s).length - 1;
    if (n > max) { max = n; melhor = s; }
  }
  return melhor;
}
function parseCSV(texto, sep) {
  const linhas = [];
  let linha = [], campo = "", aspas = false, inicio = 0;
  const n = texto.length;
  for (let i = 0; i < n; i++) {
    const c = texto.charCodeAt(i);
    if (aspas) {
      if (c === 34) {
        if (texto.charCodeAt(i + 1) === 34) { campo += texto.slice(inicio, i + 1); i++; inicio = i + 1; continue; }
        campo += texto.slice(inicio, i); aspas = false; inicio = i + 1;
      }
      continue;
    }
    if (c === 34 && campo === "" && i === inicio) { aspas = true; inicio = i + 1; continue; }
    if (texto[i] === sep) { linha.push(campo + texto.slice(inicio, i)); campo = ""; inicio = i + 1; continue; }
    if (c === 10 || c === 13) {
      linha.push(campo + texto.slice(inicio, i)); campo = "";
      linhas.push(linha); linha = [];
      if (c === 13 && texto.charCodeAt(i + 1) === 10) i++;
      inicio = i + 1;
    }
  }
  if (inicio < n || campo !== "" || linha.length) {
    linha.push(campo + texto.slice(inicio, n));
    linhas.push(linha);
  }
  return linhas;
}

// ------------------------------------------------------------------ Excel
let promessaSheetJS = null;
function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!promessaSheetJS) {
    promessaSheetJS = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => (window.XLSX ? ok(window.XLSX) : falha(new Error("biblioteca de Excel indisponível")));
      s.onerror = () => { promessaSheetJS = null; falha(new Error("não consegui carregar a biblioteca de Excel")); };
      document.head.appendChild(s);
    });
  }
  return promessaSheetJS;
}
async function lerXLSX(buf) {
  const XLSX = await carregarSheetJS();
  const livro = XLSX.read(buf, { type: "array", cellDates: true });
  const aba = livro.Sheets[livro.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: "" });
  return linhas.map((l) => l.map((v) => {
    if (v instanceof Date) return `${pad2(v.getDate())}/${pad2(v.getMonth() + 1)}/${v.getFullYear()} ${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
    return String(v == null ? "" : v);
  }));
}

// --------------------------------------------------------------- análise
function acharCabecalho(linhas) {
  let melhor = null;
  for (let i = 0; i < Math.min(linhas.length, 20); i++) {
    const mapa = {};
    linhas[i].forEach((cel, j) => {
      const campo = CAMPO_POR_CABECALHO.get(normCabecalho(cel));
      if (campo && !(campo in mapa)) mapa[campo] = j;
    });
    const pontos = Object.keys(mapa).length;
    if ("tecnico" in mapa && pontos >= 3 && (!melhor || pontos > melhor.pontos)) melhor = { i, mapa, pontos };
  }
  if (!melhor) {
    throw new ErroLeitura("Não encontrei o cabeçalho do relatório (colunas Técnico, Material, Qtd...). Confira se é o relatório de peças exportado pelo sistema.");
  }
  return melhor;
}

/**
 * Lê um arquivo e devolve os itens normalizados.
 * opcoes.regiao / opcoes.tipo (escolhidos pelo usuário) têm prioridade sobre a detecção.
 */
async function lerRelatorio(arquivo, opcoes = {}) {
  const buf = await arquivo.arrayBuffer();
  const nome = arquivo.name || "arquivo";
  if (!buf.byteLength) throw new ErroLeitura("O arquivo está vazio.");
  const b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  let linhas, assinatura;
  if (b[0] === 0x50 && b[1] === 0x4b) {
    try { linhas = await lerXLSX(buf); } catch (e) { throw new ErroLeitura(`Não consegui abrir a planilha Excel (${e.message}).`); }
    assinatura = String(buf.byteLength) + ":" + linhas.length;
  } else if (b[0] === 0xd0 && b[1] === 0xcf) {
    try { linhas = await lerXLSX(buf); } catch (e) {
      throw new ErroLeitura("Arquivo .xls antigo não pôde ser lido. Use o CSV exportado pelo sistema ou salve como .xlsx.");
    }
    assinatura = String(buf.byteLength) + ":" + linhas.length;
  } else {
    const texto = decodificar(buf);
    linhas = parseCSV(texto, separador(texto));
    assinatura = texto;
  }
  const { i: iCab, mapa } = acharCabecalho(linhas);
  const avisos = [];

  let tipoCab = null;
  if ("dataFT" in mapa && !("tipoEnvio" in mapa)) tipoCab = "usadas";
  else if ("tipoEnvio" in mapa && !("dataFT" in mapa)) tipoCab = "novas";
  const tipoNome = tipoDoNome(nome);
  const tipo = opcoes.tipo || tipoCab || tipoNome;
  if (!opcoes.tipo && tipoCab && tipoNome && tipoCab !== tipoNome) {
    avisos.push(`O nome do arquivo diz "${tipoNome}", mas as colunas são de peças ${tipoCab}. Considerei ${tipoCab}.`);
  }
  if (tipo !== "novas" && tipo !== "usadas") {
    throw new ErroLeitura("Não identifiquei se o arquivo é de peças NOVAS ou USADAS.", { precisa: "tipo" });
  }
  const regiao = (opcoes.regiao || regiaoDoNome(nome) || "").toUpperCase();
  if (!regiao) {
    throw new ErroLeitura("Não identifiquei a região pelo nome do arquivo. Escolha a região ou renomeie como \"PR Usadas.csv\".", { precisa: "regiao", tipo });
  }
  if (!("mat" in mapa) && "matSol" in mapa) { mapa.mat = mapa.matSol; if (!("desc" in mapa) && "descSol" in mapa) mapa.desc = mapa.descSol; }
  if (!("mat" in mapa)) throw new ErroLeitura("O arquivo não tem a coluna de material (Material Enviado).");
  if (tipo === "usadas" && !("dataFT" in mapa)) avisos.push("Sem a coluna Data FT: os dias serão contados a partir da primeira importação.");

  const val = (linha, campo) => {
    const j = mapa[campo];
    return j == null || j >= linha.length ? "" : limpar(linha[j]);
  };
  const itens = [];
  let lidas = 0, ignoradas = 0, datasRuins = 0;
  for (let r = iCab + 1; r < linhas.length; r++) {
    const linha = linhas[r];
    if (!linha.some((c) => limpar(c))) continue;
    lidas++;
    const tecNome = val(linha, "tecnico");
    const mat = codigoMaterial(val(linha, "mat"));
    const qtd = parseQtd(val(linha, "qtd"), 1);
    if (!tecNome || !mat || qtd <= 0) { ignoradas++; continue; }
    const item = {
      tecNome, tecChave: chaveTexto(tecNome),
      nf: val(linha, "nf"), remessa: val(linha, "remessa"),
      matSol: codigoMaterial(val(linha, "matSol")), mat,
      desc: val(linha, "desc") || val(linha, "descSol"),
      chamado: val(linha, "chamado"), qtd,
    };
    if (tipo === "usadas") {
      const bruto = val(linha, "dataFT");
      item.dataFT = parseDataTexto(bruto);
      if (bruto && !item.dataFT) datasRuins++;
    } else {
      item.tipoEnvio = (val(linha, "tipoEnvio") || "SEM TIPO").toUpperCase();
    }
    itens.push(item);
  }
  if (datasRuins) avisos.push(`${datasRuins} linha(s) com Data FT em formato desconhecido.`);
  if (ignoradas) avisos.push(`${ignoradas} linha(s) ignorada(s) por falta de técnico, material ou quantidade.`);
  return {
    nome, regiao, tipo, itens, avisos, linhasLidas: lidas, linhasIgnoradas: ignoradas,
    hash: hash36(assinatura),
    detectado: { regiao: !opcoes.regiao, tipo: !opcoes.tipo },
  };
}
