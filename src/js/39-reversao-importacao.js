/* Planejamento puro da reversão. Usado no painel e na recuperação administrativa. */
function validarReversaoImportacao(imp, indice) {
  if(!imp?.id||imp.desfeito)throw new Error('Esta importação já foi desfeita ou não está disponível.');
  const chaves=imp.chaves||[];
  if(!chaves.length||new Set(chaves).size!==chaves.length)throw new Error('A importação não tem uma lista válida de planilhas.');
  if(imp.escopoParcial||chaves.some(c=>! /^(novas|usadas|rmdf):(PR|SC|RS)$/.test(c)))throw new Error('A importação contém uma UF fora da operação e não pode ser desfeita.');
  for(const chave of chaves){
    if(indice.arquivos?.[chave]?.lote!==imp.id)throw new Error('Outra importação já atualizou estas planilhas. Recarregue o histórico antes de desfazer.');
    if(indice.reversivel?.[chave]===false||!Object.hasOwn(indice.anterior||{},chave))throw new Error('A versão anterior desta importação não está mais disponível.');
  }
  return chaves;
}
function assinaturaRegistroImportacao(v) {
  const ordenar=x=>Array.isArray(x)?x.map(ordenar):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordenar(x[k])])):x;
  return JSON.stringify(ordenar(v));
}
function cadastroLegadoIntocado(c, imp) {
  const permitidos=['chave','nome','apelido','regiao','tipo','meta','telefone','email','obs','criadoEm'];
  return c?.criadoEm===imp.em&&Object.keys(c).every(k=>permitidos.includes(k))&&['apelido','telefone','email','obs'].every(k=>!String(c[k]||'').trim())&&(c.meta==null)&&c.tipo==='tecnico';
}
function planejarLimpezaImportacao(imp, {cadastro, catalogo, fotos, registros=[], usuarios=[]}) {
  const protegidos=new Set(registros.filter(r=>r.lote!==imp.id).map(r=>r.tid).filter(Boolean));
  for(const lista of Object.values(fotos))for(const i of lista)protegidos.add(i.tid);
  for(const u of usuarios)if(u.perfil==='tecnico'&&u.tecnicoId){const [, ...tid]=u.tecnicoId.split('--');protegidos.add(tid.join('--'));}
  const novos={...cadastro},materiais={...catalogo},removidos=[],restaurados=[],preservados=[];
  const antes=imp.cadastroAntes||{},gravados=imp.cadastroImportado||{};
  const candidatos=new Set([...Object.keys(antes),...Object.entries(cadastro).filter(([,c])=>cadastroLegadoIntocado(c,imp)).map(([tid])=>tid)]);
  for(const tid of candidatos){
    const atual=cadastro[tid];if(!atual)continue;
    const documentado=Object.hasOwn(antes,tid),intocado=documentado?assinaturaRegistroImportacao(atual)===assinaturaRegistroImportacao(gravados[tid]):cadastroLegadoIntocado(atual,imp);
    if(!intocado||(protegidos.has(tid)&&(!documentado||antes[tid]===null))){preservados.push(tid);continue;}
    if(documentado&&antes[tid]!==null){novos[tid]=structuredClone(antes[tid]);restaurados.push(tid);}
    else{delete novos[tid];removidos.push(tid);}
  }
  const materiaisProtegidos=new Set([...Object.values(fotos).flat(),...registros.filter(r=>r.lote!==imp.id)].map(i=>String(i.mat)));
  for(const [mat,valor] of Object.entries(imp.catalogoAntes||{})){
    if(catalogo[mat]!==imp.catalogoImportado?.[mat])continue;
    if(valor===null){if(!materiaisProtegidos.has(mat))delete materiais[mat];}
    else materiais[mat]=valor;
  }
  return {cadastro:novos,catalogo:materiais,removidos,restaurados,preservados};
}
