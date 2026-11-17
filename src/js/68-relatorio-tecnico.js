/* PDF individual: posição atual por técnico e UF, independente do recorte gerencial. */
const UIpdfTecnico = { busca: '', uf: '', pagina: 1, gerando: '' };
const LOGO_PDF_TECNICO = '/*__LOGO_RELATORIO__*/';
const TIPOS_PDF_TECNICO = [['novas','Peças novas'],['usadas','Peças usadas'],['rmdf','RMDF · peças com defeito']];

function opcoesPdfTecnico(D = derivar()) {
  const mapa = new Map();
  const incluir = (tid, uf) => {
    if (!tid || !Object.hasOwn(UFS, uf) || regiaoDesativada(uf)) return;
    const chave = JSON.stringify([tid, uf]);
    if (!mapa.has(chave)) mapa.set(chave, { chave, tid, uf, nome: nomeBonito(E.cadastro[tid]?.nome)||nomeTecnico(tid), apelido:E.cadastro[tid]?.apelido||'' });
  };
  for (const [tid, c] of Object.entries(E.cadastro)) if(!c.excluido)incluir(tid, c.regiao);
  for (const i of [...D.itens, ...E.novas, ...E.rmdf]) incluir(i.tid, i.regiao);
  return [...mapa.values()].sort((a,b)=>comparar(a.nome,b.nome)||comparar(a.uf,b.uf));
}
function dadosPdfTecnico(tid, uf, D = derivar()) {
  const tecnico = opcoesPdfTecnico(D).find(t=>t.tid===tid&&t.uf===uf);
  if (!tecnico) throw new Error('O técnico ou a UF não está disponível na operação atual.');
  const pertence = i=>i.tid===tid&&i.regiao===uf;
  const fontes = { novas: D.tecnicos.flatMap(t=>t.novasLinhas).filter(pertence), usadas: D.itens.filter(pertence), rmdf: D.rmdf.filter(pertence) };
  const grupos = TIPOS_PDF_TECNICO.map(([tipo,titulo])=>{
    const linhas = fontes[tipo].map(i=>{
      if (!Number.isSafeInteger(i.qtd) || i.qtd <= 0) throw new Error('Há uma quantidade inválida no estoque. Confira o relatório antes de exportar.');
      const base = String(tipo==='novas' ? i.contagemDesde || inicioContagemNova(i.desde,D.hoje) : i.dataFT || i.desde || '').slice(0,10);
      const valida = /^\d{4}-\d{2}-\d{2}$/.test(base)&&somaDias(base,0)===base;
      const futura = valida&&base>D.hoje;
      const dias = valida&&!futura ? tipo==='novas' ? diasComPecaNova(base,D.hoje) : Math.max(0,diffDias(base,D.hoje)) : null;
      const referencia = tipo==='novas' ? 'Relatório inicial' : i.dataFT ? 'Fechamento (Data FT)' : 'Primeiro relatório';
      return { tipo, mat:String(i.mat), descricao:i.desc||E.catalogo[i.mat]||'Sem descrição', qtd:i.qtd, dias, base:valida?base:'', referencia,
        prazo:i.prazo, atrasada:dias!==null&&dias>i.prazo,
        nf:i.nf||'', remessa:i.remessa||'', chamado:i.chamado||'', envio:i.tipoEnvio||'', conferencia:i.conferencia||'', problema:futura?'Data futura: confira a origem':!valida?'Data não informada':'' };
    }).sort((a,b)=>(b.dias!==null)-(a.dias!==null)||(b.dias||0)-(a.dias||0)||comparar(a.mat,b.mat));
    const arquivo=E.indice.arquivos?.[`${tipo}:${uf}`];
    return { tipo,titulo,linhas,quantidade:somar(linhas,i=>i.qtd),conhecido:!!arquivo?.em||linhas.length>0,atualizadoEm:arquivo?.em||'',arquivo:arquivo?.arquivo||'' };
  });
  return { ...tecnico, hoje:D.hoje,emitido:agoraISO(),grupos,total:grupos.every(g=>g.conhecido)?somar(grupos,g=>g.quantidade):null,
    semData:somar(grupos,g=>g.linhas.filter(i=>i.dias===null).length),atrasadas:somar(grupos,g=>somar(g.linhas.filter(i=>i.atrasada),i=>i.qtd)) };
}
function renderPdfsTecnicos(D) {
  const s=UIpdfTecnico,opcoes=opcoesPdfTecnico(D),termos=normBusca(s.busca).split(/\s+/).filter(Boolean);
  const lista=opcoes.filter(t=>(!s.uf||t.uf===s.uf)&&termos.every(q=>normBusca(`${t.nome} ${t.apelido} ${t.uf} ${t.tid}`).includes(q)));
  const paginas=Math.max(1,Math.ceil(lista.length/9));s.pagina=Math.min(s.pagina,paginas);
  return `<section class="rel-individual" aria-labelledby="pdf-tecnico-titulo"><header><div><span class="sobretitulo">POSIÇÃO ATUAL</span><h3 id="pdf-tecnico-titulo">PDF individual por técnico</h3><p>Novas, usadas e RMDF com as peças, quantidades e dias. Cada PDF contém o estoque completo do técnico na UF escolhida.</p></div>${icone('arquivo')}</header>
    <div class="rel-individual-filtros"><label class="campo"><span>Buscar técnico</span><input type="search" data-digitar="pdf-tecnico-busca" value="${esc(s.busca)}" placeholder="Nome ou identificador"></label><label class="campo"><span>UF do estoque</span><select data-mudar="pdf-tecnico-uf"><option value="">Todas as UFs</option>${regioesOperacionais(opcoes.map(t=>t.uf)).map(uf=>`<option value="${uf}" ${s.uf===uf?'selected':''}>${uf}</option>`).join('')}</select></label></div>
    <div class="rel-tecnicos-grade">${lista.slice((s.pagina-1)*9,s.pagina*9).map(t=>{
      let r;try { r=dadosPdfTecnico(t.tid,t.uf,D); }
      catch(e){return `<article class="rel-tecnico-card"><header><h4>${esc(t.nome)}</h4>${regiaoTag(t.uf)}</header><p class="txt-crit">${esc(e.message)}</p><button class="btn" disabled>Confira as quantidades</button></article>`;}
      return `<article class="rel-tecnico-card"><header><h4>${esc(t.nome)}</h4>${regiaoTag(t.uf)}</header><dl>${r.grupos.map(g=>`<div><dt>${g.tipo==='rmdf'?'RMDF':g.tipo==='novas'?'Novas':'Usadas'}</dt><dd>${g.conhecido?fmtNum(g.quantidade):'—'}</dd></div>`).join('')}</dl><button class="btn" data-acao="pdf-tecnico-baixar" data-tid="${esc(t.tid)}" data-uf="${t.uf}" ${s.gerando?'disabled':''}>${icone('baixar')}${s.gerando===t.chave?'Preparando PDF…':'Baixar PDF individual'}</button></article>`;
    }).join('')||'<p class="nota">Nenhum técnico encontrado. Revise a busca ou a UF.</p>'}</div>
    <div class="rel-individual-rodape"><p>${plural(lista.length,'relatório disponível','relatórios disponíveis')}</p><div><button class="btn pequeno" data-acao="pdf-tecnico-pagina" data-delta="-1" ${s.pagina<=1?'disabled':''}>Anterior</button><span>${s.pagina} / ${paginas}</span><button class="btn pequeno" data-acao="pdf-tecnico-pagina" data-delta="1" ${s.pagina>=paginas?'disabled':''}>Próxima</button></div></div></section>`;
}
async function exportarPdfTecnico(tid, uf) {
  if (UIpdfTecnico.gerando) return;
  const permitida=()=>E.status==='pronto'&&!perfilTecnico()&&(Acesso.modo!=='firebase'||(!!Acesso.usuario?.uid&&Acesso.perfil?.ativo));
  if (!permitida()) throw new Error('Entre com uma conta autorizada para exportar o relatório.');
  const sessao=`${Acesso.modo}|${Acesso.usuario?.uid||''}`,r=structuredClone(dadosPdfTecnico(tid,uf));
  UIpdfTecnico.gerando=r.chave;renderizar(true);
  try {
    const blob=await gerarPdfTecnico(r);
    if (!permitida()||sessao!==`${Acesso.modo}|${Acesso.usuario?.uid||''}`) throw new Error('A sessão mudou. Entre novamente antes de exportar.');
    const nome=semAcentos(r.nome).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'tecnico';
    await baixarArquivoRelatorio(blob,`positivo-tecnico-${nome}-${uf}-${r.hoje}.pdf`);
    toast('PDF individual pronto, com todas as peças do técnico nesta UF.');
  } finally { UIpdfTecnico.gerando='';if(UI.pagina==='relatorios'&&E.status==='pronto')renderizar(true); }
}
async function gerarPdfTecnico(r) {
  await bibliotecasPdfRelatorio();
  await Promise.all([
    carregarBibliotecaRelatorio('jspdf-autotable-5.0.9.min.js',()=>window.jspdf?.jsPDF?.API.autoTable),
    carregarBibliotecaRelatorio('fontes-pdf-tecnico-2.37.js',()=>window.CP_FONTES_PDF_TECNICO)
  ]);
  const doc=new jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  for(const [estilo,arquivo]of [['normal','DejaVuSans.ttf'],['bold','DejaVuSans-Bold.ttf']]){
    doc.addFileToVFS(arquivo,CP_FONTES_PDF_TECNICO[estilo]);doc.addFont(arquivo,'positivo',estilo);
  }
  const cor={tinta:'#192430',suave:'#647487',linha:'#D8DFE6',fundo:'#F1F4F7',branco:'#FFFFFF',crit:'#B5364B',critFundo:'#FBECEF'};
  const limpo=v=>String(v??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,' ').replace(/\t/g,' ').replace(/\r\n?/g,'\n');
  const fonte=(n=8,bold=false,c=cor.tinta)=>{doc.setFont('positivo',bold?'bold':'normal');doc.setFontSize(n);doc.setTextColor(c);};
  const texto=(t,x,y,n=8,bold=false,c=cor.tinta,opts={})=>{fonte(n,bold,c);doc.text(limpo(t),x,y,opts);};
  const ajustar=(t,largura,tamanho)=>{fonte(tamanho,true);while(doc.getTextWidth(limpo(t))>largura&&tamanho>4){tamanho-=.5;fonte(tamanho,true);}return tamanho;};
  const cabecalhos=new Set();
  const logo=()=>{const p=doc.getImageProperties(LOGO_PDF_TECNICO);const largura=40,altura=largura*p.height/p.width;doc.addImage(LOGO_PDF_TECNICO,'PNG',156,11,largura,altura,'positivo-tecnico');};
  function cabecalho(completo=false) {
    const pagina=doc.getCurrentPageInfo().pageNumber;if(cabecalhos.has(pagina))return;
    cabecalhos.add(pagina);doc.setFillColor(cor.tinta);doc.rect(0,0,210,2.5,'F');logo();
    texto(completo?'Relatório do técnico':'Relatório individual · continuação',14,19,completo?19:13,true);
    texto(`Posição de ${fmtData(r.hoje)} · ${r.uf}`,14,27,8.5,false,cor.suave);
    if(!completo){
      texto(r.nome,14,34,ajustar(r.nome,182,9),true);return;
    }
  }
  doc.setProperties({title:`Relatório individual | ${limpo(r.nome)} | ${r.uf}`,subject:'Novas, usadas e RMDF · posição atual',author:'Positivo Tecnologia',creator:'Controle de peças Positivo'});
  cabecalho(true);
  fonte(17,true);const nome=doc.splitTextToSize(limpo(r.nome),182);doc.text(nome,14,42);
  let y=42+(nome.length-1)*7+7;
  texto(`${UFS[r.uf]||r.uf} · Emitido em ${fmtDataHora(r.emitido)} (Brasília)`,14,y,8,false,cor.suave);y+=7;
  const cards=[['TOTAL EM ESTOQUE',r.total],...r.grupos.map(g=>[g.tipo==='novas'?'PEÇAS NOVAS':g.tipo==='usadas'?'PEÇAS USADAS':'PEÇAS RMDF',g.conhecido?g.quantidade:null])];
  cards.forEach(([titulo,quantidade],n)=>{
    const x=14+n*46.5;doc.setFillColor(n?cor.fundo:cor.tinta);doc.roundedRect(x,y,42.5,24,2.5,2.5,'F');
    texto(titulo,x+3.5,y+6,7,true,n?cor.suave:cor.branco);
    const valor=quantidade===null?'—':fmtNum(quantidade);texto(valor,x+3.5,y+19,ajustar(valor,35.5,24),true,n?cor.tinta:cor.branco);
  });y+=30;
  if(r.semData){texto(`${r.semData} registro(s) sem data válida para contagem: confira as referências.`,14,y,7.5,false,cor.crit);y+=5;}
  for(const g of r.grupos){
    const atualizacao=g.atualizadoEm?`Relatório de ${fmtDataHora(g.atualizadoEm)}`:g.conhecido?'Data do relatório não informada':'Planilha não importada';
    const body=g.linhas.map(i=>[
      `${i.mat}\n${i.descricao}`,
      fmtNum(i.qtd),
      i.dias===null?'Sem data':plural(i.dias,'dia','dias'),
      [i.base?`${i.referencia}: ${fmtData(i.base)}`:'Data não informada',i.problema,i.envio?`Envio: ${i.envio}`:'',i.chamado?`Chamado: ${i.chamado}`:'',i.nf?`NF: ${i.nf}`:'',i.remessa?`Remessa: ${i.remessa}`:''].filter(Boolean).join('\n')
    ].map(limpo));
    const vazio=g.conhecido?'Nenhuma peça na última relação importada.':'Sem planilha importada para este tipo e UF; o saldo não está confirmado.';
    doc.autoTable({startY:y,margin:{top:45,bottom:19,left:14,right:14},tableWidth:182,theme:'plain',pageBreak:'auto',rowPageBreak:'auto',showHead:'everyPage',
      head:[[{content:`${g.titulo} · ${g.conhecido?plural(g.quantidade,'peça','peças'):'saldo não confirmado'}`,colSpan:4,styles:{fillColor:cor.branco,textColor:cor.tinta,fontSize:11,fontStyle:'bold',cellPadding:{top:5,right:0,bottom:2,left:0}}}],
        [{content:atualizacao,colSpan:4,styles:{fillColor:cor.branco,textColor:cor.suave,fontSize:7,fontStyle:'normal',cellPadding:{top:0,right:0,bottom:3,left:0}}}],['MATERIAL / DESCRIÇÃO','QTD.','DIAS','REFERÊNCIAS']],
      body:body.length?body:[[{content:vazio,colSpan:4}]],
      styles:{font:'positivo',fontSize:8.5,textColor:cor.tinta,cellPadding:3,overflow:'linebreak',lineWidth:0,minCellHeight:10},
      headStyles:{fillColor:cor.tinta,textColor:cor.branco,fontStyle:'bold',fontSize:7.5},alternateRowStyles:{fillColor:cor.fundo},
      columnStyles:{0:{cellWidth:83},1:{cellWidth:14,halign:'right'},2:{cellWidth:23,halign:'center',fontStyle:'bold'},3:{cellWidth:62,fontSize:7,textColor:cor.suave}},
      willDrawPage:()=>cabecalho(),
      didParseCell:data=>{if(data.section==='body'&&data.column.index===2&&g.linhas[data.row.index]?.atrasada){data.cell.styles.textColor=cor.crit;data.cell.styles.fillColor=cor.critFundo;}}
    });y=doc.lastAutoTable.finalY+4;
  }
  const paginas=doc.getNumberOfPages();
  for(let n=1;n<=paginas;n++){
    doc.setPage(n);doc.setDrawColor(cor.linha);doc.line(14,281,196,281);
    texto(`Positivo Tecnologia · ${r.uf} · Posição em ${fmtData(r.hoje)}`,14,286,7,false,cor.suave);
    texto(`Página ${n} de ${paginas}`,196,286,7,false,cor.suave,{align:'right'});
  }
  return doc.output('blob');
}
