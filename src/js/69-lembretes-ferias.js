/* Cada pessoa administra somente a própria inscrição. Técnicos não recebem dados da equipe. */
function exigirAcessoLembretesFerias() {
  if(Acesso.modo!=='firebase' || !Acesso.usuario?.uid || !Acesso.perfil?.ativo || !['usuario','administrador'].includes(Acesso.perfil.perfil))throw new Error('Entre com um acesso autorizado à gestão de férias para cadastrar seus lembretes.');
}
async function salvarLembretesFerias(email,ativo,versao) {
  exigirAcessoLembretesFerias();
  email=String(email||'').trim().toLowerCase();
  if(!emailValido(email) || typeof ativo!=='boolean')throw new Error('Informe um único endereço de e-mail válido.');
  const {uid,email:titular}=identidadeAtual(),ref=Acesso.fs.doc(`lembretes_ferias/${uid}`);
  await Acesso.fs.runTransaction(async tx=>{
    const s=await tx.get(ref),ant=s.data();
    if((ant?.versao||0)!==versao)throw new Error('Esta inscrição mudou em outra aba. Feche e abra os lembretes novamente.');
    tx.set(ref,{uid,titular,email,ativo,versao:versao+1,criadoEm:ant?.criadoEm||carimboServidor(),atualizadoEm:carimboServidor()});
  });
}
async function modalLembretesFerias() {
  if(Acesso.modo!=='firebase'){
    abrirModal({titulo:'Lembretes por e-mail',corpo:'<p>Entre no painel conectado ao Firebase para cadastrar seu e-mail e receber os avisos automáticos.</p>',rodape:'<button class="btn" data-fechar>Fechar</button>'});return;
  }
  exigirAcessoLembretesFerias();
  const uid=Acesso.usuario.uid;
  const [inscricao,servico]=await Promise.all([Acesso.fs.doc(`lembretes_ferias/${uid}`).get({source:'server'}),Acesso.fs.doc('servicos/lembretes-ferias').get({source:'server'})]);
  exigirAcessoLembretesFerias();if(uid!==Acesso.usuario.uid)return;
  const d=inscricao.data(),config=servico.data();
  const m=abrirModal({titulo:'Lembretes de férias por e-mail',subtitulo:'Receba os avisos de saída da equipe com 10 dias de antecedência.',corpo:`<form class="form" id="lembretes-ferias-form"><label class="campo"><span>E-mail para receber os lembretes</span><input type="email" name="email" required maxlength="254" autocomplete="email" value="${esc(d?.email||identidadeAtual().email)}"><small>Cadastre um único endereço. Sua inscrição não fica visível para os demais usuários.</small></label><label class="check-inline"><input type="checkbox" name="ativo" ${d?.ativo===false?'':'checked'}>Quero receber os lembretes de férias da equipe</label><p class="nota">A verificação acontece todos os dias, inclusive aos finais de semana. O aviso considera 10 dias corridos antes de cada período e informa colaborador, UF, saída e retorno. Férias canceladas e colaboradores retirados da lista não geram aviso.</p><p class="nota">Se você se inscrever ou uma data mudar faltando menos de 10 dias, o lembrete será incluído na próxima verificação, antes da saída. Repetições da mesma saída não são reenviadas para o mesmo e-mail.</p><p class="lembretes-ferias-situacao" role="status">${config?.habilitado?(config.ultimaExecucaoSemFalhas===false?'O serviço está disponível, mas a administração precisa conferir falhas no último processamento.':'Serviço de e-mail disponível.'):'O serviço de e-mail aguarda configuração. Você pode salvar sua inscrição; os envios começarão quando o serviço estiver disponível.'}${d?`<br>Sua inscrição está ${d.ativo?'ativa':'desativada'}.`:''}</p><p data-lembretes-erro role="alert"></p></form>`,rodape:`<button class="btn" data-fechar>Fechar</button>${d?.ativo?'<button class="btn" data-lembretes-parar>Desativar lembretes</button>':''}<button class="btn prim" data-lembretes-salvar>Salvar lembretes</button>`});
  const f=m.el.querySelector('form'),b=m.el.querySelector('[data-lembretes-salvar]');let salvando=false;
  const salvar=async(parar=false)=>{
    if(salvando || (!parar&&!f.reportValidity()))return;
    salvando=true;b.disabled=true;
    try{await salvarLembretesFerias(parar?d.email:f.email.value,parar?false:f.ativo.checked,d?.versao||0);m.fechar();toast(parar?'Lembretes de férias desativados.':config?.habilitado?'Preferências de lembretes salvas.':'Inscrição salva. O serviço de e-mail ainda aguarda configuração.');}
    catch(e){m.el.querySelector('[data-lembretes-erro]').textContent=e.code?erroAmigavel(e).message:e.message;salvando=false;b.disabled=false;}
  };
  b.addEventListener('click',()=>salvar());m.el.querySelector('[data-lembretes-parar]')?.addEventListener('click',()=>salvar(true));f.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
