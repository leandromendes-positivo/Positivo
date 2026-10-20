/* Cada pessoa administra somente a própria inscrição. Técnicos não recebem dados da equipe. */
function exigirAcessoLembretesFerias() {
  if(Acesso.modo!=='firebase' || !Acesso.usuario?.uid || !Acesso.perfil?.ativo || !['usuario','administrador'].includes(Acesso.perfil.perfil))throw new Error('Entre com um acesso autorizado à gestão de férias para cadastrar seus lembretes.');
}
async function salvarLembretesFerias(email,ativo,versao,horario='07:55',antecedencia=10) {
  exigirAcessoLembretesFerias();
  email=String(email||'').trim().toLowerCase();
  if(!emailValido(email) || typeof ativo!=='boolean')throw new Error('Informe um único endereço de e-mail válido.');
  if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(horario)||!Number.isInteger(antecedencia)||antecedencia<1||antecedencia>90)throw new Error('Escolha um horário válido e antecedência de 1 a 90 dias.');
  const {uid,email:titular}=identidadeAtual(),ref=Acesso.fs.doc(`lembretes_ferias/${uid}`);
  await Acesso.fs.runTransaction(async tx=>{
    const s=await tx.get(ref),ant=s.data();
    if((ant?.versao||0)!==versao)throw new Error('Esta inscrição mudou em outra aba. Feche e abra os lembretes novamente.');
    tx.set(ref,{uid,titular,email,ativo,horario,antecedencia,versao:versao+1,criadoEm:ant?.criadoEm||carimboServidor(),atualizadoEm:carimboServidor()});
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
  const m=abrirModal({titulo:'Lembretes de férias por e-mail',subtitulo:'Escolha quando deseja receber os avisos de saída da equipe.',corpo:`<form class="form" id="lembretes-ferias-form"><label class="campo"><span>E-mail para receber os lembretes</span><input type="email" name="email" required maxlength="254" autocomplete="email" value="${esc(d?.email||identidadeAtual().email)}"><small>Cadastre um único endereço. Sua inscrição não fica visível para os demais usuários.</small></label><label class="campo"><span>Horário de envio · Brasília</span><input type="time" name="horario" required value="${esc(d?.horario||'07:55')}"></label><label class="campo"><span>Quantos dias antes da saída?</span><input type="number" name="antecedencia" min="1" max="90" step="1" required value="${d?.antecedencia||10}"></label><label class="check-inline"><input type="checkbox" name="ativo" ${d?.ativo===false?'':'checked'}>Quero receber os lembretes de férias da equipe</label><p class="nota">A verificação acontece todos os dias, inclusive aos finais de semana. O aviso considera a antecedência escolhida, em dias corridos, antes de cada período e informa colaborador, UF, saída e retorno. Férias canceladas e colaboradores retirados da lista não geram aviso.</p><p class="nota">Se você se inscrever ou uma data mudar dentro da antecedência escolhida, o lembrete será incluído na próxima verificação, antes da saída. Repetições da mesma saída não são reenviadas para o mesmo e-mail.</p><p class="lembretes-ferias-situacao" role="status">${config?.habilitado?(config.ultimaExecucaoSemFalhas===false?'O serviço está disponível, mas a administração precisa conferir falhas no último processamento.':'Serviço de e-mail disponível.'):'O serviço de e-mail aguarda configuração. Você pode salvar sua inscrição; os envios começarão quando o serviço estiver disponível.'}${d?`<br>Sua inscrição está ${d.ativo?'ativa':'desativada'}.`:''}</p><p class="nota">O agendamento solicita verificações a cada cinco minutos após o horário escolhido. O GitHub pode atrasá-las por mais tempo; o teste fica na fila até uma execução. O teste independe desse horário. Salve as alterações antes de testar.</p><p data-lembretes-teste role="status"></p><p class="nota" data-lembretes-fila hidden>Se a fila demorar, o responsável pelo repositório pode <a href="https://github.com/leandromendes-positivo/Positivo/actions/workflows/lembretes-ferias.yml" target="_blank" rel="noopener noreferrer">abrir o agendador no GitHub</a> e clicar em Run workflow → Run workflow para processá-la agora.</p><p data-lembretes-erro role="alert"></p></form>`,rodape:`<button class="btn" data-fechar>Fechar</button>${d?.ativo?'<button class="btn" data-lembretes-parar>Desativar lembretes</button>':''}${d?'<button class="btn" data-lembretes-testar>Enviar e-mail de teste</button>':''}<button class="btn prim" data-lembretes-salvar>Salvar lembretes</button>`});
  const f=m.el.querySelector('form'),b=m.el.querySelector('[data-lembretes-salvar]');let salvando=false;
  const salvar=async(parar=false)=>{
    if(salvando || (!parar&&!f.reportValidity()))return;
    salvando=true;b.disabled=true;
    try{await salvarLembretesFerias(parar?d.email:f.email.value,parar?false:f.ativo.checked,d?.versao||0,parar?(d.horario||'07:55'):f.horario.value,parar?(d.antecedencia||10):Number(f.antecedencia.value));m.fechar();toast(parar?'Lembretes de férias desativados.':config?.habilitado?'Preferências de lembretes salvas.':'Inscrição salva. O serviço de e-mail ainda aguarda configuração.');}
    catch(e){m.el.querySelector('[data-lembretes-erro]').textContent=e.code?erroAmigavel(e).message:e.message;salvando=false;b.disabled=false;}
  };
  const teste=Acesso.fs.doc(`testes_lembretes_ferias/${uid}`),bt=m.el.querySelector('[data-lembretes-testar]'),status=m.el.querySelector('[data-lembretes-teste]');
  const textos={enviado:'E-mail de teste aceito pelo servidor. Confira a caixa de entrada e o spam.',falhou:'O teste falhou. A administração precisa conferir o remetente.',indisponivel:'Remetente indisponível: configure GMAIL_USUARIO e GMAIL_SENHA_APP nos Secrets do GitHub.',em_envio:'Teste em processamento. Aguarde a confirmação.',incerto:'Resultado do teste não confirmado. Confira sua caixa de entrada antes de solicitar outro envio.'};
  const cancelar=teste.onSnapshot(s=>{
    if(!m.el.isConnected||Acesso.usuario?.uid!==uid)return;
    const t=s.data();m.el.querySelector('[data-lembretes-fila]').hidden=!t||!!t.estado;status.textContent=t?(textos[t.estado]||'Teste solicitado e aguardando na fila. O envio ainda não começou.')+(t.atualizadoEm?' · '+new Date(t.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''):'';
    if(t?.codigo==='EENVELOPE')status.textContent+=' O servidor recusou o endereço destinatário. Confira o e-mail cadastrado.';
    if(t?.codigo==='EAUTH')status.textContent+=' O remetente não conseguiu autenticar.';
    if(!t?.estado&&config?.ultimoProcessamento)status.textContent+=' Última verificação: '+new Date(config.ultimoProcessamento).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.';
    if(bt)bt.disabled=!!t&&!['enviado','falhou','indisponivel'].includes(t.estado);
  },()=>{status.textContent='Não foi possível consultar o resultado do teste.';});
  const fechar=m.fechar;m.fechar=()=>{cancelar();fechar();};
  const vigiar=setInterval(()=>{if(!m.el.isConnected){cancelar();clearInterval(vigiar);}},1000);
  bt?.addEventListener('click',async()=>{
    bt.disabled=true;
    try{exigirAcessoLembretesFerias();await teste.set({uid,pedido:crypto.randomUUID(),solicitadoEm:carimboServidor()});status.textContent='Teste solicitado e aguardando na fila. O envio ainda não começou.';}
    catch(e){status.textContent='Não foi possível solicitar o teste. Aguarde ao menos um minuto entre testes e confira sua inscrição.';bt.disabled=false;}
  });
  b.addEventListener('click',()=>salvar());m.el.querySelector('[data-lembretes-parar]')?.addEventListener('click',()=>salvar(true));f.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
