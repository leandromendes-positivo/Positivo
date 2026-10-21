/* Relação RMDF independente: a origem não informa aplicação, baixa ou devolução. */
const UIrmdf={regiao:'',busca:'',pagina:1};
function referenciaRmdf(p){return JSON.stringify([p.regiao,p.tid,p.nf||'',p.remessa||'',p.mat,p.chamado||'',p.dataFT||'']);}
function conferirRelacaoRmdf(linhas=E.rmdf){
  const usadas=new Set(E.usadas.map(referenciaRmdf));
  const novas=new Set(E.novas.map(p=>JSON.stringify([p.regiao,p.tid,p.mat])));
  return linhas.map(p=>({...p,nome:nomeTecnico(p.tid),desc:E.catalogo[p.mat]||'',conferencia:usadas.has(referenciaRmdf(p))?'Mesma referência também em usadas':novas.has(JSON.stringify([p.regiao,p.tid,p.mat]))?'Material também em novas; conferir referência':'Sem correspondência nas outras relações'}));
}
function linhasRmdfFiltradas(){
  const termos=normBusca(UIrmdf.busca).trim().split(/\s+/).filter(Boolean);
  return conferirRelacaoRmdf().filter(p=>(!UIrmdf.regiao||p.regiao===UIrmdf.regiao)&&termos.every(t=>normBusca(`${p.nome} ${p.mat} ${p.desc} ${p.nf} ${p.remessa} ${p.chamado}`).includes(t))).sort((a,b)=>comparar(a.nome,b.nome)||comparar(a.regiao,b.regiao)||comparar(a.mat,b.mat)||comparar(a.chamado,b.chamado));
}
function renderRmdf(){
  const linhas=linhasRmdfFiltradas(),paginas=Math.max(1,Math.ceil(linhas.length/100));UIrmdf.pagina=Math.min(UIrmdf.pagina,paginas);
  const lista=linhas.slice((UIrmdf.pagina-1)*100,UIrmdf.pagina*100);
  return `<div class="barra-filtros"><label class="campo"><span>UF</span><select data-mudar="rmdf-regiao"><option value="">Todas</option>${Object.keys(UFS).map(uf=>`<option value="${uf}" ${UIrmdf.regiao===uf?'selected':''}>${uf}</option>`).join('')}</select></label><label class="campo"><span>Buscar técnico, peça ou referência</span><input type="search" data-digitar="rmdf-busca" value="${esc(UIrmdf.busca)}" placeholder="Nome, material, NF, remessa ou chamado"></label><button class="btn" data-acao="exportar-rmdf" ${linhas.length?'':'disabled'}>${icone('baixar')}Exportar RMDF</button></div>
  <div class="usuarios-resumo"><span><strong>${fmtNum(somar(linhas,p=>p.qtd))}</strong> peças na relação RMDF</span><span><strong>${new Set(linhas.map(p=>p.tid+'|'+p.regiao)).size}</strong> técnicos / UF</span><span><strong>${fmtNum(linhas.length)}</strong> registros</span></div>
  <p class="nota">Esta relação é independente dos estoques de novas e usadas. Os valores não são somados entre categorias, pois a mesma peça pode constar em mais de uma origem. A planilha RMDF não comprova aplicação, aprovação, devolução nem baixa; a ausência na próxima importação também não confirma devolução. Correspondências abaixo são alertas para conferência.</p>
  ${lista.length?`<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Técnico / UF</th><th>Material</th><th>Quantidade</th><th>NF / remessa</th><th>Chamado</th><th>Data FT</th><th>Conferência</th></tr></thead><tbody>${lista.map(p=>`<tr><td><strong>${esc(p.nome)}</strong><small class="sub-celula">${esc(p.regiao)}</small></td><td><strong>${esc(p.mat)}</strong><small class="sub-celula">${esc(p.desc)}</small></td><td>${fmtNum(p.qtd)}</td><td>${esc(p.nf||'—')}<small class="sub-celula">${esc(p.remessa||'—')}</small></td><td>${esc(p.chamado||'—')}</td><td>${p.dataFT?esc(fmtData(p.dataFT)):'Não informada'}</td><td>${esc(p.conferencia)}</td></tr>`).join('')}</tbody></table></div><div class="form-acoes"><button class="btn pequeno" data-acao="rmdf-pagina" data-delta="-1" ${UIrmdf.pagina===1?'disabled':''}>Anterior</button><span>Página ${UIrmdf.pagina} de ${paginas}</span><button class="btn pequeno" data-acao="rmdf-pagina" data-delta="1" ${UIrmdf.pagina===paginas?'disabled':''}>Próxima</button></div>`:vazio('caixa','Nenhum registro RMDF neste recorte','Importe a planilha identificada como RMDF ou ajuste os filtros.')}`;
}
function abaExportacaoRmdf(linhas=conferirRelacaoRmdf()){
  return {nome:'Relação RMDF',colunas:[{titulo:'Técnico',largura:32},{titulo:'UF',largura:6},{titulo:'Material',largura:18},{titulo:'Descrição',largura:42},{titulo:'Quantidade',largura:12,tipo:'numero'},{titulo:'NF',largura:18},{titulo:'Remessa',largura:18},{titulo:'Chamado',largura:18},{titulo:'Data FT',largura:18,tipo:'data'},{titulo:'Conferência',largura:48}],linhas:linhas.map(p=>[p.nome,p.regiao,p.mat,p.desc,p.qtd,p.nf,p.remessa,p.chamado,p.dataFT,p.conferencia])};
}
async function exportarRmdf(){await exportarExcel(`rmdf-${hojeISO()}.xlsx`,[abaExportacaoRmdf(linhasRmdfFiltradas())]);}
