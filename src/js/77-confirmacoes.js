/* O operador registra o e-mail recebido; não há leitura automática de mensagens. */
function modalConfirmacao(tid, chaves = null, dataInicial = '') {
  const D=derivar(),t=D.mapa.get(tid);if(!t)return;
  const itens=pecasCobranca(t,'todas'), selecionadas=new Set(chaves || itens.map(i=>i.k)), emails=emailsFormais(tid);
  if(!itens.length){toast('Não há peças no inventário deste técnico.','info');return;}
  const versaoIndice=E.indice.versao || 0;
  const escolhido=itens.find(i=>selecionadas.has(i.k)&&i.confirmacao);
  const m=abrirModal({titulo:'Confirmar previsão por e-mail',subtitulo:t.nome,largura:'larga',corpo:`
    <div class="faixa info compacta"><div><strong>Formalização por e-mail</strong><span>Registre a resposta que o técnico enviou por e-mail. WhatsApp serve apenas como aviso; o painel não lê as mensagens automaticamente.</span></div></div>
    ${!emails.length?'<div class="faixa alerta compacta"><div><strong>Falta registrar a cobrança formal</strong><span>Envie a cobrança por e-mail e registre o contato para vincular a resposta do técnico.</span></div><button type="button" class="btn" data-formalizar-email>Preparar e-mail</button></div>':''}
    <form id="confirmacao-form" class="form">
      <div class="campos-2"><label class="campo"><span>Cobrança formal enviada por e-mail</span><select id="confirmacao-contato" required ${!emails.length?'disabled':''}><option value="">Selecione a cobrança</option>${emails.map(c=>`<option value="${esc(c.id)}" ${c.id===escolhido?.confirmacao?.contatoId?'selected':''}>${fmtDataHora(c.em)} · ${plural(c.pecas,'peça','peças')} · ${esc(primeiroNomeEmail(c.email))}</option>`).join('')}</select></label>
      <label class="campo"><span>Previsão informada pelo técnico</span><input type="date" id="confirmacao-data" min="${somaDias(D.hoje,-30)}" required value="${esc(dataInicial||escolhido?.previsao||'')}"></label></div>
      ${atalhosData('#confirmacao-data')}
      <label class="campo"><span>Referência do e-mail de resposta</span><input type="text" id="confirmacao-email" maxlength="200" required placeholder="Ex.: Re: Devolução de peças — 09/10/2026, 14h30" value="${esc(escolhido?.confirmacao?.referenciaEmail||'')}"><small>Identifique o assunto e a data/hora ou cole o link da mensagem recebida.</small></label>
      <div class="confirmacao-lista-topo"><div><h3>Peças confirmadas pelo técnico</h3><p class="nota">Marque as peças e ajuste as quantidades. As não marcadas mantêm sua situação atual.</p></div><label class="campo"><span>Localizar peça nesta lista</span><input type="search" data-confirmacao-busca placeholder="Nome ou código da peça"></label></div>
      <div class="confirmacao-lista">${itens.map((i,n)=>{
        const c=i.confirmacao, qtd=i.qtdPrevista || i.qtd, condicao=c?(c.qtdRmdf===c.quantidade?'rmdf':c.qtdRmdf?'mista':'nova'):'';
        return `<fieldset class="confirmacao-peca" data-confirmacao-linha="${n}"><legend class="sr-only">${esc(i.mat)}</legend>
          <label class="confirmacao-selecao"><input type="checkbox" data-incluir ${selecionadas.has(i.k)?'checked':''}><span><strong class="mono">${esc(i.mat)}</strong><span>${esc(i.desc)}</span><small>${i.tipo==='usadas'?'Usada':'Nova'} · saldo: ${fmtNum(i.qtd)}${i.chamado?` · chamado ${esc(i.chamado)}`:''}${i.previsao?` · previsão atual: ${fmtData(i.previsao)}`:''}</small></span></label>
          <div class="confirmacao-valores"><label class="campo"><span>Quantidade a devolver</span><input type="number" data-quantidade min="1" max="${i.qtd}" step="1" value="${qtd}" required></label>
          ${i.tipo==='novas'?`<label class="campo"><span>Condição informada no e-mail</span><select data-condicao required><option value="">Selecione</option><option value="nova" ${condicao==='nova'?'selected':''}>Nova — retorno ao estoque</option><option value="rmdf" ${condicao==='rmdf'?'selected':''}>RMDF já aplicado</option><option value="mista" ${condicao==='mista'?'selected':''}>Parte nova, parte com RMDF</option></select></label><label class="campo" data-parcial-rmdf hidden><span>Quantas estão com RMDF?</span><input type="number" data-rmdf min="1" step="1" value="${c?.qtdRmdf||1}"></label>`:'<span class="confirmacao-tipo">Devolução de peça usada</span>'}</div>
          ${i.tipo==='novas'?'<small class="nota">RMDF deve estar aplicado. Se o técnico disse que ainda vai aplicar, não confirme essa quantidade; registre a observação e aguarde o e-mail de confirmação.</small>':''}
        </fieldset>`;
      }).join('')}</div>
      <p class="nota" data-confirmacao-vazia hidden>Nenhuma peça corresponde à pesquisa.</p>
      <label class="campo"><span>Observação sobre a resposta (opcional)</span><textarea id="confirmacao-obs" rows="2" maxlength="300">${esc(escolhido?.confirmacao?.observacao||'')}</textarea></label>
      <label class="confirmacao-ateste"><input type="checkbox" id="confirmacao-ateste" required><span>Confirmo que o técnico formalizou por <strong>e-mail</strong> a data, as peças e as condições selecionadas.</span></label>
      <p class="nota">Reconfirmar um material substitui sua previsão anterior. A previsão não dá baixa nem confirma o recebimento. O estoque será atualizado pela próxima planilha; saídas de novas continuam sujeitas à classificação da devolução.</p>
    </form>`,rodape:`<span class="confirmacao-total" aria-live="polite" data-confirmacao-total></span>${itens.some(i=>i.previsao)?'<button type="button" class="btn perigo fantasma" data-cancelar-previsao>Remover previsões selecionadas</button>':''}<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar-confirmacao ${!emails.length?'disabled':''}>Salvar confirmação</button>`});
  const form=m.el.querySelector('#confirmacao-form'),linhas=[...m.el.querySelectorAll('[data-confirmacao-linha]')];
  function atualizar(){
    let qtd=0,rmdf=0;
    for(const linha of linhas){
      const ativa=linha.querySelector('[data-incluir]').checked, q=linha.querySelector('[data-quantidade]'),cond=linha.querySelector('[data-condicao]'), parcial=linha.querySelector('[data-rmdf]');
      linha.classList.toggle('selecionada',ativa);
      linha.querySelectorAll('.confirmacao-valores input,.confirmacao-valores select').forEach(c=>c.disabled=!ativa);
      if(parcial){const misto=ativa&&cond.value==='mista';linha.querySelector('[data-parcial-rmdf]').hidden=!misto;parcial.disabled=!misto;parcial.required=misto;parcial.max=String(Math.max(0,Number(q.value)-1));}
      if(ativa){qtd+=Number(q.value)||0;rmdf+=cond?.value==='rmdf'?Number(q.value)||0:cond?.value==='mista'?Number(parcial.value)||0:0;}
    }
    m.el.querySelector('[data-confirmacao-total]').textContent=`${plural(qtd,'peça selecionada','peças selecionadas')}${rmdf?` · ${rmdf} com RMDF`:''}`;
  }
  form.addEventListener('input',atualizar);form.addEventListener('change',atualizar);atualizar();ligarAtalhos(m.el);
  m.el.querySelector('[data-confirmacao-busca]').addEventListener('input',e=>{
    const termos=normBusca(e.target.value).split(/\s+/).filter(Boolean);
    linhas.forEach((l,n)=>l.hidden=!termos.every(s=>normBusca(itens[n].mat+' '+itens[n].desc).includes(s)));
    m.el.querySelector('[data-confirmacao-vazia]').hidden=linhas.some(l=>!l.hidden);
  });
  m.el.querySelector('[data-formalizar-email]')?.addEventListener('click',()=>{m.fechar();modalCobrar(tid,'todos',itens,'email');});
  const salvar=async remover=>{
    const btn=m.el.querySelector('[data-salvar-confirmacao]');if(btn.dataset.salvando)return;
    if(!remover){const invalido=form.querySelector(':invalid');if(invalido?.closest('[data-confirmacao-linha]'))invalido.closest('[data-confirmacao-linha]').hidden=false;if(!form.reportValidity())return;}
    const ativas=linhas.filter(l=>l.querySelector('[data-incluir]').checked);
    if(!ativas.length){toast('Selecione ao menos uma peça.','info');return;}
    const data=m.el.querySelector('#confirmacao-data').value;
    if(!remover&&somaDias(data,0)!==data){toast('Informe uma data válida.','erro');return;}
    btn.dataset.salvando='1';btn.disabled=true;
    try{
      const selecionados=ativas.map(l=>{
        const i=itens[Number(l.dataset.confirmacaoLinha)],qtd=Number(l.querySelector('[data-quantidade]').value),cond=l.querySelector('[data-condicao]')?.value;
        const rmdf=cond==='rmdf'?qtd:cond==='mista'?Number(l.querySelector('[data-rmdf]').value):0;
        return {...i,confirmacao:remover?null:dadosConfirmacao(i,qtd,rmdf,m.el.querySelector('#confirmacao-contato').value,m.el.querySelector('#confirmacao-email').value,m.el.querySelector('#confirmacao-obs').value)};
      });
      await gravarAgendamentos(selecionados,remover?'':data,null,{versaoIndice});
      m.fechar();toast(remover?'Previsões removidas. Histórico preservado.':'Confirmação por e-mail registrada. Peças incluídas na agenda.');renderizar(true);
    }catch(e){toast(erroAmigavel(e).message,'erro');delete btn.dataset.salvando;btn.disabled=!emails.length;}
  };
  m.el.querySelector('[data-salvar-confirmacao]').addEventListener('click',()=>salvar(false));
  m.el.querySelector('[data-cancelar-previsao]')?.addEventListener('click',()=>salvar(true));
  form.addEventListener('submit',e=>{e.preventDefault();salvar(false);});
}
function renderRespostasCobranca(D,s){
  const todas=acompanhamentoRespostas(D,s.tipo||'usadas').filter(i=>(!s.somenteMeus||respostaDoUsuario(i))&&(!s.regiao||i.regiao===s.regiao)&&(!s.busca||normBusca(i.nome).includes(normBusca(s.busca))));
  const estados=[['aguardando','Aguardando resposta','alerta'],['formalizar','Falta e-mail formal','grave'],['confirmada','Confirmadas','ok'],['vencida','Previsões vencidas','crit']];
  const atual=s.resposta||'aguardando',lista=todas.filter(i=>atual==='pendentes' ? i.estadoResposta==='formalizar'||(i.estadoResposta==='aguardando'&&i.diasResposta>=1) : atual==='todas'||i.estadoResposta===atual);
  const grupos=[...agrupar(lista,i=>i.tid)].sort((a,b)=>(s.ordem==='nome'?0:s.ordem==='pecas'?somar(b[1],i=>i.qtd)-somar(a[1],i=>i.qtd):Math.max(...b[1].map(i=>i.diasResposta))-Math.max(...a[1].map(i=>i.diasResposta)))||comparar(nomeTecnico(a[0]),nomeTecnico(b[0])));
  return `<section class="respostas-cobranca"><div class="respostas-resumo">${estados.map(([v,n,c])=>{const l=todas.filter(i=>i.estadoResposta===v);return `<button class="resposta-indicador ${c} ${atual===v?'ativo':''}" data-acao="resposta-filtro" data-v="${v}" aria-pressed="${atual===v}"><span>${n}</span><strong>${new Set(l.map(i=>i.tid)).size}<small> técnicos</small></strong><span>${plural(somar(l,i=>i.qtd),'peça','peças')}</span></button>`;}).join('')}</div>
    ${atual==='pendentes'?'<div class="faixa alerta compacta"><div><strong>Pendências por e-mail</strong><span>Respostas aguardadas desde ontem e avisos ainda sem cobrança formal. Escolha uma situação acima para mudar o recorte.</span></div></div>':''}
    <p class="nota">WhatsApp é um aviso. A cobrança formal e a confirmação da previsão são registradas por e-mail. O sino lembra respostas pendentes desde o dia seguinte à cobrança.</p>
    ${grupos.length?grupos.map(([tid,itens])=>`<article class="resposta-cartao"><header><div>${avatar(nomeTecnico(tid),'tecnico')}<div><h3>${esc(nomeTecnico(tid))}</h3><span class="nota">${esc(itens[0].regiao)} · ${plural(somar(itens,i=>i.qtd),'peça','peças')}${atual==='aguardando'?` · aguardando há ${Math.max(...itens.map(i=>i.diasResposta))} dia(s)`:''}</span></div></div><div class="linha-botoes"><button class="btn" data-acao="email-formal" data-tid="${esc(tid)}">${icone('email')}Cobrar por e-mail</button><button class="btn prim" data-acao="confirmar-retorno" data-tid="${esc(tid)}">${icone('calendario')}${atual==='confirmada'||atual==='vencida'?'Rever confirmação':'Registrar resposta'}</button></div></header>
    <ul>${itens.map(i=>`<li><div><strong class="mono">${esc(i.mat)}</strong><span>${esc(i.desc)}</span><small>${i.tipo==='novas'?'Nova':'Usada'}${i.chamado?` · chamado ${esc(i.chamado)}`:''}${i.contato?` · cobrança ${fmtDataHora(i.contato.em)}`:''}</small>${['confirmada','vencida'].includes(i.estadoResposta)?`<small>${esc(descricaoConfirmacao(i))} · previsão ${fmtData(i.previsao)}<br>Resposta: ${esc(i.confirmacao.referenciaEmail)}<br>Registrada por ${esc(autorPrevisao(i))}${i.confirmacao.observacao?` · ${esc(i.confirmacao.observacao)}`:''}</small>`:''}</div><strong>${fmtNum(i.qtd)}<small> peças</small></strong></li>`).join('')}</ul></article>`).join(''):vazio('ok','Nenhum registro nesta situação','Escolha outro tipo ou situação para consultar o acompanhamento.')}</section>`;
}
