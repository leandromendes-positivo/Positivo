/* Exportações locais: dados completos ou resumo executivo de tamanho previsível. */
const bibliotecasRelatorio = new Map();
function carregarBibliotecaRelatorio(arquivo, verificar) {
  if (verificar()) return Promise.resolve();
  if (!bibliotecasRelatorio.has(arquivo)) {
    const p = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const falhar = () => { clearTimeout(timer); script.remove(); bibliotecasRelatorio.delete(arquivo); reject(new Error('Não foi possível carregar o gerador. Verifique sua conexão e tente novamente.')); };
      const timer = setTimeout(falhar, 30000);
      script.src = new URL(`./vendor/${arquivo}`, document.baseURI).href;
      script.onload = () => { if (!verificar()) return falhar(); clearTimeout(timer); resolve(); };
      script.onerror = falhar;
      document.head.appendChild(script);
    });
    bibliotecasRelatorio.set(arquivo, p);
  }
  return bibliotecasRelatorio.get(arquivo);
}
async function bibliotecasExcelRelatorio() {
  await carregarBibliotecaRelatorio('exceljs-4.4.0.min.js', () => window.ExcelJS);
}
async function bibliotecasPdfRelatorio() {
  await carregarBibliotecaRelatorio('jspdf-4.2.1.min.js', () => window.jspdf?.jsPDF);
}
async function baixarArquivoRelatorio(blob, nome) {
  let downloads;
  try { downloads = window.claude?.use ? await window.claude.use('downloads') : null; } catch (_) { /* Navegador comum. */ }
  if (downloads) { await downloads.save({ filename: nome, data: blob }); return; }
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30000);
}
async function exportarRelatorio(formato) {
  if (!['simples', 'indicadores', 'pdf'].includes(formato) || UIrelatorios.exportando) return;
  if (!relatorioPronto()) throw new Error('Aguarde a consulta completa do histórico antes de exportar.');
  if (Acesso.modo === 'firebase' && (!Acesso.usuario?.uid || !Acesso.perfil?.ativo)) throw new Error('Entre com sua conta autorizada para exportar.');
  // Cópia independente: mudanças de filtro ou do banco durante a geração não misturam os dados.
  const r = structuredClone(calcularRelatorio()), sessao = `${Acesso.modo}|${Acesso.usuario?.uid || ''}`;
  UIrelatorios.exportando = formato; renderizar(true);
  try {
    const blob = formato === 'pdf' ? await gerarPdfRelatorio(r) : await gerarExcelRelatorio(r, formato);
    if (sessao !== `${Acesso.modo}|${Acesso.usuario?.uid || ''}` || E.status !== 'pronto' || (Acesso.modo === 'firebase' && !Acesso.perfil?.ativo)) throw new Error('A sessão mudou. Entre novamente antes de exportar.');
    await baixarArquivoRelatorio(blob, `positivo-${formato === 'pdf' ? 'resumo' : formato === 'simples' ? 'dados-simples' : 'com-indicadores'}-${r.inicio}-a-${r.fim}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`);
    toast(formato === 'simples' ? 'Excel simples pronto, com todos os dados do recorte.' : formato === 'pdf' ? 'PDF pronto: resumo em 2 páginas.' : 'Excel pronto: indicadores e prioridades em 2 abas.');
  } finally { UIrelatorios.exportando = ''; if (UI.pagina === 'relatorios' && E.status === 'pronto') renderizar(true); }
}
function abasRelatorio(r) {
  const c = (titulo, largura = 20, tipo = 'texto') => ({ titulo, largura, tipo });
  const n = (titulo, largura = 16) => c(titulo, largura, 'numero'), d = titulo => c(titulo, 18, 'data');
  return [
    { nome: 'Inventário atual', colunas: [c('Técnico', 34), c('UF', 8), c('Localidade', 18), c('Tipo', 12), c('Código', 22), c('Descrição', 50), n('Quantidade'), c('Situação', 26), n('Idade em dias'), n('Prazo em dias'), n('Dias de atraso'), d('Primeira observação'), d('Data FT'), d('Previsão'), c('Agendado por', 22), c('Chamado', 22), c('Nota fiscal', 22), c('Tipo de envio', 22), c('Conta para limite', 18)],
      linhas: r.estoque.map(i => [i.nome, i.regiao, i.localidade, i.tipo === 'usadas' ? 'Usada' : 'Nova', String(i.mat), i.desc, i.qtd, i.situacao, i.dias, i.prazo, i.atraso, i.desde, i.dataFT, i.previsao, i.previsao ? autorPrevisao(i) : '', String(i.chamado || ''), String(i.nf || ''), i.tipoEnvio || '', i.tipo === 'novas' ? i.conta ? 'Sim' : 'Não' : 'Não se aplica']) },
    { nome: 'Movimentações', colunas: [d('Saída observada'), c('Técnico', 34), c('UF', 8), c('Localidade', 18), c('Tipo', 12), c('Código', 22), c('Descrição', 50), n('Quantidade'), c('Destino', 27), n('Idade na saída'), n('Prazo na saída'), c('Pontualidade', 20), d('Primeira observação'), d('Data FT'), c('Chamado', 22), c('Nota fiscal', 22)],
      linhas: r.saidas.map(i => [i.em, i.nome, i.regiao, i.localidade, i.tipo === 'usadas' ? 'Usada' : 'Nova', String(i.mat), i.desc, i.qtd, DESTINOS_NOVAS[i.destino] || 'A classificar', i.dias, i.prazo, i.destino !== 'devolucao' ? 'Não se aplica' : i.pontual === null ? 'Sem data suficiente' : i.pontual ? 'No prazo' : 'Com atraso', i.desde, i.dataFT, String(i.chamado || ''), String(i.nf || '')]) },

  ];
}

