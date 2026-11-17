/* Exclusão da relação ativa preserva identificação, peças e histórico. */
function tecnicoExcluido(tid){return E.cadastro[tid]?.excluido===true;}
function usuarioDoTecnico(u,tid){return u.perfil==='tecnico'&&/^(PR|SC|RS)--/.test(u.tecnicoId||'')&&u.tecnicoId.slice(4)===tid;}
async function alterarExclusaoTecnico(tid,excluido,assinaturaEsperada=assinaturaRegistroImportacao(E.cadastro[tid])){
  exigirAdministrador();
  if(typeof excluido!=='boolean'||!E.cadastro[tid])throw new Error('Cadastro do técnico não encontrado.');
  const usuarios=excluido?await Armazem.consultar('usuarios'):[],vinculados=usuarios.filter(u=>usuarioDoTecnico(u,tid)&&u.ativo),por=identidadeAtual(),em=agoraISO();
  const atualizar=doc=>{
    const atual=doc?.t?.[tid];if(!atual)throw new Error('Este cadastro mudou. Recarregue a relação.');
    if(assinaturaRegistroImportacao(atual)!==assinaturaEsperada)throw new Error('O cadastro foi editado em outra sessão. Confira os dados antes de continuar.');
    return {...atual,excluido,...(excluido?{excluidoEm:em,excluidoPor:por}:{reativadoEm:em,reativadoPor:por})};
  };
  let cadastro,desativados=[];
  if(Acesso.modo==='firebase'){
    const ref=Acesso.fs.doc('cadastro/tecnicos'),refs=vinculados.map(u=>Acesso.fs.doc(`usuarios/${u.id}`));
    const resultado=await Acesso.fs.runTransaction(async tx=>{
      const [snap,...perfis]=await Promise.all([tx.get(ref),...refs.map(r=>tx.get(r))]);
      cadastro=atualizar(decodificarFS(snap.data()));
      const ids=[];
      perfis.forEach((p,n)=>{const u=p.data();if(!u||!u.ativo||!usuarioDoTecnico(u,tid))return;if(u.principal)throw new Error('O acesso principal é protegido.');ids.push(vinculados[n].id);});
      tx.set(ref,{...snap.data(),t:{...snap.data().t,[tid]:cadastro}});
      perfis.forEach((p,n)=>{if(ids.includes(vinculados[n].id))tx.update(refs[n],{ativo:false,atualizadoPor:por,atualizadoEm:carimboServidor()});});
      return {cadastro,desativados:ids};
    });
    ({cadastro,desativados}=resultado);
  }else{
    const doc=await Armazem.ler('cadastro/tecnicos');cadastro=atualizar(doc);
    if(vinculados.some(u=>u.principal))throw new Error('O acesso principal é protegido.');
    await Armazem.gravar('cadastro/tecnicos',{...doc,t:{...doc.t,[tid]:cadastro}});
    for(const u of vinculados){await Armazem.mesclar(`usuarios/${u.id}`,{ativo:false,atualizadoPor:por,atualizadoEm:em},true);desativados.push(u.id);}
  }
  E.cadastro={...E.cadastro,[tid]:cadastro};E.usuarios=E.usuarios.map(u=>desativados.includes(u.id)?{...u,ativo:false,atualizadoEm:em}:u);mudou();
  return {acessosDesativados:desativados.length};
}
async function modalExcluirTecnico(tid,reativar=false){
  exigirAdministrador();const c=E.cadastro[tid];if(!c)return;
  const quantidade=somar([...E.usadas,...E.novas,...E.rmdf].filter(i=>i.tid===tid),i=>i.qtd),assinatura=assinaturaRegistroImportacao(c);
  const ok=await confirmar({titulo:reativar?'Reativar técnico na relação?':'Excluir técnico da relação?',
    texto:reativar?`${nomeTecnico(tid)} voltará aos cadastros ativos. Se precisar liberar o login novamente, reative também o usuário em Cadastro de usuários.`:`${nomeTecnico(tid)} sairá da relação ativa e os acessos técnicos vinculados serão desativados. O nome e o histórico serão preservados.${quantidade?` As ${plural(quantidade,'peça','peças')} que ainda estão com ele continuam no estoque e no acompanhamento de devoluções.`:''}`,
    ok:reativar?'Reativar técnico':'Excluir da relação',perigo:!reativar});
  if(!ok)return;
  const r=await alterarExclusaoTecnico(tid,!reativar,assinatura);UI.tid=null;UI.tc.situacao=reativar?'excluidos':'ativos';
  toast(reativar?'Técnico reativado.':`Técnico excluído da relação ativa.${r.acessosDesativados?` ${plural(r.acessosDesativados,'acesso desativado','acessos desativados')}.`:''}`);renderizar(true);
}
