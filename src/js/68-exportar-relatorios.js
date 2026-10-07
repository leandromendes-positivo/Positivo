/* Geração local: bibliotecas versionadas, gráficos OOXML editáveis e PDF paginado. */
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
  await Promise.all([
    carregarBibliotecaRelatorio('exceljs-4.4.0.min.js', () => window.ExcelJS),
    carregarBibliotecaRelatorio('fflate-0.8.2.min.js', () => window.fflate),
  ]);
}
async function bibliotecasPdfRelatorio() {
  await carregarBibliotecaRelatorio('jspdf-4.2.1.min.js', () => window.jspdf?.jsPDF);
  await carregarBibliotecaRelatorio('jspdf-autotable-5.0.8.min.js', () => window.jspdf?.jsPDF?.API.autoTable);
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
  if (!['excel', 'pdf'].includes(formato) || UIrelatorios.exportando) return;
  if (!relatorioPronto()) throw new Error('Aguarde a consulta completa do histórico antes de exportar.');
  if (Acesso.modo === 'firebase' && (!Acesso.usuario?.uid || !Acesso.perfil?.ativo)) throw new Error('Entre com sua conta autorizada para exportar.');
  // Cópia independente: mudanças de filtro ou do banco durante a geração não misturam os dados.
  const r = structuredClone(calcularRelatorio()), sessao = `${Acesso.modo}|${Acesso.usuario?.uid || ''}`;
  UIrelatorios.exportando = formato; renderizar(true);
  try {
    const blob = formato === 'excel' ? await gerarExcelRelatorio(r) : await gerarPdfRelatorio(r);
    if (sessao !== `${Acesso.modo}|${Acesso.usuario?.uid || ''}` || E.status !== 'pronto' || (Acesso.modo === 'firebase' && !Acesso.perfil?.ativo)) throw new Error('A sessão mudou. Entre novamente antes de exportar.');
    await baixarArquivoRelatorio(blob, `positivo-relatorio-${r.inicio}-a-${r.fim}.${formato === 'excel' ? 'xlsx' : 'pdf'}`);
    toast(`${formato === 'excel' ? 'Excel' : 'PDF'} pronto com todos os dados do recorte.`);
  } finally { UIrelatorios.exportando = ''; if (UI.pagina === 'relatorios' && E.status === 'pronto') renderizar(true); }
}
function abasRelatorio(r) {
  const c = (titulo, largura = 20, tipo = 'texto') => ({ titulo, largura, tipo });
  const n = (titulo, largura = 16) => c(titulo, largura, 'numero'), d = titulo => c(titulo, 18, 'data');
  return [
    { nome: 'Técnicos', colunas: [c('Técnico', 34), c('UF', 8), c('Localidade', 18), n('Usadas em aberto'), n('Novas em estoque'), n('Peças em atraso'), n('Devolvidas no período'), n('Devolvidas no prazo'), c('Pontualidade', 17, 'percentual'), n('Uso de novas'), n('Saídas a classificar'), n('Novas computáveis'), n('Limite de novas'), n('Excesso de novas'), c('Situação do saldo de novas', 28)],
      linhas: r.tecnicos.map(t => [t.nome, t.regiao, t.localidade, r.filtros.tipo === 'novas' ? null : t.usadas, r.filtros.tipo === 'usadas' || t.semPlanilha ? null : t.novas, t.atrasadas, t.devolvidas, t.noPrazo, t.taxa, r.filtros.tipo === 'usadas' ? null : t.uso, t.classificar, t.limite === null ? null : t.computaveis, t.limite, t.excesso, r.filtros.tipo === 'usadas' ? 'Não se aplica ao filtro' : t.semPlanilha ? 'Sem planilha' : t.limite === 0 ? 'Sem limite definido' : 'Saldo conhecido']) },
    { nome: 'Inventário atual', colunas: [c('Técnico', 34), c('UF', 8), c('Localidade', 18), c('Tipo', 12), c('Código', 22), c('Descrição', 50), n('Quantidade'), c('Situação', 26), n('Idade em dias'), n('Prazo em dias'), n('Dias de atraso'), d('Primeira observação'), d('Data FT'), d('Previsão'), c('Agendado por', 22), c('Chamado', 22), c('Nota fiscal', 22), c('Tipo de envio', 22), c('Conta para limite', 18)],
      linhas: r.estoque.map(i => [i.nome, i.regiao, i.localidade, i.tipo === 'usadas' ? 'Usada' : 'Nova', String(i.mat), i.desc, i.qtd, i.situacao, i.dias, i.prazo, i.atraso, i.desde, i.dataFT, i.previsao, i.previsao ? autorPrevisao(i) : '', String(i.chamado || ''), String(i.nf || ''), i.tipoEnvio || '', i.tipo === 'novas' ? i.conta ? 'Sim' : 'Não' : 'Não se aplica']) },
    { nome: 'Movimentações', colunas: [d('Saída observada'), c('Técnico', 34), c('UF', 8), c('Localidade', 18), c('Tipo', 12), c('Código', 22), c('Descrição', 50), n('Quantidade'), c('Destino', 27), n('Idade na saída'), n('Prazo na saída'), c('Pontualidade', 20), d('Primeira observação'), d('Data FT'), c('Chamado', 22), c('Nota fiscal', 22)],
      linhas: r.saidas.map(i => [i.em, i.nome, i.regiao, i.localidade, i.tipo === 'usadas' ? 'Usada' : 'Nova', String(i.mat), i.desc, i.qtd, DESTINOS_NOVAS[i.destino] || 'A classificar', i.dias, i.prazo, i.destino !== 'devolucao' ? 'Não se aplica' : i.pontual === null ? 'Sem data suficiente' : i.pontual ? 'No prazo' : 'Com atraso', i.desde, i.dataFT, String(i.chamado || ''), String(i.nf || '')]) },
    { nome: 'Materiais', colunas: [c('Código', 22), c('Descrição', 50), c('Família', 28), c('Tipo', 12), n('Estoque atual'), n('Devolvidas no período'), n('Uso de novas'), n('Saídas a classificar')],
      linhas: r.materiais.map(i => [String(i.mat), i.desc, i.familia, i.tipo === 'usadas' ? 'Usada' : 'Nova', i.estoque, i.devolvidas, i.tipo === 'novas' ? i.uso : null, i.classificar]) },
  ];
}
const XL_COR = { tinta: '17202A', suave: '596675', linha: 'E4E9ED', fundo: 'F3F6F8', branco: 'FFFFFF', verde: '138573' };
function configurarFolhaRelatorio(ws, r, titulo, largura) {
  ws.properties.defaultRowHeight = 21;
  ws.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .4, bottom: .4, header: .2, footer: .2 }, printTitlesRow: '1:6' };
  ws.headerFooter.oddFooter = '&LPositivo Tecnologia · Controle de peças&R&P / &N';
  for (let linha = 1; linha <= 4; linha++) ws.mergeCells(linha, 1, linha, largura);
  ws.getCell(1, 1).value = `POSITIVO TECNOLOGIA | ${titulo}`;
  ws.getCell(1, 1).font = { name: 'Calibri', size: 20, bold: true, color: { argb: XL_COR.branco } };
  ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.tinta } };
  ws.getRow(1).height = 38;
  ws.getCell(2, 1).value = `Movimentações: ${fmtData(r.inicio)} a ${fmtData(r.fim)} | Estoque avaliado em ${fmtData(r.hoje)}`;
  ws.getCell(3, 1).value = r.filtrosTexto;
  ws.getCell(4, 1).value = `Emitido em ${fmtDataHora(r.emitido)} (Brasília) · Saldo conforme a última importação disponível`;
  for (let linha = 2; linha <= 4; linha++) {
    ws.getCell(linha, 1).font = { name: 'Calibri', size: 11, color: { argb: XL_COR.suave } };
    ws.getCell(linha, 1).alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(linha).height = linha === 3 ? 32 : 25;
  }
}
async function gerarExcelRelatorio(r) {
  await bibliotecasExcelRelatorio();
  const livro = new ExcelJS.Workbook();
  livro.creator = 'Positivo Tecnologia — Controle de peças'; livro.created = new Date();
  const painel = livro.addWorksheet('Resumo', { properties: { tabColor: { argb: XL_COR.verde } } });
  painel.columns = Array.from({ length: 12 }, () => ({ width: 12 }));
  configurarFolhaRelatorio(painel, r, 'RELATÓRIO GERENCIAL', 12);
  painel.views = [{ showGridLines: false }]; painel.pageSetup.paperSize = 8; painel.pageSetup.fitToHeight = 1;
  indicadoresRelatorio(r).forEach((i, n) => {
    const linha = n < 3 ? 6 : 10, col = (n % 3) * 4 + 1;
    [0, 1, 2].forEach(offset => {
      painel.mergeCells(linha + offset, col, linha + offset, col + 3);
      const cel = painel.getCell(linha + offset, col);
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.fundo } };
      cel.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      cel.font = { name: 'Calibri', size: offset === 1 ? 26 : 10, bold: offset !== 2, color: { argb: offset === 1 ? CORES_RELATORIO[i.cor].slice(1) : XL_COR.tinta } };
    });
    painel.getRow(linha).height = 25; painel.getRow(linha + 1).height = 38; painel.getRow(linha + 2).height = 25;
    painel.getCell(linha, col).value = `${i.titulo} · ${i.escopo}`;
    painel.getCell(linha + 1, col).value = i.valor === null ? '—' : i.valor;
    painel.getCell(linha + 1, col).numFmt = i.percentual ? '0.0%' : '#,##0';
    painel.getCell(linha + 2, col).value = i.detalhe;
  });
  const preencherNota = (linha, texto) => {
    painel.mergeCells(linha, 1, linha, 12); painel.getCell(linha, 1).value = texto;
    painel.getCell(linha, 1).font = { name: 'Calibri', size: 10, color: { argb: XL_COR.suave } };
    painel.getCell(linha, 1).alignment = { wrapText: true, vertical: 'middle' }; painel.getRow(linha).height = 32;
  };
  preencherNota(51, `${fmtNum(r.k.classificar)} novas com saída a classificar | ${fmtNum(r.k.transferidas)} transferidas / ajustadas. Essas saídas não entram em devoluções ou uso confirmado.`);
  preencherNota(52, 'Os gráficos são editáveis no Excel e usam a aba Dados dos gráficos. As abas detalhadas incluem todas as linhas dos filtros aplicados.');
  preencherNota(53, r.notas[0]);
  painel.pageSetup.printArea = 'A1:L53';
  abasRelatorio(r).forEach((aba, n) => {
    if (aba.linhas.length > 1048570) throw new Error('O recorte ultrapassa o limite de linhas do Excel. Reduza o período ou selecione um técnico.');
    const ws = livro.addWorksheet(aba.nome);
    ws.columns = aba.colunas.map(c => ({ width: c.largura })); configurarFolhaRelatorio(ws, r, aba.nome.toUpperCase(), aba.colunas.length);
    const rows = aba.linhas.map(linha => linha.map((v, i) => {
      if (v === '' || v == null) return null;
      if (aba.colunas[i].tipo === 'data') return /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + 'T00:00:00Z') : String(v);
      // Valores de texto permanecem strings: não são fórmulas, mesmo iniciados por =, +, - ou @.
      return aba.colunas[i].tipo === 'texto' ? String(v) : v;
    }));
    ws.addTable({ name: `Relatorio${n + 1}`, ref: 'A6', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: aba.colunas.map(c => ({ name: c.titulo, filterButton: true })), rows });
    aba.colunas.forEach((c, i) => { ws.getColumn(i + 1).numFmt = c.tipo === 'data' ? 'dd/mm/yyyy' : c.tipo === 'percentual' ? '0.0%' : c.tipo === 'numero' ? '#,##0' : '@'; });
    ws.getRow(6).height = 34;
    ws.getRow(6).eachCell(c => { c.font = { name: 'Calibri', bold: true, size: 11, color: { argb: XL_COR.branco } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL_COR.tinta } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
    for (let linha = 7; linha <= 6 + rows.length; linha++) {
      ws.getRow(linha).height = Math.min(180, Math.max(30, ...rows[linha - 7].map((v, n) => aba.colunas[n].tipo === 'texto' ? Math.ceil(String(v || '').length / (aba.colunas[n].largura - 2)) * 15 : 30)));
      ws.getRow(linha).eachCell(c => { c.font = { name: 'Calibri', size: 11, color: { argb: XL_COR.tinta } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
    }
    ws.pageSetup.printArea = `A1:${ws.getColumn(aba.colunas.length).letter}${Math.max(7, 6 + rows.length)}`;
    if (!rows.length) ws.getCell('A7').value = 'Nenhum registro neste recorte.';
    if (aba.nome === 'Técnicos' && rows.length) {
      for (const [col, cor] of [['F', 'D54B5D'], ['N', 'B77919']]) ws.addConditionalFormatting({
        ref: `${col}7:${col}${6 + rows.length}`,
        rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: [0], style: { font: { bold: true, color: { argb: cor } } } }],
      });
    }
  });
  const dados = livro.addWorksheet('Dados dos gráficos'); dados.columns = [{ width: 40 }, { width: 22 }, { width: 22 }];
  const graficos = graficosRelatorio(r); let linha = 1;
  const refs = graficos.map(g => {
    dados.getCell(linha, 1).value = g.titulo; dados.getCell(linha, 1).font = { bold: true, size: 14 }; linha++;
    dados.getRow(linha++).values = ['Categoria', ...g.series.map(s => s.nome)];
    const categorias = g.categorias.length ? g.categorias : ['Sem registros'], inicio = linha;
    categorias.forEach((c, n) => { dados.getRow(linha++).values = [c, ...g.series.map(s => s.valores[n] || 0)]; });
    const ref = { inicio, fim: linha - 1 }; linha += 3; return ref;
  });
  dados.views = [{ showGridLines: false }];
  const criterios = livro.addWorksheet('Critérios'); criterios.columns = [{ width: 27 }, { width: 110 }];
  criterios.addRow(['RELATÓRIO GERENCIAL', 'Critérios, recorte e origem dos dados']);
  criterios.addRow(['Período das saídas', `${fmtData(r.inicio)} a ${fmtData(r.fim)}`]);
  criterios.addRow(['Filtros aplicados', r.filtrosTexto]); criterios.addRow(['Emissão (Brasília)', fmtDataHora(r.emitido)]);
  r.notas.forEach((nota, n) => criterios.addRow([`Critério ${n + 1}`, nota]));
  criterios.addRow(['Saídas a classificar', r.k.classificar]); criterios.addRow(['Devoluções sem idade', r.k.devolvidas - r.k.avaliadas]);
  r.frescor.forEach(i => criterios.addRow([`${i.regiao} / ${i.tipo}`, i.em ? `Última importação: ${fmtDataHora(i.em)} · ${i.arquivo || ''}` : 'Sem importação']));
  criterios.eachRow(row => { row.height = Math.max(32, Math.ceil(String(row.getCell(2).value || '').length / 95) * 17); row.eachCell(c => { c.alignment = { wrapText: true, vertical: 'middle' }; c.font = { name: 'Calibri', size: 11 }; }); });
  const buf = await livro.xlsx.writeBuffer();
  return new Blob([adicionarGraficosExcel(buf, graficos, refs)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ExcelJS cria as células e estilos; estes relacionamentos OOXML acrescentam os
   gráficos nativos vinculados a células, em vez de colar imagens no arquivo. */
function xmlGraficoExcel(g, ref, id) {
  const xml = v => esc(String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));
  const cats = g.categorias.length ? g.categorias : ['Sem registros'];
  const cache = (tag, valores) => `<c:${tag}><c:ptCount val="${valores.length}"/>${valores.map((v, n) => `<c:pt idx="${n}"><c:v>${xml(v)}</c:v></c:pt>`).join('')}</c:${tag}>`;
  const formula = col => xml(`'Dados dos gráficos'!$${col}$${ref.inicio}:$${col}$${ref.fim}`);
  const series = g.series.map((s, n) => {
    const valores = cats.map((_, j) => s.valores[j] || 0);
    return `<c:ser><c:idx val="${n}"/><c:order val="${n}"/><c:tx><c:v>${xml(s.nome)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${s.cor.slice(1)}"/></a:solidFill><a:ln w="25400"><a:solidFill><a:srgbClr val="${s.cor.slice(1)}"/></a:solidFill></a:ln></c:spPr>${g.tipo === 'doughnut' ? cats.map((_, j) => `<c:dPt><c:idx val="${j}"/><c:spPr><a:solidFill><a:srgbClr val="${g.cores[j].slice(1)}"/></a:solidFill></c:spPr></c:dPt>`).join('') : ''}<c:cat><c:strRef><c:f>${formula('A')}</c:f>${cache('strCache', cats)}</c:strRef></c:cat><c:val><c:numRef><c:f>${formula(String.fromCharCode(66 + n))}</c:f><c:numCache><c:formatCode>#,##0</c:formatCode>${cache('numCache', valores).replace(/^<c:numCache>|<\/c:numCache>$/g, '')}</c:numCache></c:numRef></c:val></c:ser>`;
  }).join('');
  const a = id * 10 + 1, b = id * 10 + 2, donut = g.tipo === 'doughnut', bar = g.tipo === 'bar';
  const labels = `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="${bar ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${donut ? 1 : 0}"/><c:showLeaderLines val="1"/></c:dLbls>`;
  const grafico = donut ? `<c:doughnutChart><c:varyColors val="1"/>${series}${labels}<c:firstSliceAng val="270"/><c:holeSize val="68"/></c:doughnutChart>`
    : bar ? `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}${labels}<c:gapWidth val="90"/><c:axId val="${a}"/><c:axId val="${b}"/></c:barChart>`
    : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:smooth val="0"/><c:axId val="${a}"/><c:axId val="${b}"/></c:lineChart>`;
  const eixos = donut ? '' : `<c:catAx><c:axId val="${a}"/><c:scaling><c:orientation val="${bar ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${bar ? 'l' : 'b'}"/><c:tickLblPos val="nextTo"/><c:crossAx val="${b}"/><c:crosses val="autoZero"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>${bar ? '' : `<c:tickLblSkip val="${Math.max(1, Math.ceil(cats.length / 7))}"/>`}</c:catAx><c:valAx><c:axId val="${b}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${bar ? 'b' : 'l'}"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${a}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="pt-BR"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="1400" b="1"/><a:t>${xml(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${grafico}${eixos}</c:plotArea>${bar ? '' : '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'}<c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E4E9ED"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}
function adicionarGraficosExcel(buf, graficos, refs) {
  const arquivos = fflate.unzipSync(new Uint8Array(buf)), ler = nome => fflate.strFromU8(arquivos[nome]), gravar = (nome, texto) => { arquivos[nome] = fflate.strToU8(texto); };
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', pkg = 'http://schemas.openxmlformats.org/package/2006/relationships';
  // Resumo é a primeira folha e não possui outros desenhos/relacionamentos.
  gravar('xl/worksheets/sheet1.xml', ler('xl/worksheets/sheet1.xml').replace(/<\/worksheet>$/, '<drawing r:id="rIdRelatorio"/></worksheet>'));
  gravar('xl/worksheets/_rels/sheet1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${pkg}"><Relationship Id="rIdRelatorio" Type="${ns}/drawing" Target="../drawings/relatorio.xml"/></Relationships>`);
  let tipos = ler('[Content_Types].xml');
  const ancora = (col, row) => `<xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  const desenhos = graficos.map((g, n) => {
    const id = n + 1, col = n % 2 * 6, row = n < 2 ? 14 : 32;
    gravar(`xl/charts/relatorio${id}.xml`, xmlGraficoExcel(g, refs[n], id));
    tipos = tipos.replace('</Types>', `<Override PartName="/xl/charts/relatorio${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
    return `<xdr:twoCellAnchor><xdr:from>${ancora(col, row)}</xdr:from><xdr:to>${ancora(col + 6, row + 16)}</xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Gráfico ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${ns}" r:id="rId${id}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join('');
  gravar('xl/drawings/relatorio.xml', `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${desenhos}</xdr:wsDr>`);
  gravar('xl/drawings/_rels/relatorio.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${pkg}">${graficos.map((_, n) => `<Relationship Id="rId${n + 1}" Type="${ns}/chart" Target="../charts/relatorio${n + 1}.xml"/>`).join('')}</Relationships>`);
  tipos = tipos.replace('</Types>', '<Override PartName="/xl/drawings/relatorio.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  gravar('[Content_Types].xml', tipos);
  return fflate.zipSync(arquivos, { level: 6 });
}
async function pngGraficoRelatorio(g) {
  const url = URL.createObjectURL(new Blob([svgGraficoRelatorio(g, true)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1120; canvas.height = 560;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
async function gerarPdfRelatorio(r) {
  await bibliotecasPdfRelatorio();
  const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Positivo | Relatório gerencial', subject: `${r.inicio} a ${r.fim}`, creator: 'Controle de peças Positivo' });
  const largura = 297, altura = 210, margem = 14;
  const texto = (t, x, y, tamanho = 10, cor = '#17202A', peso = 'normal', opcoes = {}) => {
    doc.setFont('helvetica', peso); doc.setFontSize(tamanho); doc.setTextColor(cor); doc.text(String(t), x, y, opcoes);
  };
  function cabecalho(titulo) {
    doc.setFillColor('#17202A'); doc.rect(0, 0, largura, 3, 'F');
    texto('POSITIVO TECNOLOGIA', margem, 14, 10, '#17202A', 'bold');
    texto('CONTROLE DE PEÇAS / RELATÓRIOS', largura - margem, 14, 8, '#596675', 'normal', { align: 'right' });
    texto(titulo, margem, 26, 20, '#17202A', 'bold');
    texto(`Movimentações: ${fmtData(r.inicio)} a ${fmtData(r.fim)}  |  Estoque avaliado em ${fmtData(r.hoje)}`, margem, 34, 9, '#596675');
    texto(doc.splitTextToSize(r.filtrosTexto, largura - 2 * margem), margem, 40, 8, '#596675');
  }
  cabecalho('Relatório gerencial');
  indicadoresRelatorio(r).forEach((i, n) => {
    const x = margem + (n % 3) * 91, y = 51 + Math.floor(n / 3) * 36;
    doc.setFillColor('#F3F6F8'); doc.roundedRect(x, y, 87, 32, 2, 2, 'F');
    doc.setFillColor(CORES_RELATORIO[i.cor]); doc.rect(x, y + 5, 1, 22, 'F');
    texto(i.titulo, x + 5, y + 7, 9, '#17202A', 'bold');
    texto(valorIndicadorRelatorio(i), x + 5, y + 20, 23, CORES_RELATORIO[i.cor], 'bold');
    texto(i.escopo, x + 82, y + 19, 8, '#596675', 'normal', { align: 'right' });
    texto(i.detalhe, x + 5, y + 27, 7, '#596675');
  });
  texto('Leitura do período', margem, 134, 12, '#17202A', 'bold');
  texto(`${fmtNum(r.k.classificar)} novas com saída a classificar   |   ${fmtNum(r.k.transferidas)} transferidas / ajustadas`, margem, 143, 10);
  texto(doc.splitTextToSize('Saídas sem classificação não contam como devolução ou uso confirmado. Consulte os critérios e a relação completa de peças nas próximas páginas.', 265), margem, 151, 9, '#596675');
  const desatualizadas = r.frescor.filter(i => !i.em || i.dias > 0);
  texto(doc.splitTextToSize(r.frescor.length ? `${desatualizadas.length} de ${r.frescor.length} planilhas do recorte não foram atualizadas hoje. O saldo usa a última importação disponível.` : 'Sem planilhas importadas neste recorte. Os saldos não confirmam ausência de estoque.', 265), margem, 169, 9, '#596675');
  texto(`Emitido em ${fmtDataHora(r.emitido)} (Brasília)`, margem, 185, 8, '#596675');
  const graficos = graficosRelatorio(r), imagens = await Promise.all(graficos.map(pngGraficoRelatorio));
  doc.addPage(); cabecalho('Indicadores visuais');
  graficos.forEach((g, n) => {
    const x = margem + n % 2 * 137, y = 50 + Math.floor(n / 2) * 73;
    texto(g.titulo, x, y, 11, '#17202A', 'bold'); texto(g.sub, x, y + 5, 7, '#596675');
    doc.addImage(imagens[n], 'PNG', x, y + 6, 130, 65);
  });
  const tabela = (titulo, head, body, estilos = {}) => {
    doc.addPage();
    doc.autoTable({ startY: 50, margin: { left: margem, right: margem, top: 50, bottom: 17 }, head: [head], body: body.length ? body : [['Nenhum registro neste recorte.', ...head.slice(1).map(() => '')]], theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: '#17202A', overflow: 'linebreak', lineColor: '#E4E9ED', lineWidth: .1 },
      headStyles: { fillColor: '#17202A', textColor: '#FFFFFF', fontStyle: 'bold' }, alternateRowStyles: { fillColor: '#F3F6F8' }, columnStyles: estilos, rowPageBreak: 'avoid',
      didDrawPage: () => { cabecalho(titulo); },
    });
  };
  const valor = v => v == null ? '—' : fmtNum(v);
  tabela('Consolidado por técnico', ['Técnico / UF', 'Usadas\nem aberto', 'Novas\nsaldo', 'Em\natraso', 'Devolvidas\nperíodo', 'No prazo', 'Uso de\nnovas', 'Limite\nnovas', 'Excesso'], r.tecnicos.map(t => [t.nome + '\n' + t.regiao + ' · ' + t.localidade, r.filtros.tipo === 'novas' ? '—' : valor(t.usadas), r.filtros.tipo === 'usadas' ? '—' : t.semPlanilha ? 'Sem planilha' : valor(t.novas), valor(t.atrasadas), valor(t.devolvidas), t.taxa === null ? '—' : fmtPct(t.taxa), r.filtros.tipo === 'usadas' ? '—' : valor(t.uso), t.limite === 0 ? 'Sem limite' : valor(t.limite), valor(t.excesso)]), { 0: { cellWidth: 70 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  tabela('Inventário atual · relação completa', ['Técnico / UF', 'Material / código', 'Tipo', 'Qtd.', 'Idade / prazo', 'Situação', 'Previsão / responsável'], r.estoque.map(i => [i.nome + '\n' + i.regiao, i.mat + '\n' + i.desc, i.tipo === 'usadas' ? 'Usada' : 'Nova', fmtNum(i.qtd), `${i.dias} / ${i.prazo} dias`, i.situacao + (i.atraso ? `\n${i.atraso} dias de atraso` : ''), i.previsao ? fmtData(i.previsao) + '\n' + autorPrevisao(i) : '—']), { 0: { cellWidth: 48 }, 1: { cellWidth: 75 }, 3: { halign: 'right', cellWidth: 13 } });
  tabela('Movimentações · relação completa', ['Saída observada', 'Técnico / UF', 'Material / código', 'Tipo', 'Qtd.', 'Destino', 'Prazo / pontualidade'], r.saidas.map(i => [fmtData(i.em), i.nome + '\n' + i.regiao, i.mat + '\n' + i.desc, i.tipo === 'usadas' ? 'Usada' : 'Nova', fmtNum(i.qtd), DESTINOS_NOVAS[i.destino] || 'A classificar', i.destino === 'devolucao' ? `${i.prazo} dias\n${i.pontual === null ? 'Sem idade registrada' : i.pontual ? 'No prazo' : 'Com atraso'}` : 'Não se aplica']), { 1: { cellWidth: 48 }, 2: { cellWidth: 75 }, 4: { halign: 'right', cellWidth: 13 } });
  tabela('Materiais · estoque e movimentações', ['Código / descrição', 'Família', 'Tipo', 'Estoque atual', 'Devolvidas', 'Uso de novas', 'A classificar'], r.materiais.map(i => [i.mat + '\n' + i.desc, i.familia, i.tipo === 'usadas' ? 'Usada' : 'Nova', valor(i.estoque), valor(i.devolvidas), i.tipo === 'novas' ? valor(i.uso) : '—', valor(i.classificar)]), { 0: { cellWidth: 90 } });
  tabela('Critérios e origem dos dados', ['Referência', 'Descrição'], [
    ...r.notas.map((n, i) => [`Critério ${i + 1}`, n]),
    ['Devoluções sem idade', `${fmtNum(r.k.devolvidas - r.k.avaliadas)} peças excluídas apenas da taxa de pontualidade.`],
    ...r.frescor.map(i => [`Planilha ${i.regiao} / ${i.tipo}`, i.em ? `${fmtDataHora(i.em)} · ${i.arquivo || ''}` : 'Sem importação']),
  ], { 0: { cellWidth: 43 } });
  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina); doc.setDrawColor('#E4E9ED'); doc.line(margem, altura - 12, largura - margem, altura - 12);
    texto('Positivo Tecnologia · Relatório de controle de peças', margem, altura - 7, 8, '#596675');
    texto(`${pagina} / ${doc.getNumberOfPages()}`, largura - margem, altura - 7, 8, '#596675', 'normal', { align: 'right' });
  }
  return doc.output('blob');
}
