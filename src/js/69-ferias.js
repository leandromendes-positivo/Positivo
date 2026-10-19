/* Planejamento privado da equipe. A planilha é importada pelo administrador, nunca embutida no site. */
const UIferias = { busca: '', uf: '', ano: '', situacao: '' };
function dataFeriasValida(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && somaDias(d, 0) === d && d >= '2000-01-01' && d <= '2100-12-31'; }
function ufFerias(r) { return String(r || '').trim().toUpperCase().match(/^[A-Z]{2}\b/)?.[0] || ''; }
function diasFerias(p) { return diffDias(p.inicio, p.fim) + 1; }
function retornoFerias(p) { return p.retorno || somaDias(p.fim, 1); }
function periodosFerias(lista = E.ferias) { return lista.filter(f => f.status !== 'cancelado').flatMap(f => f.periodos.map((p, indice) => ({ ...p, registro: f, indice }))); }
function conflitosFerias(f, lista = E.ferias) {
  if (f.status === 'cancelado') return [];
  return periodosFerias(lista).filter(p => p.registro.id !== f.id && p.registro.matricula !== f.matricula && ufFerias(f.regiao) && ufFerias(f.regiao) === ufFerias(p.registro.regiao) && f.periodos.some(q => q.inicio <= p.fim && p.inicio <= q.fim));
}
function situacaoFerias(f, hoje = hojeISO()) {
  if (f.status === 'cancelado') return 'Cancelado';
  if (f.periodos.some(p => p.inicio <= hoje && retornoFerias(p) > hoje)) return 'Em férias';
  return f.periodos.every(p => retornoFerias(p) <= hoje) ? 'Concluído' : 'Programado';
}
function validarFerias(f) {
  for (const [chave, limite] of [['nome',120],['matricula',40],['ciclo',40]]) if (!String(f[chave] || '').trim() || f[chave].length > limite) throw new Error('Informe nome, matrícula e ciclo de referência válidos.');
  if (!/^[A-Za-z0-9_-]+$/.test(f.matricula)) throw new Error('Use apenas letras, números, hífen ou sublinhado na matrícula.');
  if (f.regiao.length > 40 || f.obs.length > 1000 || !['planejado','confirmado','cancelado'].includes(f.status)) throw new Error('Revise região, situação e observações.');
  if (!Number.isInteger(f.direito) || f.direito < 1 || f.direito > 60 || !Number.isInteger(f.vendidos) || f.vendidos < 0 || f.vendidos > 20) throw new Error('Revise o direito em dias e os dias vendidos.');
  if (!f.periodos.length || f.periodos.length > 3) throw new Error('Informe de um a três períodos.');
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
  return E.ferias.filter(f => (!UIferias.busca || normBusca(`${f.nome} ${f.matricula}`).includes(normBusca(UIferias.busca))) && (!UIferias.uf || (UIferias.uf === '?' ? !ufFerias(f.regiao) : ufFerias(f.regiao) === UIferias.uf)) && (!UIferias.ano || f.periodos.some(p => p.inicio <= `${UIferias.ano}-12-31` && p.fim >= `${UIferias.ano}-01-01`)) && (!UIferias.situacao || (UIferias.situacao === 'conflito' ? conflitosFerias(f).length : situacaoFerias(f) === UIferias.situacao)))
    .sort((a,b) => comparar(a.periodos[0].inicio,b.periodos[0].inicio) || comparar(a.nome,b.nome));
}
function renderFerias() {
  const lista = listaFeriasFiltrada(), ps = periodosFerias(), hoje = hojeISO();
  const anos = [...new Set(E.ferias.flatMap(f => f.periodos.flatMap(p => Array.from({length:Number(p.fim.slice(0,4))-Number(p.inicio.slice(0,4))+1},(_,i)=>Number(p.inicio.slice(0,4))+i))))].sort();
  const opcoes = (valores, atual) => valores.map(([v,n]) => `<option value="${esc(v)}" ${String(atual)===String(v)?'selected':''}>${esc(n)}</option>`).join('');
  return `<section class="ferias"><div class="ferias-abertura"><div><h2>Férias da equipe</h2><p>Planeje ausências, confira a cobertura e acompanhe os retornos.</p></div><div class="ferias-acoes">${podeAdministrar()?'<button class="btn prim" data-ferias="novo">Novo planejamento</button><label class="btn">Importar Excel<input type="file" accept=".xlsx" data-ferias-arquivo hidden></label>':''}<button class="btn" data-ferias="exportar" ${lista.length?'':'disabled'}>Exportar lista</button></div></div>
  ${Acesso.modo !== 'firebase'?'<p class="aviso">Modo de demonstração: as alterações ficam somente na memória desta página.</p>':''}
  <div class="ferias-kpis">${[['Em férias hoje',new Set(ps.filter(p=>p.inicio<=hoje && retornoFerias(p)>hoje).map(p=>p.registro.matricula)).size],['Saídas nos próximos 30 dias',ps.filter(p=>p.inicio>hoje && p.inicio<=somaDias(hoje,30)).length],['Planejamentos com conflito',E.ferias.filter(f=>conflitosFerias(f).length).length],['Sem região',E.ferias.filter(f=>!ufFerias(f.regiao)).length]].map(([t,n])=>`<div><span>${t}</span><strong>${n}</strong></div>`).join('')}</div>
  <form class="ferias-filtros"><label class="campo"><span>Colaborador ou matrícula</span><input name="busca" value="${esc(UIferias.busca)}" type="search"></label><label class="campo"><span>Ano dos períodos</span><select name="ano">${opcoes([['','Todos'],...anos.map(a=>[a,a])],UIferias.ano)}</select></label><label class="campo"><span>UF</span><select name="uf">${opcoes([['','Todas'],...([...new Set(E.ferias.map(f=>ufFerias(f.regiao)).filter(Boolean))].sort().map(x=>[x,x])),['?','Sem região']],UIferias.uf)}</select></label><label class="campo"><span>Situação</span><select name="situacao">${opcoes([['','Todas'],...['Programado','Em férias','Concluído','Cancelado'].map(x=>[x,x]),['conflito','Com conflito']],UIferias.situacao)}</select></label><button class="btn" type="submit">Aplicar filtros</button><button class="btn" type="button" data-ferias="limpar">Limpar</button></form>
  <p class="nota">${lista.length} de ${E.ferias.length} planejamentos. Dias corridos, incluindo início e fim. Retorno padrão no dia seguinte, ajustável à escala. Conflitos consideram períodos simultâneos na mesma UF, inclusive capital e interior; são alertas de cobertura, sem bloquear a programação. O cálculo considera toda a equipe, mesmo fora dos filtros.</p>
  <div class="ferias-lista">${lista.map(f=>{
    const conflitos=conflitosFerias(f), total=f.periodos.reduce((s,p)=>s+diasFerias(p),0), saldo=f.direito-total-f.vendidos;
    return `<article class="ferias-card"><header><div><h3>${esc(f.nome)}</h3><p>Matrícula ${esc(f.matricula)} · ${esc(f.regiao || 'Região não informada')} · Ciclo ${esc(f.ciclo)}</p></div>${pill(conflitos.length?'alerta':situacaoFerias(f)==='Em férias'?'info':'neutro',situacaoFerias(f))}</header><div class="ferias-periodos">${f.periodos.map((p,i)=>`<div><strong>${i+1}º período · ${diasFerias(p)} dias</strong><span>${fmtData(p.inicio)} a ${fmtData(p.fim)}</span><span>Retorno: <b>${fmtData(retornoFerias(p))}</b>${p.retorno?' · ajustado':''}</span></div>`).join('')}</div><p><b>${total} dias programados</b> · ${f.vendidos} vendidos · ${saldo} a programar de ${f.direito} dias · ${f.status==='confirmado'?'Confirmado':f.status==='cancelado'?'Cancelado':'Planejamento'}</p>
    ${conflitos.length?`<p class="ferias-conflito">${icone('alerta')} Coincide com ${[...new Set(conflitos.map(p=>`${p.registro.nome} (${fmtData(p.inicio)} a ${fmtData(p.fim)})`))].map(esc).join('; ')}.</p>`:''}${!ufFerias(f.regiao)?'<p class="ferias-conflito">Informe a região para verificar conflitos de cobertura.</p>':''}${f.obs?`<p class="ferias-observacao">${esc(f.obs)}</p>`:''}<footer>${podeAdministrar()?`<button class="btn pequeno" data-ferias="editar" data-id="${esc(f.id)}">Editar datas e cadastro</button>`:''}<button class="btn pequeno" data-ferias="historico" data-id="${esc(f.id)}">Histórico</button></footer></article>`;
  }).join('') || vazio('calendario','Nenhum planejamento encontrado',E.ferias.length?'Revise os filtros para consultar a equipe.':'Importe a relação de férias ou cadastre o primeiro colaborador.')}</div></section>`;
}
function prepararTelaFerias() {
  const raiz=document.querySelector('.ferias');
  raiz.querySelector('form').addEventListener('submit',e=>{e.preventDefault();Object.assign(UIferias,Object.fromEntries(new FormData(e.target)));renderizar(true);});
  raiz.addEventListener('click',e=>{
    const b=e.target.closest('[data-ferias]'); if(!b)return;
    Promise.resolve().then(async()=>{
      if(b.dataset.ferias==='novo')modalFerias();
      if(b.dataset.ferias==='editar')modalFerias(E.ferias.find(f=>f.id===b.dataset.id));
      if(b.dataset.ferias==='limpar'){Object.assign(UIferias,{busca:'',uf:'',ano:'',situacao:''});renderizar(true);}
      if(b.dataset.ferias==='exportar')await exportarFerias();
      if(b.dataset.ferias==='historico'){
        const docs=await Armazem.consultar('historico_ferias',{onde:[['id','==',b.dataset.id]]});
        docs.sort((a,b)=>b.versao-a.versao);
        abrirModal({titulo:'Histórico de férias',corpo:`<ol class="linha-tempo">${docs.map(d=>`<li><div><strong>Versão ${d.versao} · ${esc(d.atualizadoPor.email || 'Demonstração')}</strong><p>${fmtDataHora(d.atualizadoEm)} · ${esc(d.status)} · ${esc(d.nome)} · ${esc(d.regiao)} · ciclo ${esc(d.ciclo)}</p><p>${d.periodos.map(p=>`${fmtData(p.inicio)} a ${fmtData(p.fim)} · retorno ${fmtData(retornoFerias(p))}`).join('<br>')}</p><p>${d.vendidos} dias vendidos · direito ${d.direito}${d.obs?` · ${esc(d.obs)}`:''}</p></div></li>`).join('') || '<li>Sem alterações registradas.</li>'}</ol>`});
      }
    }).catch(e=>toast(e.message,'erro'));
  });
  raiz.querySelector('[data-ferias-arquivo]')?.addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)importarFerias(f).catch(e=>toast(e.message,'erro'));});
}
function modalFerias(atual) {
  exigirAdministrador();
  const f=atual || {nome:'',matricula:'',regiao:'',ciclo:String(new Date().getFullYear()),status:'planejado',direito:30,vendidos:0,obs:'',periodos:[]};
  const campo=(nome,titulo,tipo='text',valor=f[nome]??'',extra='')=>`<label class="campo"><span>${titulo}</span><input name="${nome}" type="${tipo}" value="${esc(valor)}" ${extra}></label>`;
  const m=abrirModal({administrativo:true,titulo:atual?'Editar férias':'Novo planejamento de férias',largura:'larga',corpo:`<form class="form ferias-form">${campo('nome','Nome do colaborador','text',f.nome,'required maxlength="120" list="ferias-tecnicos"')}<datalist id="ferias-tecnicos">${Object.values(E.cadastro).map(t=>`<option value="${esc(t.nome)}">${esc(t.regiao)}</option>`).join('')}</datalist><div class="ferias-campos">${campo('matricula','Matrícula','text',f.matricula,'required maxlength="40"')}${campo('regiao','Região (UF e localidade)','text',f.regiao,'maxlength="40"')}${campo('ciclo','Ciclo de referência','text',f.ciclo,'required maxlength="40"')}${campo('direito','Direito em dias','number',f.direito,'required min="1" max="60"')}${campo('vendidos','Dias vendidos','number',f.vendidos,'required min="0" max="20"')}<label class="campo"><span>Confirmação</span><select name="status">${[['planejado','Planejado'],['confirmado','Confirmado'],['cancelado','Cancelado']].map(([v,n])=>`<option value="${v}" ${f.status===v?'selected':''}>${n}</option>`).join('')}</select></label></div><p class="nota">Cadastre até três períodos. Para remover um período, limpe suas datas. O ciclo identifica o direito, não restringe o ano das férias. Confirme as regras trabalhistas com o RH.</p>${[0,1,2].map(i=>`<fieldset><legend>${i+1}º período</legend><div class="ferias-campos">${campo(`inicio${i}`,'Saída','date',f.periodos[i]?.inicio||'')}${campo(`fim${i}`,'Último dia de férias','date',f.periodos[i]?.fim||'')}${campo(`retorno${i}`,'Retorno ajustado (opcional)','date',f.periodos[i]?.retorno||'')}</div></fieldset>`).join('')}<label class="campo"><span>Observações e cobertura</span><textarea name="obs" maxlength="1000">${esc(f.obs)}</textarea></label><p class="nota" data-ferias-resumo aria-live="polite"></p><p class="ferias-conflito" data-ferias-erro role="alert"></p></form>`,rodape:'<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-ferias-salvar>Salvar planejamento</button>'});
  const form=m.el.querySelector('form'),botao=m.el.querySelector('[data-ferias-salvar]');
  const ler=()=>{const d=Object.fromEntries(new FormData(form));return {...(atual?{id:atual.id}:{}),nome:d.nome.trim(),matricula:d.matricula.trim(),regiao:d.regiao.trim(),ciclo:d.ciclo.trim(),direito:Number(d.direito),vendidos:Number(d.vendidos),status:d.status,obs:d.obs.trim(),periodos:[0,1,2].filter(i=>d[`inicio${i}`]||d[`fim${i}`]||d[`retorno${i}`]).map(i=>({inicio:d[`inicio${i}`],fim:d[`fim${i}`],retorno:d[`retorno${i}`]})).sort((a,b)=>comparar(a.inicio,b.inicio))};};
  const resumo=()=>{try{const d=validarFerias(ler()),cs=conflitosFerias(d);m.el.querySelector('[data-ferias-resumo]').textContent=`${d.periodos.reduce((s,p)=>s+diasFerias(p),0)} dias corridos · ${d.vendidos} vendidos · ${d.periodos.map(p=>`retorno ${fmtData(retornoFerias(p))}`).join(' / ')}${cs.length?' · Atenção: coincide com '+[...new Set(cs.map(p=>p.registro.nome))].join(', '):''}`;}catch(e){m.el.querySelector('[data-ferias-resumo]').textContent=e.message;}};
  form.addEventListener('input',resumo);resumo();
  const salvar=async()=>{
    if(botao.disabled||!form.reportValidity())return;botao.disabled=true;
    try{const d=validarFerias(ler());if(E.ferias.some(x=>x.id!==d.id&&x.matricula===d.matricula&&normBusca(x.ciclo)===normBusca(d.ciclo)))throw new Error('Já existe um planejamento para esta matrícula e ciclo. Edite o cadastro existente.');await salvarFerias(d,atual?.versao||0);m.fechar();toast('Planejamento de férias salvo.');}
    catch(e){m.el.querySelector('[data-ferias-erro]').textContent=e.message;botao.disabled=false;}
  };
  botao.addEventListener('click',salvar);form.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
async function lerPlanilhaFerias(arquivo) {
  if(arquivo.size>5*1024*1024)throw new Error('A planilha deve ter até 5 MB.');
  await bibliotecasExcelRelatorio();
  const livro=new ExcelJS.Workbook();await livro.xlsx.load(await arquivo.arrayBuffer());
  const texto=v=>String(v?.result ?? v?.text ?? (v?.richText ? v.richText.map(t=>t.text).join('') : v) ?? '').trim();
  let aba, cabecalho=0;
  for(const s of livro.worksheets){for(let n=1;n<=Math.min(s.rowCount,20);n++){if(normBusca(texto(s.getCell(`B${n}`).value))==='matricula' && normBusca(texto(s.getCell(`C${n}`).value))==='nome'){aba=s;cabecalho=n;break;}}if(aba)break;}
  if(!aba)throw new Error('Formato não reconhecido. Use a relação com Matrícula e Nome nas colunas B e C.');
  const data=v=>{
    v=v?.result??v;if(v==null||v==='')return '';
    if(v instanceof Date)return v.toISOString().slice(0,10);
    if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10);
    const t=texto(v),m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);return m?`${m[3]}-${m[2]}-${m[1]}`:t;
  };
  const lista=[],avisos=[];
  if(aba.rowCount>1000)throw new Error('A planilha deve ter no máximo 1.000 linhas.');
  for(let n=cabecalho+1;n<=aba.rowCount;n++){
    const r=aba.getRow(n);if(!r.getCell(2).value&&!r.getCell(3).value)continue;
    const periodos=[[6,7],[9,10]].filter(([a,b])=>r.getCell(a).value||r.getCell(b).value).map(([a,b])=>({inicio:data(r.getCell(a).value),fim:data(r.getCell(b).value),retorno:''}));
    const opcao=texto(r.getCell(5).value),origem=texto(r.getCell(13).value),obs=texto(r.getCell(15).value);
    const f={nome:texto(r.getCell(3).value),matricula:texto(r.getCell(2).value),regiao:texto(r.getCell(4).value),ciclo:periodos[0]?.inicio.slice(0,4)||'',periodos,status:'planejado',direito:30,vendidos:/vender\s*10/i.test(opcao)?10:0,obs:[obs,origem&&origem!=='OK'?`Nota da planilha: ${origem}`:''].filter(Boolean).join('\n')};
    try{validarFerias(f);}catch(e){throw new Error(`Linha ${n}: ${e.message}`);}
    if(lista.some(x=>x.matricula===f.matricula&&x.ciclo===f.ciclo))throw new Error(`Linha ${n}: matrícula e ciclo duplicados na planilha.`);
    if(!ufFerias(f.regiao))avisos.push(`${f.nome}: região não informada.`);
    if(obs || (origem&&origem!=='OK'))avisos.push(`${f.nome}: confira a observação original.`);
    [[8,0],[11,1]].forEach(([col,i])=>{const valor=r.getCell(col).value?.result??r.getCell(col).value;if(periodos[i]&&valor!=null&&Number(valor)!==diasFerias(periodos[i]))avisos.push(`${f.nome}: dias do ${i+1}º período recalculados pelas datas.`);});
    const total=r.getCell(12).value?.result??r.getCell(12).value;if(total!=null&&Number(total)!==periodos.reduce((s,p)=>s+diasFerias(p),0))avisos.push(`${f.nome}: total recalculado pelas datas.`);
    lista.push(f);
  }
  if(!lista.length)throw new Error('Nenhum colaborador encontrado.');
  return {lista,avisos};
}
async function importarFerias(arquivo) {
  exigirAdministrador();const {lista,avisos}=await lerPlanilhaFerias(arquivo);
  const novos=lista.filter(f=>!E.ferias.some(x=>x.matricula===f.matricula&&x.ciclo===f.ciclo));
  const m=abrirModal({administrativo:true,titulo:'Conferir importação de férias',largura:'larga',corpo:`<p>${lista.length} colaboradores encontrados; ${novos.length} novos planejamentos. ${lista.length-novos.length} já cadastrados serão preservados, sem sobrescrever suas edições.</p><p class="nota">O ciclo inicial é o ano da primeira saída e todos entram como planejados. Datas prevalecem sobre totais e status da planilha; revise divergências após importar. Os dados ficam no banco do painel, sem publicação no código.</p>${avisos.length?`<ul>${avisos.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}<div class="ferias-previa">${novos.map(f=>`<p><b>${esc(f.nome)}</b> · ${esc(f.regiao||'Sem região')} · ${f.periodos.map(p=>`${fmtData(p.inicio)} a ${fmtData(p.fim)} (${diasFerias(p)} dias)`).join(' / ')}</p>`).join('')}</div><p role="status" data-importacao-status></p>`,rodape:`<button class="btn" data-fechar>Fechar</button><button class="btn prim" data-importar ${novos.length?'':'disabled'}>Importar ${novos.length} planejamentos</button>`});
  const b=m.el.querySelector('[data-importar]'),status=m.el.querySelector('[data-importacao-status]');
  b.addEventListener('click',async()=>{
    if(b.disabled)return;b.disabled=true;let concluidos=0;
    try{
      for(const f of novos){
        exigirAdministrador();
        // Identidade determinística permite repetir uma importação interrompida sem duplicar registros.
        const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${f.matricula}|${f.ciclo}`));
        const id='import-'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
        if(!await Armazem.ler(`ferias/${id}`))await salvarFerias({...f,id});
        concluidos++;status.textContent=`${concluidos} de ${novos.length} processados.`;
      }
      m.fechar();toast('Importação de férias concluída.');
    }catch(e){status.textContent=`${concluidos} de ${novos.length} processados. ${e.message} Você pode repetir a importação; cadastros existentes serão preservados.`;b.disabled=false;}
  });
}
async function exportarFerias() {
  await bibliotecasExcelRelatorio();const livro=new ExcelJS.Workbook(),aba=livro.addWorksheet('Férias');
  aba.addRow(['Matrícula','Nome','Região','Ciclo','Situação','Confirmação','Período','Saída','Fim','Dias corridos','Retorno','Vendidos','Direito','Saldo a programar','Coincide com','Observações']);
  for(const f of listaFeriasFiltrada())f.periodos.forEach((p,i)=>aba.addRow([f.matricula,f.nome,f.regiao,f.ciclo,situacaoFerias(f),f.status,i+1,p.inicio,p.fim,diasFerias(p),retornoFerias(p),f.vendidos,f.direito,f.direito-f.vendidos-f.periodos.reduce((s,p)=>s+diasFerias(p),0),[...new Set(conflitosFerias(f).map(p=>p.registro.nome))].join('; '),f.obs]));
  aba.getRow(1).font={bold:true};aba.views=[{state:'frozen',ySplit:1}];aba.columns.forEach(c=>c.width=22);aba.getColumn(2).width=42;aba.autoFilter={from:'A1',to:'P1'};
  await baixarArquivoRelatorio(new Blob([await livro.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`ferias-${hojeISO()}.xlsx`);
}
