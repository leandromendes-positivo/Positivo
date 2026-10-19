/* Gestão de pessoas e férias. Cadastro direto, sem dependência de planilhas. */
const UIferias = { busca: '', uf: '', ano: '', situacao: '', mes: '', arquivados: false };
function dataFeriasValida(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && somaDias(d, 0) === d && d >= '2000-01-01' && d <= '2100-12-31'; }
function ufFerias(r) { return String(r || '').trim().toUpperCase().match(/^[A-Z]{2}\b/)?.[0] || ''; }
function diasFerias(p) { return diffDias(p.inicio, p.fim) + 1; }
function retornoFerias(p) { return p.retorno || somaDias(p.fim, 1); }
function periodosFerias(lista = E.ferias) { return lista.filter(f => !f.arquivado && f.status !== 'cancelado').flatMap(f => f.periodos.map((p, indice) => ({ ...p, registro: f, indice }))); }
function conflitosFerias(f, lista = E.ferias) {
  if (f.arquivado || f.status === 'cancelado') return [];
  return periodosFerias(lista).filter(p => p.registro.id !== f.id && p.registro.matricula !== f.matricula && ufFerias(f.regiao) && ufFerias(f.regiao) === ufFerias(p.registro.regiao) && f.periodos.some(q => q.inicio <= p.fim && p.inicio <= q.fim));
}
function situacaoFerias(f, hoje = hojeISO()) {
  if (f.arquivado) return 'Fora da lista';
  if (f.status === 'cancelado') return 'Cancelado';
  if (!f.periodos.length) return 'Sem programação';
  if (f.periodos.some(p => p.inicio <= hoje && retornoFerias(p) > hoje)) return 'Em férias';
  return f.periodos.every(p => retornoFerias(p) <= hoje) ? 'Concluído' : 'Programado';
}
function validarFerias(f) {
  for (const [chave, limite] of [['nome',120],['matricula',40],['ciclo',40]]) if (!String(f[chave] || '').trim() || f[chave].length > limite) throw new Error('Informe nome, matrícula e ciclo de referência válidos.');
  if (!/^[A-Za-z0-9_-]+$/.test(f.matricula)) throw new Error('Use apenas letras, números, hífen ou sublinhado na matrícula.');
  if (f.regiao.length > 40 || f.obs.length > 1000 || !['planejado','confirmado','cancelado'].includes(f.status)) throw new Error('Revise região, situação e observações.');
  if (!Number.isInteger(f.direito) || f.direito < 1 || f.direito > 60 || !Number.isInteger(f.vendidos) || f.vendidos < 0 || f.vendidos > 20) throw new Error('Revise o direito em dias e os dias vendidos.');
  if (!Array.isArray(f.periodos) || f.periodos.length > 3) throw new Error('Informe até três períodos.');
  f.periodos.forEach((p,i) => {
    if (!dataFeriasValida(p.inicio) || !dataFeriasValida(p.fim) || p.fim < p.inicio || diasFerias(p) > 60) throw new Error(`Revise as datas do ${i+1}º período (até 60 dias).`);
    if (p.retorno && (!dataFeriasValida(p.retorno) || p.retorno <= p.fim)) throw new Error('O retorno deve ser posterior ao fim das férias.');
    if (f.periodos.some((q,j) => j < i && p.inicio <= q.fim && q.inicio <= p.fim)) throw new Error('Os períodos da mesma pessoa não podem se sobrepor.');
  });
  if (f.periodos.reduce((s,p) => s + diasFerias(p),0) + f.vendidos > f.direito) throw new Error('A soma das férias com os dias vendidos ultrapassa o direito informado.');
  return f;
}
async function salvarFerias(f, versao = 0) {
  exigirAdministrador(); validarFerias(f);
  if (E.ferias.some(x => x.id !== f.id && x.matricula === f.matricula && normBusca(x.ciclo) === normBusca(f.ciclo))) throw new Error("Já existe um planejamento para esta matrícula e ciclo. Edite o cadastro existente.");
  const id = f.id || crypto.randomUUID(), caminho = `ferias/${id}`;
  const criar = anterior => {
    if ((anterior?.versao || 0) !== versao) throw new Error('Este planejamento mudou em outra sessão. Reabra o cadastro para não perder alterações.');
    return { ...f, id, evento: crypto.randomUUID(), versao: versao + 1, atualizadoPor: identidadeAtual(), atualizadoEm: carimboServidor() };
  };
  if (Acesso.modo === 'firebase') await Acesso.fs.runTransaction(async tx => {
    const ref = Acesso.fs.doc(caminho), snap = await tx.get(ref), d = criar(snap.exists ? snap.data() : null);
    tx.set(ref,d); tx.set(Acesso.fs.doc(`historico_ferias/${d.evento}`),d);
  });
  else {
    const d = criar(await Armazem.ler(caminho));
    await Armazem.gravar(caminho,d); await Armazem.gravar(`historico_ferias/${d.evento}`,d);
  }
  E.ferias = await Armazem.consultar('ferias'); mudou();
}
function listaFeriasFiltrada() {
  return E.ferias.filter(f => (UIferias.arquivados ? f.arquivado : !f.arquivado) && (!UIferias.mes || f.periodos.some(p => p.inicio <= fimMesFerias(UIferias.ano, UIferias.mes) && p.fim >= `${UIferias.ano}-${UIferias.mes}-01`)) && (!UIferias.busca || normBusca(`${f.nome} ${f.matricula}`).includes(normBusca(UIferias.busca))) && (!UIferias.uf || (UIferias.uf === '?' ? !ufFerias(f.regiao) : ufFerias(f.regiao) === UIferias.uf)) && (!UIferias.ano || f.periodos.some(p => p.inicio <= `${UIferias.ano}-12-31` && p.fim >= `${UIferias.ano}-01-01`)) && (!UIferias.situacao || (UIferias.situacao === 'conflito' ? conflitosFerias(f).length : situacaoFerias(f) === UIferias.situacao)))
    .sort((a,b) => comparar(a.periodos[0]?.inicio || '9999',b.periodos[0]?.inicio || '9999') || comparar(a.nome,b.nome));
}
function renderFerias() {
  const lista = listaFeriasFiltrada(), ps = periodosFerias(), hoje = hojeISO(), ativos = E.ferias.filter(f=>!f.arquivado);
  const anos = [...new Set(E.ferias.flatMap(f => f.periodos.flatMap(p => Array.from({length:Number(p.fim.slice(0,4))-Number(p.inicio.slice(0,4))+1},(_,i)=>Number(p.inicio.slice(0,4))+i))))].sort();
  const opcoes = (valores, atual) => valores.map(([v,n]) => `<option value="${esc(v)}" ${String(atual)===String(v)?'selected':''}>${esc(n)}</option>`).join('');
  return `<section class="ferias"><div class="ferias-abertura"><div><span class="ferias-eyebrow">PESSOAS & DESCANSO</span><h2>Tempo para recarregar.<br><em>Equipe para planejar.</em></h2><p>Uma visão das pessoas, dos dias de descanso e da cobertura de cada região.</p><div class="ferias-acoes">${podeAdministrar()?'<button class="btn prim" data-ferias="novo">'+icone('mais')+' Adicionar colaborador</button>':''}<button class="btn" data-ferias="arquivados">${UIferias.arquivados?'Ver equipe ativa':'Colaboradores retirados'}</button></div></div><div class="ferias-hero-ilustracao" aria-hidden="true"><div class="ferias-sol"></div><div class="ferias-arco"></div><div class="ferias-onda"></div><span>PAUSA<br>PLANEJADA.</span></div></div>
  ${Acesso.modo !== 'firebase'?'<p class="aviso">Demonstração: alterações ficam somente nesta página.</p>':''}
  ${cargaFeriasInicial.erro?`<div class="ferias-conflito" role="alert">${esc(cargaFeriasInicial.erro)} <button class="btn" data-ferias="carga">Tentar carregar colaboradores</button></div>`:''}
  <div class="ferias-kpis">${[['Equipe cadastrada',new Set(ativos.map(f=>f.matricula)).size,'pessoas no planejamento'],['Em descanso agora',new Set(ps.filter(p=>p.inicio<=hoje && retornoFerias(p)>hoje).map(p=>p.registro.matricula)).size,'com retorno acompanhado'],['Saídas em 30 dias',ps.filter(p=>p.inicio>hoje && p.inicio<=somaDias(hoje,30)).length,'próximos períodos'],['Atenção à cobertura',ativos.filter(f=>conflitosFerias(f).length).length,'cadastros com coincidências']].map(([t,n,sub],i)=>`<div><span class="ferias-kpi-num">0${i+1}</span><strong>${n}</strong><span>${t}</span><small>${sub}</small></div>`).join('')}</div>
  ${mapaAnualFerias()}
  <div class="ferias-secao-titulo"><div><span class="ferias-eyebrow">${UIferias.arquivados?'ARQUIVO':'NOSSA EQUIPE'}</span><h3>${UIferias.arquivados?'Colaboradores retirados':'Cada pessoa, seu tempo.'}</h3></div><span>${lista.length} cadastros neste recorte</span></div>
  <form class="ferias-filtros"><label class="campo"><span>Colaborador ou matrícula</span><input name="busca" value="${esc(UIferias.busca)}" type="search"></label><label class="campo"><span>Ano dos períodos</span><select name="ano">${opcoes([['','Todos'],...anos.map(a=>[a,a])],UIferias.ano)}</select></label><label class="campo"><span>UF</span><select name="uf">${opcoes([['','Todas'],...([...new Set(E.ferias.map(f=>ufFerias(f.regiao)).filter(Boolean))].sort().map(x=>[x,x])),['?','Sem região']],UIferias.uf)}</select></label><label class="campo"><span>Situação</span><select name="situacao">${opcoes([['','Todas'],...['Sem programação','Programado','Em férias','Concluído','Cancelado'].map(x=>[x,x]),['conflito','Com conflito']],UIferias.situacao)}</select></label><button class="btn" type="submit">Aplicar filtros</button><button class="btn" type="button" data-ferias="limpar">Limpar</button></form>
  <p class="nota">${lista.length} de ${E.ferias.length} cadastros.${UIferias.mes?` Mês selecionado: ${UIferias.mes}/${UIferias.ano}.`:""} Dias corridos, incluindo início e fim. Retorno padrão no dia seguinte, ajustável à escala. Conflitos consideram períodos simultâneos na mesma UF, inclusive capital e interior; são alertas de cobertura, sem bloquear a programação. O cálculo considera toda a equipe, mesmo fora dos filtros.</p>
  <div class="ferias-lista">${lista.map(f=>{
    const conflitos=conflitosFerias(f), total=f.periodos.reduce((s,p)=>s+diasFerias(p),0), saldo=f.direito-total-f.vendidos;
    return `<article class="ferias-card ${conflitos.length?'tem-conflito':''}"><header><span class="ferias-avatar" aria-hidden="true">${esc(f.nome.split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join(''))}</span><div><h3>${esc(f.nome)}</h3><p>Matrícula ${esc(f.matricula)} · ${esc(f.regiao || 'Região não informada')} · Ciclo ${esc(f.ciclo)}</p></div>${pill(conflitos.length?'alerta':situacaoFerias(f)==='Em férias'?'info':'neutro',situacaoFerias(f))}</header><div class="ferias-periodos">${f.periodos.map((p,i)=>`<div><strong>${i+1}º período · ${diasFerias(p)} dias</strong><span>${fmtData(p.inicio)} a ${fmtData(p.fim)}</span><span>Retorno: <b>${fmtData(retornoFerias(p))}</b>${p.retorno?' · ajustado':''}</span></div>`).join('')}</div><p><b>${total} dias programados</b> · ${f.vendidos} vendidos · ${saldo} a programar de ${f.direito} dias · ${f.status==='confirmado'?'Confirmado':f.status==='cancelado'?'Cancelado':'Planejamento'}</p>
    ${conflitos.length?`<p class="ferias-conflito">${icone('alerta')} Coincide com ${[...new Set(conflitos.map(p=>`${p.registro.nome} (${fmtData(p.inicio)} a ${fmtData(p.fim)})`))].map(esc).join('; ')}.</p>`:''}${!ufFerias(f.regiao)?'<p class="ferias-conflito">Informe a região para verificar conflitos de cobertura.</p>':''}${f.obs?`<p class="ferias-observacao">${esc(f.obs)}</p>`:''}<footer>${podeAdministrar()?`<button class="btn pequeno" data-ferias="editar" data-id="${esc(f.id)}">Editar colaborador</button><button class="btn pequeno" data-ferias="retirar" data-id="${esc(f.id)}">${f.arquivado?'Reativar na lista':'Retirar da lista'}</button>`:''}<button class="btn pequeno" data-ferias="historico" data-id="${esc(f.id)}">Histórico</button></footer></article>`;
  }).join('') || vazio('calendario','Nenhum planejamento encontrado',E.ferias.length?'Revise os filtros para consultar a equipe.':'Adicione um colaborador diretamente por aqui.')}</div></section>`;
}
function prepararTelaFerias() {
  const raiz=document.querySelector('.ferias');
  raiz.querySelector('form').addEventListener('submit',e=>{e.preventDefault();Object.assign(UIferias,Object.fromEntries(new FormData(e.target)));renderizar(true);});
  raiz.addEventListener('click',e=>{
    const b=e.target.closest('[data-ferias]'); if(!b)return;
    Promise.resolve().then(async()=>{
      if(b.dataset.ferias==='novo')modalFerias();
      if(b.dataset.ferias==='editar')modalFerias(E.ferias.find(f=>f.id===b.dataset.id));
      if(b.dataset.ferias==='limpar'){Object.assign(UIferias,{busca:'',uf:'',ano:'',situacao:'',mes:''});renderizar(true);}
      if(b.dataset.ferias==='arquivados'){UIferias.arquivados=!UIferias.arquivados;renderizar(true);}
      if(b.dataset.ferias==='carga')await carregarEquipeInicialFerias();
      if(b.dataset.ferias==='mes'){UIferias.mes=UIferias.mes===b.dataset.mes?'':b.dataset.mes;UIferias.ano=b.dataset.ano;renderizar(true);}
      if(b.dataset.ferias==='ano'){UIferias.ano=String(Number(b.dataset.ano)+Number(b.dataset.passo));UIferias.mes='';renderizar(true);}
      if(b.dataset.ferias==='retirar'){
        exigirAdministrador();const f=E.ferias.find(f=>f.id===b.dataset.id);
        if(await confirmar({titulo:f.arquivado?'Reativar colaborador?':'Retirar colaborador da lista?',texto:f.arquivado?`${f.nome} voltará para a lista e para os alertas de cobertura.`:`${f.nome} sairá da lista ativa e dos alertas. Datas e histórico serão preservados.`,ok:f.arquivado?'Reativar':'Retirar da lista'}))await salvarFerias({...f,arquivado:!f.arquivado},f.versao);
      }
      if(b.dataset.ferias==='historico'){
        const docs=await Armazem.consultar('historico_ferias',{onde:[['id','==',b.dataset.id]]});
        docs.sort((a,b)=>b.versao-a.versao);
        abrirModal({titulo:'Histórico de férias',corpo:`<ol class="linha-tempo">${docs.map(d=>`<li><div><strong>Versão ${d.versao} · ${esc(d.atualizadoPor.email || 'Demonstração')}</strong><p>${fmtDataHora(d.atualizadoEm)} · ${esc(d.status)} · ${esc(d.nome)} · ${esc(d.regiao)} · ciclo ${esc(d.ciclo)}</p><p>${d.periodos.map(p=>`${fmtData(p.inicio)} a ${fmtData(p.fim)} · retorno ${fmtData(retornoFerias(p))}`).join('<br>')}</p><p>${d.vendidos} dias vendidos · direito ${d.direito}${d.obs?` · ${esc(d.obs)}`:''}</p></div></li>`).join('') || '<li>Sem alterações registradas.</li>'}</ol>`});
      }
    }).catch(e=>toast(e.message,'erro'));
  });

}
function modalFerias(atual) {
  exigirAdministrador();
  const f=atual || {nome:'',matricula:'',regiao:'',ciclo:String(new Date().getFullYear()),status:'planejado',direito:30,vendidos:0,obs:'',periodos:[]};
  const campo=(nome,titulo,tipo='text',valor=f[nome]??'',extra='')=>`<label class="campo"><span>${titulo}</span><input name="${nome}" type="${tipo}" value="${esc(valor)}" ${extra}></label>`;
  const m=abrirModal({administrativo:true,titulo:atual?'Editar colaborador e férias':'Adicionar colaborador',largura:'larga',corpo:`<form class="form ferias-form">${campo('nome','Nome do colaborador','text',f.nome,'required maxlength="120" list="ferias-tecnicos"')}<datalist id="ferias-tecnicos">${Object.values(E.cadastro).map(t=>`<option value="${esc(t.nome)}">${esc(t.regiao)}</option>`).join('')}</datalist><div class="ferias-campos">${campo('matricula','Matrícula','text',f.matricula,'required maxlength="40"')}${campo('regiao','Região (UF e localidade)','text',f.regiao,'maxlength="40"')}${campo('ciclo','Ciclo de referência','text',f.ciclo,'required maxlength="40"')}${campo('direito','Direito em dias','number',f.direito,'required min="1" max="60"')}${campo('vendidos','Dias vendidos','number',f.vendidos,'required min="0" max="20"')}<label class="campo"><span>Confirmação</span><select name="status">${[['planejado','Planejado'],['confirmado','Confirmado'],['cancelado','Cancelado']].map(([v,n])=>`<option value="${v}" ${f.status===v?'selected':''}>${n}</option>`).join('')}</select></label></div><p class="nota">Cadastre até três períodos. Pode cadastrar a pessoa sem datas e programar depois. Para remover um período, limpe suas datas. O ciclo identifica o direito, não restringe o ano das férias. Confirme as regras trabalhistas com o RH.</p>${[0,1,2].map(i=>`<fieldset><legend>${i+1}º período</legend><div class="ferias-campos">${campo(`inicio${i}`,'Saída','date',f.periodos[i]?.inicio||'')}${campo(`fim${i}`,'Último dia de férias','date',f.periodos[i]?.fim||'')}${campo(`retorno${i}`,'Retorno ajustado (opcional)','date',f.periodos[i]?.retorno||'')}</div></fieldset>`).join('')}<label class="campo"><span>Observações e cobertura</span><textarea name="obs" maxlength="1000">${esc(f.obs)}</textarea></label><p class="nota" data-ferias-resumo aria-live="polite"></p><p class="ferias-conflito" data-ferias-erro role="alert"></p></form>`,rodape:'<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-ferias-salvar>Salvar planejamento</button>'});
  const form=m.el.querySelector('form'),botao=m.el.querySelector('[data-ferias-salvar]');
  const ler=()=>{const d=Object.fromEntries(new FormData(form));return {...(atual?{id:atual.id,...(atual.arquivado?{arquivado:true}:{})}:{}),nome:d.nome.trim(),matricula:d.matricula.trim(),regiao:d.regiao.trim(),ciclo:d.ciclo.trim(),direito:Number(d.direito),vendidos:Number(d.vendidos),status:d.status,obs:d.obs.trim(),periodos:[0,1,2].filter(i=>d[`inicio${i}`]||d[`fim${i}`]||d[`retorno${i}`]).map(i=>({inicio:d[`inicio${i}`],fim:d[`fim${i}`],retorno:d[`retorno${i}`]})).sort((a,b)=>comparar(a.inicio,b.inicio))};};
  const resumo=()=>{try{const d=validarFerias(ler()),cs=conflitosFerias(d);m.el.querySelector('[data-ferias-resumo]').textContent=`${d.periodos.reduce((s,p)=>s+diasFerias(p),0)} dias corridos · ${d.vendidos} vendidos · ${d.periodos.map(p=>`retorno ${fmtData(retornoFerias(p))}`).join(' / ')}${cs.length?' · Atenção: coincide com '+[...new Set(cs.map(p=>p.registro.nome))].join(', '):''}`;}catch(e){m.el.querySelector('[data-ferias-resumo]').textContent=e.message;}};
  form.addEventListener('input',resumo);resumo();
  const salvar=async()=>{
    if(botao.disabled||!form.reportValidity())return;botao.disabled=true;
    try{const d=validarFerias(ler());if(E.ferias.some(x=>x.id!==d.id&&x.matricula===d.matricula&&normBusca(x.ciclo)===normBusca(d.ciclo)))throw new Error('Já existe um planejamento para esta matrícula e ciclo. Edite o cadastro existente.');await salvarFerias(d,atual?.versao||0);m.fechar();toast('Planejamento de férias salvo.');}
    catch(e){m.el.querySelector('[data-ferias-erro]').textContent=e.message;botao.disabled=false;}
  };
  botao.addEventListener('click',salvar);form.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
function fimMesFerias(ano, mes) {
  return new Date(Date.UTC(Number(ano),Number(mes),0)).toISOString().slice(0,10);
}
function mapaAnualFerias() {
  const contagem = new Map();
  for(const p of periodosFerias())contagem.set(p.inicio.slice(0,4),(contagem.get(p.inicio.slice(0,4))||0)+1);
  const ano=UIferias.ano || [...contagem].sort((a,b)=>b[1]-a[1])[0]?.[0] || hojeISO().slice(0,4);
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `<section class="ferias-mapa" aria-label="Mapa anual de ausências"><div class="ferias-mapa-topo"><div><span class="ferias-eyebrow">O ANO, DE RELANCE</span><h3>Mapa de descanso</h3><p>Selecione um mês para ver quem estará fora.</p></div><div class="ferias-ano"><button class="btn-icone" data-ferias="ano" data-ano="${ano}" data-passo="-1" aria-label="Ano anterior">${icone('esquerda')}</button><strong>${ano}</strong><button class="btn-icone" data-ferias="ano" data-ano="${ano}" data-passo="1" aria-label="Próximo ano">${icone('direita')}</button></div></div><div class="ferias-meses">${meses.map((nome,i)=>{
    const mes=String(i+1).padStart(2,'0'),inicio=`${ano}-${mes}-01`,fim=fimMesFerias(ano,mes),ps=periodosFerias().filter(p=>p.inicio<=fim&&p.fim>=inicio);
    const pessoas=new Set(ps.map(p=>p.registro.matricula)).size;
    const dias=Number(fim.slice(-2));
    return `<button class="ferias-mes ${UIferias.ano===ano&&UIferias.mes===mes?'selecionado':''}" data-ferias="mes" data-mes="${mes}" data-ano="${ano}" aria-pressed="${UIferias.ano===ano&&UIferias.mes===mes}" aria-label="${nome} de ${ano}: ${pessoas} colaboradores com férias"><span>${nome}</span><strong>${pessoas || '—'}</strong><div class="ferias-dias" aria-hidden="true">${Array.from({length:dias},(_,d)=>{const dia=`${ano}-${mes}-${String(d+1).padStart(2,'0')}`,fora=ps.filter(p=>p.inicio<=dia&&p.fim>=dia);return `<i class="${fora.length?'ocupado':''} ${fora.some(p=>ufFerias(p.registro.regiao) && fora.some(q=>q.registro.matricula!==p.registro.matricula && ufFerias(q.registro.regiao)===ufFerias(p.registro.regiao)))?'coincidente':''}"></i>`;}).join('')}</div><small>${pessoas===1?'pessoa':'pessoas'}</small></button>`;
  }).join('')}</div><p class="ferias-legenda"><span>● Período de descanso</span><span>● Atenção à cobertura</span>As ausências consideram toda a equipe ativa.</p></section>`;
}
// A chave fica somente no link reservado e na sessão do administrador, nunca no código publicado.
const cargaFeriasInicial = { chave: '', erro: '', executando: false };
function capturarCargaInicialFerias() {
  const chave=new URLSearchParams(location.hash.slice(1)).get('ferias-carga');
  try {
    if(chave && /^[A-Za-z0-9_-]{43}$/.test(chave)){
      sessionStorage.setItem('ferias-carga-inicial',chave);
      history.replaceState(null,'','#ferias');
    }
    cargaFeriasInicial.chave=sessionStorage.getItem('ferias-carga-inicial') || '';
  }catch{cargaFeriasInicial.chave=chave || '';}
}
async function decodificarEquipeInicialFerias(chave, pacote) {
  const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',bytes(chave),{name:'AES-GCM'},false,['decrypt']);
  const texto=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(pacote.iv)},key,bytes(pacote.dados));
  const lista=JSON.parse(new TextDecoder().decode(texto));
  if(!Array.isArray(lista)||lista.length!==26)throw new Error('Carga inicial de colaboradores inválida.');
  lista.forEach(validarFerias);return lista;
}
async function cadastrarEquipeInicialFerias(lista) {
  exigirAdministrador();
  let adicionados=0,preservados=0;
  for(const f of lista){
    exigirAdministrador();
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${f.matricula}|${f.ciclo}`));
    const id='import-'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(E.ferias.some(x=>x.matricula===f.matricula&&x.ciclo===f.ciclo)||await Armazem.ler(`ferias/${id}`)){preservados++;continue;}
    await salvarFerias({...f,id});adicionados++;
  }
  return {adicionados,preservados};
}
async function carregarEquipeInicialFerias() {
  if(!cargaFeriasInicial.chave || cargaFeriasInicial.executando)return;
  cargaFeriasInicial.executando=true;cargaFeriasInicial.erro='';
  try {
    if(Acesso.modo!=='firebase')throw new Error('Entre no painel conectado ao Firebase para cadastrar a equipe definitivamente.');
    exigirAdministrador();
    const resposta=await fetch(new URL('./ferias-inicial.enc.json',document.baseURI));
    if(!resposta.ok)throw new Error('Aguarde a atualização do site e tente carregar a equipe novamente.');
    const lista=await decodificarEquipeInicialFerias(cargaFeriasInicial.chave,await resposta.json());
    const r=await cadastrarEquipeInicialFerias(lista);
    sessionStorage.removeItem('ferias-carga-inicial');cargaFeriasInicial.chave='';
    toast(`Equipe pronta: ${r.adicionados} colaboradores cadastrados; ${r.preservados} cadastros existentes preservados.`,'ok',{duracao:12000});
  } catch(e) {
    cargaFeriasInicial.erro=`Não foi possível concluir o cadastro inicial. ${e.message} As inclusões já concluídas serão preservadas ao tentar novamente.`;
    toast(cargaFeriasInicial.erro,'erro',{duracao:15000});
  } finally {cargaFeriasInicial.executando=false;UI.pagina='ferias';renderizar(true);}
}
