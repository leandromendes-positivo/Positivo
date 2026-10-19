/* Cobertura de férias por UF, usando a mesma geometria do mapa operacional. */
const UImapaFerias={uf:'PR',zoom:1};
function dadosMapaFerias(uf) {
  const agenda=agendaEquipeFerias(),hoje=hojeISO();
  const atuais=agenda.atuais.filter(p=>ufFerias(p.registro.regiao)===uf);
  const proximas=agenda.proximas.filter(p=>ufFerias(p.registro.regiao)===uf);
  return {atuais,proximas,em30:proximas.filter(p=>diffDias(hoje,p.inicio)<=30)};
}
function transformacaoMapaFerias() {
  const [x,y]=MAPA_BRASIL.find(s=>s.uf===UImapaFerias.uf)?.centro||[262.5,262.5],z=UImapaFerias.zoom;
  return z===1?'translate(0px, 0px) scale(1)':`translate(${262.5-x*z}px, ${262.5-y*z}px) scale(${z})`;
}
function renderMapaFerias() {
  const uf=UImapaFerias.uf,dados=new Map(UFS_FERIAS.map(u=>[u,dadosMapaFerias(u)])),selecionado=dados.get(uf);
  const linhas=(lista,atual)=>{
    const item=p=>`<li><strong>${esc(nomeBonito(p.registro.nome))}</strong><span>${atual?`Em férias desde ${fmtData(p.inicio)}`:`Saída ${fmtData(p.inicio)} · em ${diffDias(hojeISO(),p.inicio)} dias`}</span><span>Retorno ${fmtData(retornoFerias(p))} · ${esc(perfilFerias(p.registro))}</span></li>`;
    return lista.length?`<ul>${lista.slice(0,3).map(item).join('')}</ul>${lista.length>3?`<details><summary>Ver mais ${lista.length-3}</summary><ul>${lista.slice(3).map(item).join('')}</ul></details>`:''}`:`<p class="nota">${atual?'Nenhum colaborador de férias nesta UF.':'Nenhuma próxima saída programada nesta UF.'}</p>`;
  };
  const caminhos=[...MAPA_BRASIL].sort((a,b)=>(a.uf===uf)-(b.uf===uf)).map(s=>{
    const d=dados.get(s.uf),classe=!d?'sem-dados':d.atuais.length?'tem-atuais':d.proximas.length?'tem-proximas':'sem-programacao';
    const descricao=d?`${UFS[s.uf]}: ${d.atuais.length} em férias e ${d.proximas.length} próximas saídas`:`${UFS[s.uf]}: fora das UFs acompanhadas`;
    return `<g class="mapa-estado ${classe} ${s.uf===uf?'selecionado':''}" ${d?`role="button" tabindex="0" data-ferias-mapa="uf" data-uf="${s.uf}" aria-pressed="${s.uf===uf}"`:''} aria-label="${esc(descricao)}"><title>${esc(descricao)}</title><path d="${s.d}"/>${d?`<text x="${s.centro[0]}" y="${s.centro[1]}">${s.uf}</text>`:''}${s.uf===uf?`<circle class="mapa-sinal" cx="${s.centro[0]}" cy="${s.centro[1]}" r="13"/>`:''}</g>`;
  }).join('');
  const semUF=new Set(E.ferias.filter(f=>!f.arquivado&&f.status!=='cancelado'&&!ufFerias(f.regiao)).map(f=>f.matricula)).size;
  return `<section class="ferias-mapa-regional" aria-label="Férias por estado"><header><div><h3>Férias por estado</h3><p>Selecione uma UF para acompanhar as ausências e próximas saídas da equipe.</p></div></header><div class="mapa-layout"><div class="mapa-figura"><div class="mapa-cab"><span>BRASIL / FÉRIAS</span><strong>4 UFs</strong></div><svg class="mapa-brasil ferias-mapa-brasil" viewBox="0 0 525 525" role="group" aria-label="Selecione Paraná, Santa Catarina, Tocantins ou Rio Grande do Sul"><defs><pattern id="ferias-mapa-sem-dados" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--mapa-base)"/><path d="M0 5L5 0" stroke="var(--mapa-trama)" stroke-width=".5"/></pattern></defs><g class="mapa-cena" style="transform:${transformacaoMapaFerias()}">${caminhos}</g></svg><div class="mapa-controles" aria-label="Zoom do mapa de férias"><button type="button" data-ferias-mapa="zoom" data-passo="-1" aria-label="Diminuir zoom" ${UImapaFerias.zoom<=1?'disabled':''}>−</button><button type="button" data-ferias-mapa="zoom" data-passo="1" aria-label="Aproximar UF selecionada" ${UImapaFerias.zoom>=2.5?'disabled':''}>+</button><button type="button" data-ferias-mapa="zoom" data-passo="0">Brasil</button></div></div><div class="mapa-detalhe ferias-mapa-detalhe"><span class="mapa-uf">${uf}</span><h3>${esc(UFS[uf])}</h3><div class="mapa-numero">${selecionado.proximas.length}<span>colaboradores com próxima saída</span></div><dl><div><dt>Em férias agora</dt><dd>${selecionado.atuais.length}</dd></div><div><dt>Saídas nos próximos 30 dias</dt><dd>${selecionado.em30.length}</dd></div></dl><section data-mapa-ferias-atuais><h4>Em férias nesta UF</h4>${linhas(selecionado.atuais,true)}</section><section data-mapa-ferias-proximas><h4>Próximos a sair</h4>${linhas(selecionado.proximas,false)}</section><button class="btn pequeno" type="button" data-ferias-mapa="cadastros">Ver colaboradores de ${uf}${icone('direita')}</button></div></div><div class="ferias-mapa-estados" aria-label="Selecionar UF das férias">${UFS_FERIAS.map(u=>`<button type="button" class="btn ${u===uf?'ativo':''}" data-ferias-mapa="uf" data-uf="${u}" aria-pressed="${u===uf}"><strong>${u}</strong><span>${plural(dados.get(u).proximas.length,'próxima saída','próximas saídas')}</span></button>`).join('')}</div><p class="ferias-mapa-legenda"><span class="programadas">● Saídas programadas</span><span class="atuais">● Em férias agora</span><span>● Sem programação</span></p><p class="nota">O mapa considera toda a equipe ativa. Retirados e férias canceladas não entram nas contagens.${semUF?` ${semUF} ${semUF===1?'colaborador está':'colaboradores estão'} sem UF informada; complete o cadastro para localizá-los no mapa.`:''}</p></section>`;
}
function prepararMapaFerias() {
  const raiz=document.querySelector('.ferias-mapa-regional');
  if(!raiz||raiz.dataset.ligado)return;raiz.dataset.ligado='1';
  raiz.addEventListener('keydown',e=>{const alvo=e.target.closest('g[data-ferias-mapa="uf"]');if(alvo&&(e.key==='Enter'||e.key===' ')){e.preventDefault();alvo.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  raiz.addEventListener('click',e=>{
    const b=e.target.closest('[data-ferias-mapa]');if(!b||b.disabled)return;
    if(b.dataset.feriasMapa==='cadastros'){Object.assign(UIcolaboradores,{busca:'',uf:UImapaFerias.uf,area:'',situacao:''});irPara('colaboradores');return;}
    if(b.dataset.feriasMapa==='uf')UImapaFerias.uf=b.dataset.uf;
    if(b.dataset.feriasMapa==='zoom'){const passo=Number(b.dataset.passo);UImapaFerias.zoom=passo===0?1:Math.max(1,Math.min(2.5,UImapaFerias.zoom+passo*.5));}
    const novo=document.createElement('div');novo.innerHTML=renderMapaFerias();raiz.replaceWith(novo.firstElementChild);prepararMapaFerias();
    const seletor=b.dataset.feriasMapa==='uf'?`${b.tagName.toLowerCase()}[data-ferias-mapa="uf"][data-uf="${b.dataset.uf}"]`:`[data-ferias-mapa="zoom"][data-passo="${b.dataset.passo}"]`;
    document.querySelector(`.ferias-mapa-regional ${seletor}`)?.focus({preventScroll:true});
  });
}
