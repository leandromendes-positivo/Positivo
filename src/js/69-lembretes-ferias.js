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
  let d=inscricao.data();
  const config=servico.data();
  const m=abrirModal({titulo:'Lembretes de férias por e-mail',subtitulo:'Escolha quando deseja receber os avisos de saída da equipe.',corpo:`<form class="form" id="lembretes-ferias-form"><label class="campo"><span>E-mail para receber os lembretes</span><input type="email" name="email" required maxlength="254" autocomplete="email" value="${esc(d?.email||identidadeAtual().email)}"><small>Cadastre um único endereço. Sua inscrição não fica visível para os demais usuários.</small></label><label class="campo"><span>Horário de envio · Brasília</span><span class="lembretes-horario"><input type="text" name="horario" inputmode="numeric" autocomplete="off" spellcheck="false" required maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="07:55" aria-describedby="lembretes-horario-ajuda" title="Informe um horário entre 00:00 e 23:59." value="${esc(d?.horario||'07:55')}"><button type="button" class="btn-icone" data-horario-abrir aria-label="Selecionar horário" aria-haspopup="dialog" aria-expanded="false">${icone('relogio')}</button></span><small id="lembretes-horario-ajuda">Selecione no relógio ou digite no formato 07:55.</small></label><label class="campo"><span>Quantos dias antes da saída?</span><input type="number" name="antecedencia" min="1" max="90" step="1" required value="${d?.antecedencia||10}"></label><label class="check-inline"><input type="checkbox" name="ativo" ${d?.ativo===false?'':'checked'}>Quero receber os lembretes de férias da equipe</label><p class="nota">A verificação acontece todos os dias, inclusive aos finais de semana. O aviso considera a antecedência escolhida, em dias corridos, antes de cada período e informa colaborador, UF, saída e retorno. Férias canceladas e colaboradores retirados da lista não geram aviso.</p><p class="nota">Se você se inscrever ou uma data mudar dentro da antecedência escolhida, o lembrete será incluído na próxima verificação, antes da saída. Repetições da mesma saída não são reenviadas para o mesmo e-mail.</p><p class="lembretes-ferias-situacao" role="status">${config?.habilitado?(config.ultimaExecucaoSemFalhas===false?'O serviço está disponível, mas a administração precisa conferir falhas no último processamento.':'Serviço de e-mail disponível.'):'O serviço de e-mail aguarda configuração. Você pode salvar sua inscrição; os envios começarão quando o serviço estiver disponível.'}${d?`<br>Sua inscrição está ${d.ativo?'ativa':'desativada'}.`:''}</p><p class="nota">${config?.executor==='cloudflare'?'O Cloudflare verifica os lembretes a cada minuto após o horário escolhido. O teste solicita o envio imediatamente; a chegada à caixa de entrada depende do provedor.':'O agendamento solicita verificações a cada cinco minutos após o horário escolhido. O GitHub pode atrasá-las por mais tempo; o teste fica na fila até uma execução.'} O teste independe desse horário. Ao enviar o teste, o e-mail e as preferências acima serão salvos automaticamente.</p><p class="nota" data-lembretes-fila hidden>Se a fila demorar, o responsável pelo repositório pode <a href="https://github.com/leandromendes-positivo/Positivo/actions/workflows/lembretes-ferias.yml" target="_blank" rel="noopener noreferrer">abrir o agendador no GitHub</a> e clicar em Run workflow → Run workflow para processá-la agora.</p><p data-lembretes-erro role="alert"></p></form>`,rodape:`<p data-lembretes-teste role="status" aria-live="polite" class="lembretes-ferias-retorno">Consultando o último teste…</p><p data-lembretes-acao role="alert" class="lembretes-ferias-retorno"></p><button class="btn" data-fechar>Fechar</button><button class="btn" data-lembretes-excluir ${d?'':'hidden'}>Descadastrar e-mail</button><button class="btn" data-lembretes-testar disabled>Enviar e-mail de teste</button><button class="btn prim" data-lembretes-salvar>Salvar lembretes</button>`});
  const f=m.el.querySelector('form'),acao=m.el.querySelector('[data-lembretes-acao]'),b=m.el.querySelector('[data-lembretes-salvar]');let salvando=false;
  const ajustarHorario=()=>{
    const valor=f.horario.value.trim();
    f.horario.value=/^\d{3,4}$/.test(valor)?valor.padStart(4,'0').replace(/(\d{2})(\d{2})/,'$1:$2'):/^\d:[0-5]\d$/.test(valor)?'0'+valor:valor;
  };
  f.horario.addEventListener('blur',ajustarHorario);
  m.el.querySelector('[data-horario-abrir]').addEventListener('click',e=>{ajustarHorario();abrirSeletorHorario(f.horario,e.currentTarget);});
  const salvar=async(parar=false)=>{
    ajustarHorario();
    if(salvando || (!parar&&!f.reportValidity()))return;
    salvando=true;b.disabled=true;
    try{await salvarLembretesFerias(parar?d.email:f.email.value,parar?false:f.ativo.checked,d?.versao||0,parar?(d.horario||'07:55'):f.horario.value,parar?(d.antecedencia||10):Number(f.antecedencia.value));m.fechar();toast(parar?'Lembretes de férias desativados.':config?.habilitado?'Preferências de lembretes salvas.':'Inscrição salva. O serviço de e-mail ainda aguarda configuração.');}
    catch(e){acao.textContent=e.code?erroAmigavel(e).message:e.message;salvando=false;b.disabled=false;}
  };
  const teste=Acesso.fs.doc(`testes_lembretes_ferias/${uid}`),bt=m.el.querySelector('[data-lembretes-testar]'),status=m.el.querySelector('[data-lembretes-teste]');
  let testeConsultado=false,testePendente=false;
  const atualizarBotaoTeste=()=>{bt.disabled=salvando||!testeConsultado||testePendente;};
  const textos={enviado:'E-mail de teste aceito pelo servidor. Confira a caixa de entrada e o spam.',falhou:'O teste falhou. A administração precisa conferir o remetente.',indisponivel:'Remetente indisponível. A administração precisa conferir a configuração do serviço de e-mail.',em_envio:'Teste em processamento. Aguarde a confirmação.',incerto:'Resultado do teste não confirmado. Confira sua caixa de entrada antes de solicitar outro envio.'};
  const cancelar=teste.onSnapshot(s=>{
    if(!m.el.isConnected||Acesso.usuario?.uid!==uid)return;
    const t=s.data();testeConsultado=true;testePendente=!!t&&!['enviado','falhou','indisponivel'].includes(t.estado);m.el.querySelector('[data-lembretes-fila]').hidden=config?.executor==='cloudflare'||!t||!!t.estado;status.textContent=t?(textos[t.estado]||'Teste solicitado e aguardando na fila. O envio ainda não começou.')+(t.atualizadoEm?' · '+new Date(t.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''):'Nenhum teste solicitado. Informe o e-mail e clique em Enviar e-mail de teste.';
    if(t?.codigo==='EENVELOPE')status.textContent+=' O servidor recusou o endereço destinatário. Confira o e-mail cadastrado.';
    if(t?.codigo==='EAUTH')status.textContent+=' O remetente não conseguiu autenticar.';
    if(t&&!t.estado&&config?.ultimoProcessamento)status.textContent+=' Última verificação: '+new Date(config.ultimoProcessamento).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.';
    atualizarBotaoTeste();
  },()=>{testeConsultado=false;atualizarBotaoTeste();status.textContent='Não foi possível consultar o resultado do teste. Feche e abra os lembretes para tentar novamente.';});
  const fechar=m.fechar;m.fechar=()=>{cancelar();fechar();};
  const vigiar=setInterval(()=>{if(!m.el.isConnected){cancelar();clearInterval(vigiar);}},1000);
  bt?.addEventListener('click',async()=>{
    if(salvando||!testeConsultado||testePendente)return;
    ajustarHorario();if(!f.reportValidity())return;
    const preferencias={email:f.email.value.trim().toLowerCase(),ativo:f.ativo.checked,horario:f.horario.value,antecedencia:Number(f.antecedencia.value)};
    const controles=[...f.querySelectorAll('input,button')].map(el=>[el,el.disabled]);
    salvando=true;b.disabled=true;atualizarBotaoTeste();controles.forEach(([el])=>el.disabled=true);
    acao.textContent='Salvando o e-mail e solicitando o teste…';
    try{
      exigirAcessoLembretesFerias();if(Acesso.usuario.uid!==uid)throw new Error('Sua sessão mudou. Reabra os lembretes.');
      if(!d||Object.entries(preferencias).some(([chave,valor])=>valor!==d[chave])){
        await salvarLembretesFerias(preferencias.email,preferencias.ativo,d?.versao||0,preferencias.horario,preferencias.antecedencia);
        d={...d,...preferencias,versao:(d?.versao||0)+1};
        m.el.querySelector('[data-lembretes-excluir]').hidden=false;
        m.el.querySelector('.lembretes-ferias-situacao').textContent=(config?.habilitado?'Serviço de e-mail disponível. ':'O serviço de e-mail aguarda configuração. ')+'Preferências salvas. Sua inscrição está '+(d.ativo?'ativa.':'desativada.');
      }
      exigirAcessoLembretesFerias();if(Acesso.usuario.uid!==uid)throw new Error('Sua sessão mudou. Reabra os lembretes.');
      await teste.set({uid,pedido:crypto.randomUUID(),solicitadoEm:carimboServidor()});if(config?.executor==='cloudflare'){
      acao.textContent='Solicitando o envio ao Cloudflare…';
      try{
        const endpoint=new URL(config.endpointTeste);
        if(endpoint.protocol!=='https:'||endpoint.pathname!=='/testar'||endpoint.search||endpoint.hash||endpoint.username||endpoint.password)throw new Error('Configuração inválida');
        const usuario=Acesso.auth.currentUser;
        if(usuario?.uid!==uid)throw new Error('Sessão alterada');
        const token=await usuario.getIdToken();
        exigirAcessoLembretesFerias();if(Acesso.usuario.uid!==uid)throw new Error('Sessão alterada');
        const resposta=await fetch(endpoint.href,{method:'POST',headers:{Authorization:'Bearer '+token},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
        acao.textContent=resposta.ok?'Solicitação processada. Confira o resultado do teste.':'Não foi possível confirmar o envio imediato. O Cloudflare tentará processar o pedido na próxima verificação; acompanhe o status.';
      }catch{acao.textContent='Não foi possível confirmar o envio imediato. Acompanhe o status; o pedido permanece registrado para a próxima verificação do Cloudflare.';}
    }else{acao.textContent='Pedido registrado. Aguarde o processamento da fila.';toast('Teste registrado. Aguarde o processamento.');}}
    catch(e){acao.textContent=e.code==='permission-denied'?'Pedido não autorizado. Aguarde um minuto entre testes concluídos ou verifique se há um teste pendente.':e.code?erroAmigavel(e).message:e.message;toast(acao.textContent);}
    finally{salvando=false;b.disabled=false;controles.forEach(([el,disabled])=>el.disabled=disabled);atualizarBotaoTeste();}
  });
  m.el.querySelector('[data-lembretes-excluir]')?.addEventListener('click',async()=>{
    if(salvando)return;salvando=true;
    const excluir=m.el.querySelector('[data-lembretes-excluir]');excluir.disabled=true;acao.textContent='Descadastrando e-mail…';
    try{
      exigirAcessoLembretesFerias();
      await Acesso.fs.runTransaction(async tx=>{
        const ref=Acesso.fs.doc(`lembretes_ferias/${uid}`),atual=await tx.get(ref),pedido=await tx.get(teste);
        if((atual.data()?.versao||0)!==(d?.versao||0))throw new Error('O cadastro mudou. Feche e abra os lembretes novamente.');
        tx.delete(ref);
        if(pedido.exists&&!['em_envio','incerto'].includes(pedido.data().estado))tx.delete(teste);
      });
      m.fechar();toast('E-mail descadastrado. Mensagens já em processamento podem concluir o envio.');
    }catch(e){acao.textContent=e.code?erroAmigavel(e).message:e.message;salvando=false;excluir.disabled=false;}
  });
  b.addEventListener('click',()=>salvar());f.addEventListener('submit',e=>{e.preventDefault();salvar();});
}

function abrirSeletorHorario(campo,botao){
  if(botao.getAttribute('aria-expanded')==='true')return;
  const pad=n=>String(n).padStart(2,'0');
  let [hora,minuto]=(/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(campo.value)?campo.value:'07:55').split(':').map(Number),etapa='hora';
  const seletor=abrirModal({titulo:'Selecionar horário',subtitulo:'Horário de Brasília · formato de 24 horas',largura:'calendario horario-seletor',
    corpo:`<div class="horario-previa" aria-live="polite"></div><div class="horario-etapas"><button type="button" class="btn" data-horario-etapa="hora">Horas</button><button type="button" class="btn" data-horario-etapa="minuto">Minutos</button></div><div class="horario-grade" role="group"></div>`,
    rodape:'<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn prim" data-horario-confirmar>Confirmar horário</button>',
    aoFechar:()=>{botao.setAttribute('aria-expanded','false');botao.removeAttribute('aria-controls');}});
  seletor.el.classList.add('calendario-fundo');
  botao.setAttribute('aria-expanded','true');
  const janela=seletor.el.querySelector('.horario-seletor');janela.id='horario-dialog-'+crypto.randomUUID();botao.setAttribute('aria-controls',janela.id);
  const grade=seletor.el.querySelector('.horario-grade');
  function desenhar(focar=false){
    seletor.el.querySelector('.horario-previa').textContent=pad(hora)+':'+pad(minuto);
    seletor.el.querySelectorAll('[data-horario-etapa]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.horarioEtapa===etapa)));
    const atual=etapa==='hora'?hora:minuto,total=etapa==='hora'?24:60;
    grade.setAttribute('aria-label',etapa==='hora'?'Escolha a hora':'Escolha os minutos');
    grade.innerHTML=Array.from({length:total},(_,n)=>`<button type="button" class="calendario-dia" data-horario-valor="${n}" aria-label="${pad(n)} ${etapa==='hora'?'horas':'minutos'}" aria-pressed="${n===atual}" tabindex="${n===atual?0:-1}">${pad(n)}</button>`).join('');
    const selecionado=grade.querySelector('[aria-pressed="true"]');
    if(focar)selecionado.focus({preventScroll:true});
    grade.scrollTop=Math.max(0,selecionado.offsetTop-grade.firstElementChild.offsetTop-grade.clientHeight/2+selecionado.offsetHeight/2);
  }
  seletor.el.querySelectorAll('[data-horario-etapa]').forEach(b=>b.addEventListener('click',()=>{etapa=b.dataset.horarioEtapa;desenhar(true);}));
  grade.addEventListener('click',e=>{
    const b=e.target.closest('[data-horario-valor]');if(!b)return;
    if(etapa==='hora'){hora=Number(b.dataset.horarioValor);etapa='minuto';}else minuto=Number(b.dataset.horarioValor);
    desenhar(true);
  });
  grade.addEventListener('keydown',e=>{
    const b=e.target.closest('[data-horario-valor]');if(!b)return;
    const n=Number(b.dataset.horarioValor),total=etapa==='hora'?24:60;
    const destino={ArrowLeft:n-1,ArrowRight:n+1,ArrowUp:n-6,ArrowDown:n+6,Home:0,End:total-1}[e.key];
    if(destino===undefined)return;e.preventDefault();
    const proximo=grade.querySelector(`[data-horario-valor="${Math.max(0,Math.min(total-1,destino))}"]`);
    grade.querySelectorAll('button').forEach(x=>x.tabIndex=-1);proximo.tabIndex=0;proximo.focus();
  });
  seletor.el.querySelector('[data-horario-confirmar]').addEventListener('click',()=>{
    if(campo.isConnected){campo.value=pad(hora)+':'+pad(minuto);campo.dispatchEvent(new Event('input',{bubbles:true}));campo.dispatchEvent(new Event('change',{bubbles:true}));}
    seletor.fechar();
  });
  desenhar();
  grade.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
}
