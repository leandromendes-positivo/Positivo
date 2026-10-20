/** Períodos encerrados, sem versões de edição, duplicações ou férias canceladas. */
function periodosConcluidosFerias(registros,hoje=hojeISO()) {
  const unicos=new Map();
  for(const f of registros){
    if(!['planejado','confirmado'].includes(f.status))continue;
    const limite=f.excluidoEm&&f.excluidoEm<hoje?f.excluidoEm:hoje;
    for(const p of f.periodos||[]){
      if(!dataFeriasValida(p.inicio)||!dataFeriasValida(p.fim)||p.fim<p.inicio||!dataFeriasValida(retornoFerias(p))||retornoFerias(p)<=p.fim||retornoFerias(p)>limite)continue;
      const chave=[f.matricula,p.inicio,p.fim].join('|');
      if(!unicos.has(chave))unicos.set(chave,{...p,ciclo:f.ciclo,regiao:f.regiao,vendidos:f.vendidos||0,dias:diasFerias(p)});
    }
  }
  return [...unicos.values()].sort((a,b)=>comparar(b.inicio,a.inicio)||comparar(b.fim,a.fim));
}
async function abrirHistoricoFerias(id) {
  const conferir=()=>{if(Acesso.modo==='firebase'&&(!Acesso.perfil?.ativo||!['usuario','administrador'].includes(Acesso.perfil.perfil)))throw new Error('Seu acesso não permite consultar as férias da equipe.');};
  conferir();const uid=Acesso.usuario?.uid;
  let cadastro=E.ferias.find(f=>f.id===id);
  if(!cadastro){const anteriores=await Armazem.consultar('historico_ferias',{onde:[['id','==',id]]});cadastro=anteriores.sort((a,b)=>b.versao-a.versao)[0];}
  if(!cadastro)throw new Error('Colaborador não encontrado. Atualize a lista.');
  const docs=await Armazem.consultar('historico_ferias',{onde:[['matricula','==',cadastro.matricula]]});
  const atuais=E.ferias.filter(f=>f.matricula===cadastro.matricula),estados=new Map();
  for(const d of docs.sort((a,b)=>b.versao-a.versao))if(!estados.has(d.id))estados.set(d.id,d);
  for(const f of atuais)estados.set(f.id,f);
  for(const [chave,f] of estados)if(!atuais.some(a=>a.id===chave)&&f.evento){
    const exclusao=await Armazem.ler(`exclusoes_ferias/${f.evento}`);
    if(exclusao?.em)estados.set(chave,{...f,excluidoEm:String(exclusao.em).slice(0,10)});
  }
  conferir();if(Acesso.usuario?.uid!==uid)return;
  const periodos=periodosConcluidosFerias([...estados.values()]);
  return abrirModal({titulo:'Histórico de férias',subtitulo:`${nomeBonito(cadastro.nome)} · Matrícula ${cadastro.matricula}`,largura:'larga historico-ferias-modal',
    corpo:periodos.length?`<div class="ferias-historico"><p class="ferias-historico-resumo">${periodos.length} ${periodos.length===1?'período concluído':'períodos concluídos'} · ${periodos.reduce((s,p)=>s+p.dias,0)} dias de descanso · Mais recentes primeiro</p><ol>${periodos.map(p=>`<li class="ferias-historico-evento"><header><div><h3>${esc(fmtData(p.inicio))} a ${esc(fmtData(p.fim))}</h3><p>Ciclo ${esc(p.ciclo)} · ${esc(ufFerias(p.regiao)||'UF não informada')}</p></div>${pill('ok',p.dias+' dias')}</header><dl class="ferias-historico-ficha"><div><dt>Saída</dt><dd>${esc(fmtData(p.inicio))}</dd></div><div><dt>Último dia de férias</dt><dd>${esc(fmtData(p.fim))}</dd></div><div><dt>Retorno</dt><dd>${esc(fmtData(retornoFerias(p)))}${p.retorno?' · ajustado':''}</dd></div><div><dt>Dias de descanso</dt><dd>${p.dias}</dd></div><div><dt>Dias vendidos no ciclo</dt><dd>${p.vendidos}</dd></div></dl></li>`).join('')}</ol></div>`:vazio('calendario','Nenhum período de férias concluído','O histórico considera as datas cadastradas. Programações futuras e férias canceladas não aparecem aqui.'),
    rodape:'<button class="btn" data-fechar>Fechar histórico</button>'});
}