// Excel exige ARGB de oito dígitos; RGB de seis dígitos provoca reparos no Office.
const corExcel = cor => 'FF' + cor.replace('#', '').slice(-6).toUpperCase();
const XL_COR = { tinta: '#17202A', suave: '#596675', linha: '#E4E9ED', fundo: '#F3F6F8', branco: '#FFFFFF', verde: '#138573' };
const MIME_EXCEL_RELATORIO = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function prioridadesRelatorio(r) {
  return r.tecnicos.filter(t => t.atrasadas > 0 || t.excesso > 0).sort((a, b) => b.atrasadas - a.atrasadas || (b.excesso || 0) - (a.excesso || 0) || comparar(a.nome, b.nome));
}
function frescorTextoRelatorio(r) {
  if (!r.frescor.length) return 'Sem planilhas neste recorte. Os saldos não confirmam ausência de estoque.';
  const pendentes = r.frescor.filter(i => !i.em || i.dias > 0).length;
  return pendentes ? `${pendentes} de ${r.frescor.length} planilhas não foram atualizadas hoje. Confira a última importação antes de cobrar.` : `As ${r.frescor.length} planilhas deste recorte foram atualizadas hoje.`;
}
function fonteExcel(tamanho = 11, cor = XL_COR.tinta, bold = false) { return { name: 'Calibri', size: tamanho, color: { argb: corExcel(cor) }, bold }; }
function fundoExcel(cor) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: corExcel(cor) } }; }
function faixaExcel(ws, linha, col, fim, valor, { tamanho = 11, cor = XL_COR.tinta, fundo, bold = false, altura = 22 } = {}) {
  ws.mergeCells(linha, col, linha, fim);
  const cel = ws.getCell(linha, col); cel.value = valor; cel.font = fonteExcel(tamanho, cor, bold);
  cel.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
  if (fundo) cel.fill = fundoExcel(fundo);
  ws.getRow(linha).height = altura;
  return cel;
}
function configurarResumoExcel(ws, r, titulo) {
  ws.columns = Array.from({ length: 12 }, () => ({ width: 11 })); ws.properties.defaultRowHeight = 20;
  ws.views = [{ showGridLines: false, zoomScale: 85 }];
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: .25, right: .25, top: .25, bottom: .35, header: .1, footer: .15 } };
  ws.headerFooter.oddFooter = '&LPositivo Tecnologia · Relatório gerencial&R&P / &N';
  faixaExcel(ws, 1, 1, 12, `POSITIVO TECNOLOGIA  |  ${titulo}`, { tamanho: 19, bold: true, cor: XL_COR.branco, fundo: XL_COR.tinta, altura: 36 });
  faixaExcel(ws, 2, 1, 12, `Movimentações: ${fmtData(r.inicio)} a ${fmtData(r.fim)}   ·   Estoque avaliado em ${fmtData(r.hoje)}`, { cor: XL_COR.suave, altura: 24 });
  faixaExcel(ws, 3, 1, 12, r.filtrosTexto, { cor: XL_COR.suave, altura: 30 });
}
function valorCelulaRelatorio(v, tipo) {
  if (v === '' || v == null) return null;
  if (tipo === 'data') return /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + 'T00:00:00Z') : String(v);
  // Códigos e conteúdos iniciados por = continuam textos, nunca fórmulas.
  return tipo === 'texto' ? String(v) : v;
}
async function gerarExcelRelatorio(r, formato = 'indicadores') {
  await bibliotecasExcelRelatorio();
  const livro = new ExcelJS.Workbook(); livro.creator = 'Positivo Tecnologia'; livro.created = new Date();
  if (formato === 'simples') {
    for (const [n, aba] of abasRelatorio(r).entries()) {
      if (aba.linhas.length > 1048575) throw new Error('O recorte ultrapassa o limite do Excel. Selecione um técnico ou um período menor.');
      const ws = livro.addWorksheet(aba.nome);
      ws.columns = aba.colunas.map(c => ({ width: c.largura }));
      ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];
      const rows = aba.linhas.map(l => l.map((v, i) => valorCelulaRelatorio(v, aba.colunas[i].tipo)));
      if (rows.length) ws.addTable({ name: `Dados${n + 1}`, ref: 'A1', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: aba.colunas.map(c => ({ name: c.titulo, filterButton: true })), rows });
      else { ws.addRow(aba.colunas.map(c => c.titulo)); ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } }; }
      aba.colunas.forEach((c, i) => { ws.getColumn(i + 1).numFmt = c.tipo === 'data' ? 'dd/mm/yyyy' : c.tipo === 'numero' ? '#,##0' : '@'; });
      ws.getRow(1).height = 30; ws.getRow(1).eachCell(c => { c.font = fonteExcel(11, XL_COR.branco, true); c.fill = fundoExcel(XL_COR.tinta); c.alignment = { wrapText: true, vertical: 'middle' }; });
      ws.properties.defaultRowHeight = 20;
    }
    const info = livro.addWorksheet('Leia-me'); info.columns = [{ width: 25 }, { width: 105 }];
    const linhas = [['Exportação simples', 'Dados completos dos filtros aplicados. Cada aba começa no cabeçalho para facilitar filtros e tabelas dinâmicas.'], ['Período das saídas', `${fmtData(r.inicio)} a ${fmtData(r.fim)}`], ['Estoque avaliado em', fmtData(r.hoje)], ['Filtros', r.filtrosTexto], ['Emitido em (Brasília)', fmtDataHora(r.emitido)], ['Atualização', frescorTextoRelatorio(r)], ...r.notas.map((nota, n) => [`Critério ${n + 1}`, nota]), ...r.frescor.map(i => [`${i.regiao} / ${i.tipo}`, i.em ? `${fmtDataHora(i.em)} · ${i.arquivo || ''}` : 'Sem importação'])];
    linhas.forEach(linha => { const row = info.addRow(linha); row.height = Math.max(30, Math.ceil(String(linha[1]).length / 95) * 16); row.eachCell(c => { c.font = fonteExcel(); c.alignment = { wrapText: true, vertical: 'middle' }; }); });
  } else {
    const graficos = graficosRelatorio(r), imagens = await Promise.all(graficos.map(pngGraficoRelatorio));
    const inserirGrafico = (ws, indice, col, linha) => {
      const g = graficos[indice];
      faixaExcel(ws, linha, col + 1, col + 6, g.titulo, { tamanho: 13, bold: true });
      faixaExcel(ws, linha + 1, col + 1, col + 6, g.sub, { tamanho: 10, cor: XL_COR.suave });
      const id = livro.addImage({ base64: imagens[indice], extension: 'png' });
      // Duas âncoras permitem editAs no padrão OOXML; oneCellAnchor não admite esse atributo.
      ws.addImage(id, { tl: { col, row: linha + 1 }, br: { col: col + 6, row: linha + 10 }, editAs: 'oneCell' });
    };
    const resumo = livro.addWorksheet('Visão geral'); configurarResumoExcel(resumo, r, 'VISÃO GERAL');
    indicadoresRelatorio(r).forEach((i, n) => {
      const linha = n < 3 ? 5 : 9, col = n % 3 * 4 + 1;
      faixaExcel(resumo, linha, col, col + 3, `${i.titulo} · ${i.escopo}`, { tamanho: 10, fundo: XL_COR.fundo, altura: 26 });
      const v = faixaExcel(resumo, linha + 1, col, col + 3, i.valor === null ? '—' : i.valor, { tamanho: 28, bold: true, cor: CORES_RELATORIO[i.cor], fundo: XL_COR.fundo, altura: 36 });
      v.numFmt = i.percentual ? '0.0%' : '#,##0';
      faixaExcel(resumo, linha + 2, col, col + 3, i.detalhe, { tamanho: 10, cor: XL_COR.suave, fundo: XL_COR.fundo, altura: 24 });
    });
    inserirGrafico(resumo, 0, 0, 14); inserirGrafico(resumo, 2, 6, 14);
    faixaExcel(resumo, 25, 1, 12, `${fmtNum(r.k.classificar)} novas com saída a classificar · ${fmtNum(r.k.transferidas)} transferidas / ajustadas. Não entram em devoluções nem em uso confirmado.`, { tamanho: 10, cor: XL_COR.suave, altura: 30 });
    faixaExcel(resumo, 26, 1, 12, frescorTextoRelatorio(r), { tamanho: 10, cor: XL_COR.suave, altura: 28 });
    faixaExcel(resumo, 27, 1, 12, `Emitido em ${fmtDataHora(r.emitido)} (Brasília). Os totais consideram todo o recorte. Detalhes linha a linha: Exportação simples.`, { tamanho: 10, cor: XL_COR.suave, altura: 28 });
    resumo.pageSetup.printArea = 'A1:L27';
    const prioridades = livro.addWorksheet('Prioridades'); configurarResumoExcel(prioridades, r, 'PRIORIDADES');
    inserirGrafico(prioridades, 1, 0, 5); inserirGrafico(prioridades, 3, 6, 5);
    faixaExcel(prioridades, 16, 1, 12, graficos[3].nota, { tamanho: 10, cor: XL_COR.suave, altura: 24 });
    const fila = prioridadesRelatorio(r);
    faixaExcel(prioridades, 18, 1, 12, `Acompanhar primeiro · ${Math.min(8, fila.length)} de ${fila.length} técnicos com atraso ou excesso de novas`, { tamanho: 13, bold: true, altura: 25 });
    const colunas = [[1, 6, 'Técnico / UF'], [7, 8, 'Em atraso'], [9, 10, 'Devolvidas no período'], [11, 12, 'Excesso de novas']];
    colunas.forEach(([col, fim, titulo]) => faixaExcel(prioridades, 19, col, fim, titulo, { tamanho: 10, cor: XL_COR.branco, fundo: XL_COR.tinta, bold: true, altura: 28 }));
    fila.slice(0, 8).forEach((t, n) => {
      const valores = [`${t.nome} · ${t.regiao}`, t.atrasadas, t.devolvidas, t.excesso === null ? '—' : t.excesso];
      colunas.forEach(([col, fim], j) => { const c = faixaExcel(prioridades, 20 + n, col, fim, valores[j], { tamanho: 11, fundo: n % 2 ? XL_COR.branco : XL_COR.fundo, altura: 29 }); if (j) c.numFmt = '#,##0'; });
    });
    if (!fila.length) faixaExcel(prioridades, 20, 1, 12, 'Nenhum atraso ou excesso identificado neste recorte.', { cor: XL_COR.verde });
    faixaExcel(prioridades, 29, 1, 12, 'Prioridade por quantidade em atraso; excesso de novas desempata. Menos peças que o limite é adequado. Códigos identificam as peças.', { tamanho: 10, cor: XL_COR.suave, altura: 28 });
    faixaExcel(prioridades, 30, 1, 12, 'Gráficos inseridos como imagens para preservar o visual. Para criar gráficos ou tabelas dinâmicas, use os dados da Exportação simples.', { tamanho: 10, cor: XL_COR.suave, altura: 28 });
    prioridades.pageSetup.printArea = 'A1:L30';
  }
  // Somente o gerador da biblioteca escreve o pacote. Sem edição manual do XML.
  return new Blob([await livro.xlsx.writeBuffer()], { type: MIME_EXCEL_RELATORIO });
}
async function pngGraficoRelatorio(g) {
  const url = URL.createObjectURL(new Blob([svgGraficoRelatorio(g, true)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1680; canvas.height = 840;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
async function gerarPdfRelatorio(r) {
  await bibliotecasPdfRelatorio();
  const graficos = graficosRelatorio(r), imagens = await Promise.all(graficos.map(pngGraficoRelatorio));
  const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Positivo | Resumo executivo', subject: `${r.inicio} a ${r.fim}`, creator: 'Controle de peças Positivo' });
  const texto = (valor, x, y, tamanho = 9, cor = XL_COR.tinta, bold = false, largura = 269, align = 'left') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(tamanho); doc.setTextColor(cor);
    // Altura fixa: nomes extensos não criam páginas extras nem invadem outra coluna.
    let t = String(valor); if (doc.getTextWidth(t) > largura) { while (t.length && doc.getTextWidth(t + '…') > largura) t = t.slice(0, -1); t += '…'; }
    doc.text(t, x, y, { align });
  };
  function cabecalho(titulo, numero) {
    doc.setFillColor(XL_COR.tinta); doc.rect(0, 0, 297, 3, 'F');
    texto('POSITIVO TECNOLOGIA', 14, 13, 10, XL_COR.tinta, true);
    texto('RELATÓRIO GERENCIAL', 283, 13, 8, XL_COR.suave, false, 80, 'right');
    texto(titulo, 14, 25, 21, XL_COR.tinta, true);
    texto(`${fmtData(r.inicio)} a ${fmtData(r.fim)} · movimentações   |   Estoque avaliado em ${fmtData(r.hoje)}`, 14, 33, 9, XL_COR.suave);
    texto(r.filtrosTexto, 14, 39, 8, XL_COR.suave);
    doc.setDrawColor(XL_COR.linha); doc.line(14, 198, 283, 198);
    texto(`Emitido em ${fmtDataHora(r.emitido)} (Brasília) · Totais do recorte completo`, 14, 204, 7.5, XL_COR.suave);
    texto(`${numero} / 2`, 283, 204, 8, XL_COR.suave, false, 30, 'right');
  }
  function grafico(indice, x, y) {
    const g = graficos[indice];
    texto(g.titulo, x, y, 12, XL_COR.tinta, true, 130); texto(g.sub, x, y + 5, 7, XL_COR.suave, false, 130);
    doc.addImage(imagens[indice], 'PNG', x, y + 7, 130, 65);
  }
  cabecalho('Visão geral', 1);
  indicadoresRelatorio(r).forEach((i, n) => {
    const x = 14 + n % 3 * 91, y = 46 + Math.floor(n / 3) * 30;
    doc.setFillColor(XL_COR.fundo); doc.roundedRect(x, y, 87, 27, 2, 2, 'F');
    doc.setFillColor(CORES_RELATORIO[i.cor]); doc.rect(x, y + 4, .8, 19, 'F');
    texto(i.titulo, x + 4, y + 6, 9, XL_COR.tinta, true, 78);
    texto(valorIndicadorRelatorio(i), x + 4, y + 18, 23, CORES_RELATORIO[i.cor], true, 58);
    texto(i.escopo, x + 82, y + 16, 7, XL_COR.suave, false, 24, 'right');
    texto(i.detalhe, x + 4, y + 23, 7, XL_COR.suave, false, 78);
  });
  grafico(0, 14, 113); grafico(2, 151, 113);
  texto(`${fmtNum(r.k.classificar)} novas a classificar · ${fmtNum(r.k.transferidas)} transferidas / ajustadas. Não contam como devolução ou uso.`, 14, 188, 8, XL_COR.suave);
  texto(frescorTextoRelatorio(r), 14, 194, 8, XL_COR.suave);
  doc.addPage(); cabecalho('Prioridades da operação', 2);
  grafico(1, 14, 48); grafico(3, 151, 48);
  texto(graficos[3].nota, 151, 123, 7, XL_COR.suave, false, 130);
  const fila = prioridadesRelatorio(r);
  texto(`Acompanhar primeiro · ${Math.min(8, fila.length)} de ${fila.length} técnicos com atraso ou excesso`, 14, 132, 11, XL_COR.tinta, true);
  const xs = [14, 154, 189, 241], larguras = [140, 35, 52, 42];
  doc.setFillColor(XL_COR.tinta); doc.rect(14, 137, 269, 8, 'F');
  ['Técnico / UF', 'Em atraso', 'Devolvidas no período', 'Excesso de novas'].forEach((t, n) => texto(t, xs[n] + 3, 142, 8, XL_COR.branco, true, larguras[n] - 6));
  fila.slice(0, 8).forEach((t, n) => {
    const y = 145 + n * 5.2; doc.setFillColor(n % 2 ? XL_COR.branco : XL_COR.fundo); doc.rect(14, y, 269, 5.2, 'F');
    [`${t.nome} · ${t.regiao}`, fmtNum(t.atrasadas), fmtNum(t.devolvidas), t.excesso === null ? '—' : fmtNum(t.excesso)].forEach((v, j) => texto(v, xs[j] + 3, y + 3.7, 8, j === 1 && t.atrasadas ? CORES_RELATORIO[1] : XL_COR.tinta, false, larguras[j] - 6));
  });
  if (!fila.length) texto('Nenhum atraso ou excesso identificado neste recorte.', 17, 151, 9, XL_COR.verde);
  texto('Prazos individuais respeitados. Nas novas, a idade conta da primeira observação. Limite de estoque é um teto.', 14, 191, 7.5, XL_COR.suave);
  texto('Gráficos e prioridades exibem os maiores saldos. Para consultar todas as peças e movimentações, use Exportação simples.', 14, 195, 7.5, XL_COR.suave);
  return doc.output('blob');
}
