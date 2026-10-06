/* Acervo completo: consulta os documentos preservados, sem o corte operacional de 120 dias. */
const UIinventario = { tid: '', tipo: '', estado: '', busca: '', pagina: 1, carregando: false, erro: '', chave: null, devolucoes: [], movimentos: [] };
function chaveInventario() { return `${E.indice.versao || 0}|${E.movimentos.map(m=>`${m.k}:${m.destino}:${m.qtd}`).join(',')}`; }
async function carregarInventario() {
  if (UIinventario.carregando) return;
  const chave = chaveInventario();
  UIinventario.carregando = true; UIinventario.erro = ''; renderizar(true);
  try {
    const [devs,movs]=await Promise.all([Armazem.consultar('devolucoes'),Armazem.consultar('movimentos')]);
    if (E.status !== 'pronto') return;
    UIinventario.devolucoes=devs.flatMap(d=>(d.itens||[]).map(l=>decodificarDevolucao(l,d.id)));
    UIinventario.movimentos=movs.flatMap(d=>(d.itens||[]).map(m=>({...m,doc:d.id})));
    UIinventario.chave=chave;
  } catch(e) { UIinventario.erro=erroAmigavel(e).message; }
  finally { UIinventario.carregando=false; if(UI.pagina==='inventario')renderizar(true); }
}
function linhasInventario() {
  const linhas=[];
  const adicionar=i=>linhas.push({...i,nome:nomeTecnico(i.tid),desc:E.catalogo[i.mat]||'',localidade:E.cadastro[i.tid]?.localidade||''});
  for(const i of E.usadas) adicionar({...i,tipo:'usadas',estado:'em_estoque',desde:i.desde,saida:'',origem:'atual',situacao:'Com o técnico'});
  for(const n of E.novas) adicionar({...n,tipo:'novas',estado:'em_estoque',saida:'',origem:'atual',situacao:'Com o técnico'});
  for(const d of UIinventario.devolucoes) adicionar({...d,tipo:'usadas',estado:'devolvida',saida:d.em,desde:d.desde,origem:'historico',situacao:'Devolvida · saída da planilha'});
  for(const m of UIinventario.movimentos) adicionar({...m,tipo:'novas',estado:m.destino==='pendente'?'presumida':m.destino==='devolucao'?'devolvida':m.destino,saida:m.em,origem:'historico',situacao:m.destino==='pendente'?'Devolução presumida':DESTINOS_NOVAS[m.destino]||'Saída registrada'});
  return linhas;
}
function filtrarInventario(linhas=linhasInventario()) {
  const f=UIinventario,termos=normBusca(f.busca).split(/\s+/).filter(Boolean);
  return linhas.filter(i=>(!f.tid||i.tid===f.tid)&&(!f.tipo||i.tipo===f.tipo)&&(!f.estado||(f.estado==='devolvidas'?['devolvida','presumida'].includes(i.estado):i.estado===f.estado))&&termos.every(t=>normBusca(`${i.mat} ${i.desc} ${i.nome} ${i.chamado||''} ${i.nf||''}`).includes(t)))
    .sort((a,b)=>comparar(b.saida||'9999',a.saida||'9999')||comparar(a.nome,b.nome)||comparar(a.mat,b.mat));
}
async function exportarInventario() {
  const lista=filtrarInventario();
  await exportarExcel(`historico-inventario-${hojeISO()}.xlsx`,[{nome:'Responsabilidade por peças',colunas:['Técnico','UF','Capital / interior','Tipo','Código','Descrição','Quantidade','Situação','Primeira observação','Saída observada','Data FT','Chamado','NF','Lote'].map((titulo,n)=>({titulo,largura:[0,5].includes(n)?35:23,tipo:n===6?'numero':'texto'})),linhas:lista.map(i=>[i.nome,i.regiao,LOCALIDADES[i.localidade]||LOCALIDADES[''],i.tipo,i.mat,i.desc,i.qtd,i.situacao,i.desde||'',i.saida||'',i.dataFT||'',i.chamado||'',i.nf||'',i.lote||''])}]);
}
