/* Ausências e próximas saídas organizadas por estado, sem mapa geográfico. */
function renderFeriasPorEstado() {
  const agenda=agendaEquipeFerias(),hoje=hojeISO();
  const linhas=(lista,atual)=>{
    const item=p=>`<li><strong>${esc(nomeBonito(p.registro.nome))}</strong><span>${atual?`Desde ${fmtData(p.inicio)}`:`Saída ${fmtData(p.inicio)} · ${diffDias(hoje,p.inicio)===1?'amanhã':`em ${diffDias(hoje,p.inicio)} dias`}`}</span><span>Retorno ${fmtData(retornoFerias(p))} · ${esc(perfilFerias(p.registro))}</span></li>`;
    return lista.length?`<ul>${lista.slice(0,3).map(item).join('')}</ul>${lista.length>3?`<details><summary>Ver mais ${lista.length-3}</summary><ul>${lista.slice(3).map(item).join('')}</ul></details>`:''}`:`<p class="nota">${atual?'Nenhum colaborador de férias.':'Nenhuma próxima saída programada.'}</p>`;
  };
  const semUF=new Set(E.ferias.filter(f=>!f.arquivado&&f.status!=='cancelado'&&!ufFerias(f.regiao)).map(f=>f.matricula)).size;
  return `<section class="ferias-por-estado" aria-label="Férias por estado"><header><h3>Férias por estado</h3><p>Acompanhe a equipe e as próximas saídas de cada UF.</p></header><div class="ferias-estados-grade">${UFS_FERIAS.map(uf=>{
    const atuais=agenda.atuais.filter(p=>ufFerias(p.registro.regiao)===uf),proximas=agenda.proximas.filter(p=>ufFerias(p.registro.regiao)===uf),em30=proximas.filter(p=>diffDias(hoje,p.inicio)<=30);
    return `<article class="ferias-estado" data-ferias-estado="${uf}"><header><span class="ferias-estado-sigla">${uf}</span><h4>${esc(UFS[uf])}</h4></header><dl class="ferias-estado-numeros"><div><dt>Em férias agora</dt><dd>${atuais.length}</dd></div><div><dt>Saídas em 30 dias</dt><dd>${em30.length}</dd></div><div><dt>Próximas saídas</dt><dd>${proximas.length}</dd></div></dl><section data-estado-ferias-atuais><h5>Em férias nesta UF</h5>${linhas(atuais,true)}</section><section data-estado-ferias-proximas><h5>Próximos a sair</h5>${linhas(proximas,false)}</section><footer><button type="button" class="btn pequeno" data-ferias-estado-cadastros="${uf}">Ver colaboradores de ${uf}${icone('direita')}</button></footer></article>`;
  }).join('')}</div><p class="nota">Os quadros consideram toda a equipe ativa. Retirados e férias canceladas não entram nas contagens.${semUF?` ${semUF} ${semUF===1?'colaborador está':'colaboradores estão'} sem UF informada; complete o cadastro para incluí-los na organização por estado.`:''}</p></section>`;
}
function prepararFeriasPorEstado() {
  const raiz=document.querySelector('.ferias-por-estado');if(!raiz||raiz.dataset.ligado)return;raiz.dataset.ligado='1';
  raiz.addEventListener('click',e=>{const b=e.target.closest('[data-ferias-estado-cadastros]');if(!b)return;Object.assign(UIcolaboradores,{busca:'',uf:b.dataset.feriasEstadoCadastros,area:'',situacao:''});irPara('colaboradores');});
}
