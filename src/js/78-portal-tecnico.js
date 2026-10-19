/* Painel exclusivo: não usa derivar(), cadastro geral ou consultas globais. */
function renderPortalTecnico() {
  if(!perfilTecnico())return vazio('pessoa','Acesso restrito','Entre com o acesso técnico cadastrado.');
  const P=PortalTecnico, pecas=[...P.pecas].sort((a,b)=>comparar(a.tipo,b.tipo)||comparar(a.mat,b.mat));
  const usadas=pecas.filter(p=>p.tipo==='usadas'),novas=pecas.filter(p=>p.tipo==='novas');
  return `<section class="portal-intro"><span class="sobretitulo">PORTAL DO TÉCNICO</span><h2>${esc(P.saldo?.nome || nomeDaConta())}</h2><p>Seu estoque e suas devoluções · ${esc(Acesso.perfil.tecnicoId.split('--')[0])}</p><p class="nota">${P.controle?`Saldo do relatório atualizado em ${fmtDataHora(P.controle.atualizadoEm)}.`:'Aguardando a publicação do seu estoque.'} As quantidades permanecem no saldo até a atualização do relatório oficial.</p><button class="btn" data-acao="portal-historico">${icone('calendario')}Meu histórico</button></section>
    <div class="portal-indicadores"><article><small>Usadas a devolver</small><strong>${fmtNum(somar(usadas,p=>p.quantidade))}</strong></article><article><small>Novas sob sua responsabilidade</small><strong>${fmtNum(somar(novas,p=>p.quantidade))}</strong></article><article><small>Registros nesta versão</small><strong>${P.declaracoes.filter(d=>!d.cancelado&&d.geracao===P.controle?.geracao).length}</strong></article></div>
    <p class="nota">Informe a quantidade que irá devolver e a data prevista. Para peças novas com defeito, informe separadamente o RMDF previsto ou aplicado. O protocolo é obrigatório quando aplicado. Suas informações serão encaminhadas à operação para conferência.</p>
    ${pecas.length?`<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Peça / origem</th><th>Tipo</th><th>Saldo</th><th>Sua informação</th><th></th></tr></thead><tbody>${pecas.map(p=>{
      const d=P.declaracoes.find(d=>d.id===p.id),atual=d?.geracao===P.controle?.geracao;
      return `<tr><td><strong>${esc(p.mat)}</strong><small class="sub-celula">${esc(p.descricao)}${p.chamado?` · Chamado ${esc(p.chamado)}`:''}${p.nf?` · NF ${esc(p.nf)}`:''}${p.tipoEnvio?` · ${esc(p.tipoEnvio)}`:''}</small></td><td>${pill(p.tipo==='usadas'?'alerta':'info',p.tipo==='usadas'?'Usada':'Nova')}</td><td>${fmtNum(p.quantidade)}</td><td>${d?descricaoDeclaracaoTecnico(d):'Não informado'}${d&&!atual?'<small class="sub-celula">Relatório anterior: confira novamente o saldo.</small>':''}</td><td><button class="btn pequeno" data-acao="portal-informar" data-peca="${esc(p.id)}">${d?'Revisar informação':'Informar devolução / RMDF'}</button></td></tr>`;
    }).join('')}</tbody></table></div>`:vazio('caixa','Nenhuma peça no relatório atual','Se você possui peças que não aparecem aqui, solicite à operação a conferência do seu vínculo e da última importação. Não é possível acessar o estoque de outro técnico.')}`;
}
function descricaoDeclaracaoTecnico(d) {
  if(d.cancelado)return pill('neutro','Informação cancelada');
  return `${d.quantidadeDevolver?`<strong>${fmtNum(d.quantidadeDevolver)} a devolver</strong> · ${fmtData(d.previsao)}`:''}${d.quantidadeRmdf?`<small class="sub-celula">${fmtNum(d.quantidadeRmdf)} RMDF ${d.rmdf==='aplicado'?'aplicado':'previsto'}${d.protocolo?` · ${esc(d.protocolo)}`:''}</small>`:''}<small class="sub-celula">Informado pelo técnico · sujeito à conferência</small>`;
}
function modalDeclaracaoTecnico(id) {
  if(!perfilTecnico())return;
  const p=PortalTecnico.pecas.find(p=>p.id===id), ant=PortalTecnico.declaracoes.find(d=>d.id===id);
  if(!p || E.status!=='pronto'){toast('Atualize seu estoque antes de informar.','erro');return;}
  const d=ant?.geracao===PortalTecnico.controle?.geracao&&!ant.cancelado?ant:{};
  const m=abrirModal({titulo:'Devolução e RMDF',subtitulo:`${p.mat} · saldo ${fmtNum(p.quantidade)} · ${p.tipo==='usadas'?'Usada':'Nova'}`,corpo:`<form class="form" id="portal-declaracao"><label class="campo"><span>Quantidade que irá devolver</span><input type="number" name="quantidadeDevolver" min="0" max="${p.quantidade}" step="1" value="${d.quantidadeDevolver||0}" required></label><label class="campo"><span>Data prevista da devolução</span><input type="date" name="previsao" value="${esc(d.previsao||'')}"></label>${p.tipo==='novas'?`<label class="campo"><span>Quantidade destinada ao RMDF</span><input type="number" name="quantidadeRmdf" min="0" max="${p.quantidade}" step="1" value="${d.quantidadeRmdf||0}" required></label><label class="campo"><span>Situação do RMDF</span><select name="rmdf"><option value="nenhum">Não se aplica</option><option value="previsto" ${d.rmdf==='previsto'?'selected':''}>Será aplicado</option><option value="aplicado" ${d.rmdf==='aplicado'?'selected':''}>Já aplicado</option></select></label><label class="campo"><span>Protocolo / referência do RMDF</span><input name="protocolo" maxlength="100" value="${esc(d.protocolo||'')}"><small>Obrigatório se o RMDF já foi aplicado.</small></label>`:''}<label class="campo"><span>Observações</span><textarea name="observacao" maxlength="500">${esc(d.observacao||'')}</textarea></label><p class="nota">A soma de devolução e RMDF deve caber no saldo. Para corrigir uma informação, salve novamente; a versão anterior permanece no histórico. Cancelar a informação não retira a peça do seu saldo.</p><p role="alert" data-erro></p></form>`,rodape:`<button class="btn" data-fechar>Fechar</button>${ant&&!ant.cancelado?'<button class="btn perigo" data-cancelar>Cancelar informação</button>':''}<button class="btn prim" data-enviar>Salvar informação</button>`});
  const f=m.el.querySelector('form'),b=m.el.querySelector('[data-enviar]');let enviando=false;
  const salvar=async(cancelado=false)=>{
    if(enviando || (!cancelado&&!f.reportValidity()))return;
    const q=cancelado?0:Number(f.quantidadeDevolver.value),r=cancelado?0:Number(f.quantidadeRmdf?.value||0);
    const valores={quantidadeDevolver:q,quantidadeRmdf:r,rmdf:r?f.rmdf.value:'nenhum',previsao:q?f.previsao.value:'',protocolo:r?f.protocolo.value.trim():'',observacao:cancelado?'Informação cancelada pelo técnico.':f.observacao.value.trim(),cancelado};
    const erro=m.el.querySelector('[data-erro]');
    if(!cancelado&&(!Number.isInteger(q)||!Number.isInteger(r)||q<0||r<0||q+r===0||q+r>p.quantidade)){erro.textContent='Informe quantidades inteiras positivas, sem ultrapassar o saldo.';return;}
    if(q&&!valores.previsao){erro.textContent='Informe a data prevista de devolução.';return;}
    if(r&&(valores.rmdf==='nenhum'||(valores.rmdf==='aplicado'&&!valores.protocolo))){erro.textContent='Informe a situação e o protocolo do RMDF aplicado.';return;}
    enviando=true;b.disabled=true;
    try{await salvarDeclaracaoTecnico(id,valores,ant?.versao||0);m.fechar();toast(cancelado?'Informação cancelada.':'Informação enviada à operação.');}
    catch(e){erro.textContent=e.code?erroAmigavel(e).message:e.message;enviando=false;b.disabled=false;}
  };
  b.addEventListener('click',()=>salvar());m.el.querySelector('[data-cancelar]')?.addEventListener('click',()=>salvar(true));f.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
async function modalEventosTecnico() {
  if(!perfilTecnico())return;
  const id=Acesso.perfil.tecnicoId, seq=PortalTecnico.sequencia;
  const s=await Acesso.fs.collection('eventos_tecnicos').where('tecnicoId','==',id).get({source:'server'});
  if(!perfilTecnico()||seq!==PortalTecnico.sequencia)return;
  const eventos=s.docs.map(d=>decodificarFS(d.data())).sort((a,b)=>comparar(b.em,a.em));
  abrirModal({titulo:'Meu histórico',subtitulo:'Versões preservadas das suas informações de devolução e RMDF.',largura:'larga',corpo:renderEventosTecnicos(eventos),rodape:'<button class="btn" data-fechar>Fechar</button>'});
}
function renderEventosTecnicos(eventos) {
  return eventos.length?`<ol class="linha-tempo portal-historico">${eventos.map(d=>`<li><span class="lt-quando">${fmtDataHora(d.em)}</span><div><strong>${esc(d.mat)} · ${esc(d.tipo)} · versão ${d.versao}</strong>${descricaoDeclaracaoTecnico(d)}${d.observacao?`<p>${esc(d.observacao)}</p>`:''}<small class="sub-celula">${esc(d.email)} · ${esc(d.tecnicoId)}</small></div></li>`).join('')}</ol>`:vazio('calendario','Nenhuma informação enviada','As alterações e os cancelamentos aparecerão aqui.');
}
const RespostasTecnicos={chave:'',carregando:false,eventos:[],erro:''};
function renderRespostasTecnicos() {
  if(perfilTecnico())return '';
  return `<section class="portal-intro"><span class="sobretitulo">ACOMPANHAMENTO / TÉCNICOS</span><h2>Respostas dos técnicos</h2><p>Últimas 200 alterações de devolução e RMDF. Cada informação é uma declaração do técnico; confira o documento e o recebimento antes de classificar uma saída.</p><button class="btn" data-acao="respostas-atualizar">Atualizar respostas</button></section>${RespostasTecnicos.carregando?'<p role="status">Carregando respostas…</p>':RespostasTecnicos.erro?`<p role="alert">${esc(RespostasTecnicos.erro)}</p>`:renderEventosTecnicos(RespostasTecnicos.eventos)}`;
}
async function carregarRespostasTecnicos() {
  if(perfilTecnico()||Acesso.modo!=='firebase'||RespostasTecnicos.carregando||RespostasTecnicos.chave===String(E.rev))return;
  RespostasTecnicos.carregando=true;RespostasTecnicos.erro='';
  try {
    const s=await Acesso.fs.collection('eventos_tecnicos').orderBy('em','desc').limit(200).get({source:'server'});
    if(perfilTecnico()||!Acesso.perfil?.ativo)return;
    RespostasTecnicos.eventos=s.docs.map(d=>decodificarFS(d.data()));
  }catch(e){RespostasTecnicos.erro='Não foi possível carregar as respostas. Tente atualizar.';}
  finally{RespostasTecnicos.carregando=false;RespostasTecnicos.chave=String(E.rev);if(UI.pagina==='respostas-tecnicos'&&!perfilTecnico())renderizar(true);}
}
