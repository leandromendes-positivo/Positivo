/* Apenas a visão operacional é filtrada. Documentos antigos não são apagados. */
const EscopoOperacao={tidsEncerrados:new Set()};
function tecnicoComDadosAtivos(tid){
  return [E.usadas,E.novas,E.rmdf].some(lista=>(lista||[]).some(p=>p.tid===tid&&!regiaoDesativada(p.regiao)));
}
function tecnicoEncerrado(tid){return !!tid&&EscopoOperacao.tidsEncerrados.has(tid)&&!tecnicoComDadosAtivos(tid);}
function documentoOperacional(caminho,d){
  if(!d)return d;
  const [colecao,id]=caminho.split('/');
  if(regiaoDesativada(d.regiao)||regiaoDesativada(d.uf)||regiaoDesativada(d.confirmacao?.regiao)
    || ((colecao!=='usuarios'||d.perfil==='tecnico')&&regiaoDesativada(d.tecnicoId)))return null;
  if(tecnicoEncerrado(d.tid)||(colecao==='acompanhamento'&&tecnicoEncerrado(id)))return null;
  if(caminho==='cadastro/tecnicos'){
    for(const [tid,c] of Object.entries(d.t||{}))if(regiaoDesativada(c.regiao))EscopoOperacao.tidsEncerrados.add(tid);
    return d;
  }
  if(caminho==='dados/indice'){
    const ativos=mapa=>Object.fromEntries(Object.entries(mapa||{}).filter(([chave])=>!regiaoDesativada(chave.split(':')[1])));
    return {...d,arquivos:ativos(d.arquivos),anterior:ativos(d.anterior)};
  }
  if(colecao==='dados'&&/^[unr]-/i.test(id)&&regiaoDesativada(id.slice(2)))return null;
  if(colecao==='devolucoes')return {...d,itens:(d.itens||[]).filter(l=>!regiaoDesativada(l[8]))};
  if(colecao==='movimentos')return {...d,itens:(d.itens||[]).filter(m=>!regiaoDesativada(m.regiao))};
  if(colecao==='importacoes'){
    const arquivos=(d.arquivos||[]).filter(a=>!regiaoDesativada(a.regiao));
    const chaves=(d.chaves||[]).filter(c=>!regiaoDesativada(c.split(':')[1]));
    const parcial=arquivos.length!==(d.arquivos||[]).length||chaves.length!==(d.chaves||[]).length;
    if(parcial&&!arquivos.length&&!chaves.length)return null;
    return {...d,arquivos,chaves,avisos:(d.avisos||[]).filter(a=>!/(?:\bTO\b|Tocantins)/i.test(a)),escopoParcial:d.escopoParcial||parcial,...(parcial?{devolvidas:arquivos.filter(a=>a.tipo==='usadas').reduce((s,a)=>s+(a.saidasQtd||0),0)}:{})};
  }
  // Totais antigos não possuem separação por UF: não apresenta um agregado misto como se fosse apenas da operação atual.
  if(colecao==='historico'&&d.escopoParcial&&d.tot?.usadas==null)return null;
  if(colecao==='historico'&&((d.regioes||[]).some(regiaoDesativada)||(!d.regioes&&Object.keys(d.t||{}).some(tid=>EscopoOperacao.tidsEncerrados.has(tid)))))return null;
  return d;
}
function documentosOperacionais(colecao,docs){return docs.map(d=>documentoOperacional(`${colecao}/${d.id}`,d)).filter(Boolean);}
function aplicarEscopoOperacao(){
  for(const [tid,c] of Object.entries(E.cadastro||{}))if(regiaoDesativada(c.regiao))EscopoOperacao.tidsEncerrados.add(tid);
  for(const campo of ['usadas','novas','rmdf','devolucoes','movimentos','ferias','usuarios','agendamentos','contatos','anotacoes']){
    E[campo]=(E[campo]||[]).filter(d=>!regiaoDesativada(d.regiao)&&!regiaoDesativada(d.uf)&&!regiaoDesativada(d.tecnicoId)&&!regiaoDesativada(d.confirmacao?.regiao));
  }
  const regioesPorTecnico=new Map();
  for(const p of [...E.usadas,...E.novas,...E.rmdf])if(!regioesPorTecnico.has(p.tid))regioesPorTecnico.set(p.tid,p.regiao);
  E.cadastro=Object.fromEntries(Object.entries(E.cadastro||{}).flatMap(([tid,c])=>{
    if(!regiaoDesativada(c.regiao))return [[tid,c]];
    return regioesPorTecnico.has(tid)?[[tid,{...c,regiao:regioesPorTecnico.get(tid)}]]:[];
  }));
  for(const campo of ['acomp','acompLegado'])E[campo]=Object.fromEntries(Object.entries(E[campo]||{}).filter(([tid])=>!tecnicoEncerrado(tid)).map(([tid,d])=>[tid,{...d,...(d.cobrancas?{cobrancas:d.cobrancas.filter(c=>!regiaoDesativada(c.regiao))}:{})}]));
  for(const campo of ['agendamentos','contatos','anotacoes'])E[campo]=E[campo].filter(d=>!tecnicoEncerrado(d.tid));
  E.indice=documentoOperacional('dados/indice',E.indice);
  E.importacoes=documentosOperacionais('importacoes',E.importacoes||[]);
  E.historico=documentosOperacionais('historico',E.historico||[]);
}
