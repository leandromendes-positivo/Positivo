// Resultados transitórios em memória; nunca usar localStorage/Firestore para senhas.
const UIenviosAcesso={uid:'',itens:new Map()};
function resultadosEnviosAcesso(){
  if(UIenviosAcesso.uid!==Acesso.usuario?.uid){UIenviosAcesso.uid=Acesso.usuario?.uid||'';UIenviosAcesso.itens.clear();}
  return UIenviosAcesso.itens;
}
function avisoEnviosAcesso(){
  return [...resultadosEnviosAcesso().values()].slice(-5).reverse().map(r=>`<section class="usuarios-envio ${r.estado}" role="${r.estado==='erro'?'alert':'status'}" aria-live="polite"><div><strong>${r.estado==='enviando'?'Cadastro salvo · enviando senha temporária':r.estado==='enviado'?'Cadastro salvo · e-mail aceito pelo provedor':r.estado==='sem-envio'?'Cadastro salvo · sem alteração de senha':'Cadastro salvo · envio não confirmado'}</strong><p>${esc(r.email)}</p><p>${esc(r.mensagem)}</p></div>${r.acesso?`<button class="btn pequeno" data-acao="ver-acesso-gerado" data-email="${esc(r.email)}">Ver link e senha temporária</button>`:''}${r.estado==='erro'?`<button class="btn pequeno" data-acao="enviar-senha-usuario" data-email="${esc(r.email)}">Tentar enviar senha</button>`:''}</section>`).join('');
}
function atualizarEnviosAcesso(){if(podeAdministrar()&&UI.pagina==='usuarios')renderizar(true);}
async function enviarSenhaUsuario(email,confirmada=false,operacao=crypto.randomUUID()){
  exigirAdministrador();email=String(email||'').trim().toLowerCase();
  if(resultadosEnviosAcesso().get(email)?.estado==='enviando')return;
  if(!confirmada)await confirmarAdministradorSenha();
  if(resultadosEnviosAcesso().get(email)?.estado==='enviando')return;
  const uid=Acesso.usuario?.uid,r={email,estado:'enviando',mensagem:'O envio é direto pelo Cloudflare. Aguarde a confirmação; não é preciso salvar novamente.',operacao};
  resultadosEnviosAcesso().set(email,r);atualizarEnviosAcesso();
  try{
    if(Acesso.usuario?.uid!==uid)throw new Error('Sua sessão mudou. Entre novamente.');
    const d=await solicitarConta('temporaria',{email,operacao},true,60000);
    if(d.enviado!==true&&d.gerado!==true)throw new Error('O serviço não confirmou a geração do acesso.');
    r.estado=d.enviado?'enviado':'erro';r.mensagem=d.enviado?'Confira a caixa de entrada e o spam. A senha temporária vale por 24 horas.':'A senha foi gerada, mas o Gmail não confirmou o envio. Confira as credenciais de envio no Cloudflare. Você pode compartilhar os dados manualmente.';
    if(Acesso.usuario?.uid!==uid||!podeAdministrar())return;
    if(d.senhaTemporaria){
      r.acesso=d;
      setTimeout(()=>{delete r.acesso;if(Acesso.usuario?.uid===uid)atualizarEnviosAcesso();},5*60000);
      mostrarAcessoGerado({...d});
    }else{
      r.estado='erro';r.mensagem='O serviço respondeu sem a senha temporária. Confira se a publicação do Worker no Cloudflare concluiu com a mesma versão do painel. A senha anterior não pode ser recuperada; após atualizar o Worker, gere uma nova.';
    }

  }catch(e){r.estado='erro';r.mensagem=e.message+' Confira a caixa de entrada e o spam antes de tentar gerar outra senha.';}
  if(Acesso.usuario?.uid===uid)atualizarEnviosAcesso();
}
// Somente a senha recém-gerada é exibida; não é gravada no armazenamento do navegador.
function mostrarAcessoGerado(d){
  const link=new URL(d.link);if(link.protocol!=='https:')return;
  const m=abrirModal({administrativo:true,titulo:'Acesso gerado',subtitulo:d.enviado?'E-mail aceito pelo provedor. Os dados também estão disponíveis para envio manual.':'E-mail não confirmado. Compartilhe o acesso manualmente e confira o Gmail no Cloudflare.',
    corpo:`<div class="form"><label class="campo"><span>E-mail do colaborador</span><input readonly value="${esc(d.email)}"></label><label class="campo"><span>Link do painel</span><input readonly value="${esc(link.href)}"></label><label class="campo"><span>Senha temporária</span><input readonly autocomplete="off" value="${esc(d.senhaTemporaria)}"></label><p>Válida por 24 horas. O colaborador deverá trocar a senha no primeiro acesso. Ao fechar esta tela, a senha não poderá ser consultada novamente.</p><p data-copia role="status"></p></div>`,rodape:'<button class="btn" data-fechar>Fechar</button><button class="btn prim" data-copiar>Copiar dados de acesso</button>',aoFechar:()=>{d.senhaTemporaria='';m.el.querySelectorAll('input').forEach(i=>i.value='');}});
  m.el.querySelector('[data-copiar]').onclick=async()=>{try{exigirAdministrador();await navigator.clipboard.writeText(`Acesso ao painel Positivo\n${link.href}\nE-mail: ${d.email}\nSenha temporária: ${d.senhaTemporaria}\nVálida por 24 horas. Troque a senha no primeiro acesso.`);m.el.querySelector('[data-copia]').textContent='Dados copiados.';}catch{m.el.querySelector('[data-copia]').textContent='Selecione os campos e copie manualmente.';}};
}
/* Gestão de acessos: somente administradores; o perfil vem do banco protegido. */
function renderUsuarios() {
  if (!podeAdministrar()) return vazio('pessoa','Acesso restrito','O cadastro de usuários é exclusivo de administradores.');
  if (Acesso.modo !== 'firebase') return vazio('info','Conecte o Firebase','Os acessos são gerenciados no banco autenticado. A demonstração não libera contas reais.');
  const lista = [...E.usuarios].sort((a,b) => Number(b.principal)-Number(a.principal) || comparar(a.email,b.email));
  return `${avisoEnviosAcesso()}<section class="usuarios-intro"><div><span class="sobretitulo">ADMINISTRAÇÃO / ACESSOS</span><h2>As pessoas da operação</h2><p>Autorize cada endereço e escolha o que a pessoa pode fazer.</p></div><button class="btn prim" data-acao="novo-usuario">${icone('mais')}Cadastrar usuário</button><button class="btn" data-acao="novo-acesso-tecnico">Cadastrar técnico</button>${imagemCabecalho()}</section>
    <div class="perfis-grade"><article>${icone('pessoa')}<h3>Usuário</h3><p>Consulta peças e indicadores, agenda devoluções e registra contatos e observações.</p></article><article>${icone('ajustes')}<h3>Administrador</h3><p>Também importa planilhas, edita técnicos e regras, classifica saídas e gerencia acessos.</p></article><article>${icone('caixa')}<h3>Técnico</h3><p>Acessa exclusivamente as próprias peças e informa devolução e RMDF. Exige vínculo explícito com técnico e UF.</p></article></div>
    <div class="usuarios-resumo"><span><strong>${lista.filter(u=>u.ativo).length}</strong> acessos ativos</span><span><strong>${lista.filter(u=>u.ativo&&u.perfil==='administrador').length}</strong> administradores</span><span><strong>${lista.filter(u=>!u.ativo).length}</strong> desativados</span></div>
    ${lista.length ? `<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Pessoa / e-mail autorizado</th><th>Perfil</th><th>Acesso</th><th>Última alteração</th><th></th></tr></thead><tbody>${lista.map(u=>`<tr><td><span class="celula-tec">${avatar(nomeDaConta(u,u.email))}<span><strong>${esc(nomeDaConta(u,u.email))}</strong><small class="sub-celula">${esc(u.email)}</small></span></span></td><td>${pill(u.perfil==='administrador'?'info':'neutro',u.principal?'Administrador principal':PERFIS[u.perfil])}${u.tecnicoId?`<small class="sub-celula">Estoque: ${esc(u.tecnicoId)}</small>`:''}</td><td>${pill(u.ativo?'ok':'grave',u.ativo?'Ativo':'Desativado')}</td><td>${u.atualizadoEm?fmtDataHora(u.atualizadoEm):'—'}<small class="sub-celula">${esc(u.atualizadoPor?.email ? primeiroNomeEmail(u.atualizadoPor.email) : 'Configuração inicial')}</small></td><td><button class="btn pequeno" data-acao="editar-usuario" data-email="${esc(u.email)}">${u.principal || u.email === Acesso.usuario?.email?.toLowerCase() ? 'Ver acesso' : 'Gerenciar'}</button>${u.ativo&&!u.principal&&u.email!==Acesso.usuario?.email?.toLowerCase()?`<button class="btn pequeno" data-acao="enviar-senha-usuario" data-email="${esc(u.email)}" ${resultadosEnviosAcesso().get(u.email)?.estado==='enviando'?'disabled':''}>Enviar senha temporária</button>`:''}</td></tr>`).join('')}</tbody></table></div>` : vazio('pessoas','Carregando acessos','Os cadastros aparecerão aqui.')}
    <p class="nota usuarios-nota">A desativação bloqueia novas leituras e gravações, inclusive em uma sessão já aberta. O administrador principal permanece protegido para evitar que a equipe perca o acesso.</p>`;
}
function modalUsuario(email = '', perfilInicial = 'usuario') {
  exigirAdministrador();
  const u = E.usuarios.find(u=>u.email===email);
  if (email && !u) { toast('O cadastro não está disponível. Atualize a lista antes de continuar.', 'info'); return; }
  const protegido = u?.principal || email === Acesso.usuario?.email?.toLowerCase();
  const m = abrirModal({ administrativo: true, titulo: protegido ? 'Acesso protegido' : u ? 'Gerenciar acesso' : 'Cadastrar usuário', subtitulo: 'Cadastre o e-mail e defina as permissões do colaborador.',
    corpo: `<form class="form" id="usuario-form"><label class="campo"><span>Nome do colaborador</span><input type="text" name="nome" maxlength="80" autocomplete="name" value="${esc(u?.nome||'')}" ${protegido?'readonly':''} placeholder="Nome completo"><small>Opcional. Se deixar vazio, o nome atual será mantido.</small></label><label class="campo"><span>E-mail autorizado</span><input type="email" name="email" required maxlength="254" autocomplete="off" ${u?'readonly':''} value="${esc(email)}" autofocus><small>Use o endereço corporativo exato da pessoa.</small></label><label class="campo"><span>Perfil de acesso</span><select name="perfil" ${protegido?'disabled':''}>${Object.entries(PERFIS).map(([v,n])=>`<option value="${v}" ${(u?.perfil||perfilInicial)===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="campo" data-vinculo><span>Técnico / UF do estoque</span><select name="tecnicoId" ${protegido?'disabled':''}><option value="">Selecione o cadastro correspondente</option>${u?.tecnicoId?`<option value="${esc(u.tecnicoId)}" selected>Vínculo atual: ${esc(u.tecnicoId)}</option>`:''}${opcoesVinculoTecnico().filter(t=>t.id!==u?.tecnicoId).map(t=>`<option value="${esc(t.id)}">${esc(t.nome)} · ${esc(t.regiao)} · ${esc(t.tid)}</option>`).join('')}</select><small>Confira o identificador exato do relatório. O vínculo é exclusivo por e-mail e UF; apelido e e-mail de contato não concedem acesso. Homônimos na mesma UF precisam de identificadores distintos na origem.</small></label><label class="check-inline"><input type="checkbox" name="ativo" ${!u||u.ativo?'checked':''} ${protegido?'disabled':''}>Acesso ativo</label><p class="nota">${u?.principal?'O administrador principal não pode ser removido, desativado ou rebaixado por outro administrador. Seu cadastro é somente leitura nesta tela.':protegido?'Você não pode alterar suas próprias permissões. Para editar seu nome, use Minha conta.':'Uma conta desativada permanece no cadastro para preservar a identificação do histórico.'}</p>${!protegido?`<label class="check-inline"><input type="checkbox" name="gerarSenha" ${!u?'checked':''}>${u?'Gerar nova senha temporária e enviar por e-mail':'Gerar senha temporária e enviar por e-mail'}</label><p class="nota">A senha é gerada no servidor, vale por 24 horas e deve ser trocada no primeiro acesso. Salvar com esta opção desmarcada não gera nem envia senha. Para enviar para esta conta, marque a opção acima ou use o botão na lista. A senha anterior será substituída; as permissões e o vínculo de estoque permanecem os deste cadastro.</p><p data-senha-resultado role="status" aria-live="polite"></p>`:''}</form>`,
    rodape: protegido ? '<button class="btn" data-fechar>Fechar</button>' : '<p data-cadastro-status role="status" aria-live="polite" style="width:100%;margin:0"></p><button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar>Salvar alterações</button>' });
  const f=m.el.querySelector('form'), btn=m.el.querySelector('[data-salvar]');
  const atualizarVinculo=()=>{const tec=f.perfil.value==='tecnico';f.querySelector('[data-vinculo]').hidden=!tec;f.tecnicoId.required=tec;};
  f.perfil.addEventListener('change',atualizarVinculo);atualizarVinculo();
  if (!btn) { f.addEventListener('submit', e => e.preventDefault()); return; }
  const salvar=async()=>{
    if (btn.disabled || !f.reportValidity()) return;
    btn.disabled=true;btn.textContent='Salvando…';
    const statusModal=m.el.querySelector('[data-cadastro-status]');statusModal.textContent='Salvando cadastro. Aguarde a confirmação.';
    try {
      if(f.gerarSenha?.checked&&!f.ativo.checked)throw new Error('Ative o acesso para enviar uma senha temporária.');
      if(f.gerarSenha?.checked)await confirmarAdministradorSenha();
      const dados={email:f.email.value.trim().toLowerCase(),perfil:f.perfil.value,ativo:f.ativo.checked,tecnicoId:f.tecnicoId.value,nome:f.nome.value,enviar:!!f.gerarSenha?.checked};
      await salvarUsuario(dados.email,dados.perfil,dados.ativo,dados.tecnicoId,dados.nome);
      m.fechar();
      if(dados.enviar){void enviarSenhaUsuario(dados.email,true).catch(e=>toast(e.message,'erro'));}
      else{
        resultadosEnviosAcesso().set(dados.email,{email:dados.email,estado:'sem-envio',mensagem:'As alterações foram salvas. Nenhuma senha foi gerada ou enviada.'});atualizarEnviosAcesso();
      }
    }
    catch(e){statusModal.textContent=e.code ? erroAmigavel(e).message : e.message;statusModal.setAttribute('role','alert');btn.disabled=false;btn.textContent='Salvar alterações';}
  };
  btn.addEventListener('click',salvar); f.addEventListener('submit',e=>{e.preventDefault();salvar();});
}
const UIconta = { uid: '', nome: '', base: '', salvando: false, erro: '', salvo: false };
function renderConta() {
  const u = Acesso.usuario, p = Acesso.perfil;
  if (!u) return vazio('pessoa','Minha conta','Entre com uma conta autorizada para ver seu perfil.');
  const nome = nomeDaConta(), uid = u.uid || u.email;
  if (UIconta.uid !== uid) Object.assign(UIconta, { uid, nome, base: nome, salvando: false, erro: '', salvo: false });
  else if (UIconta.nome === UIconta.base) Object.assign(UIconta, { nome, base: nome });
  const podeEditar = Acesso.modo === 'firebase' && p?.ativo;
  const cadastro = p?.criadoEm ? fmtData(p.criadoEm) : 'Não informado';
  return `<section class="conta-perfil">${avatar(nome)}<div><span class="sobretitulo">MINHA CONTA</span><h2>${esc(nome)}</h2>${pill(p?.perfil==='administrador'?'info':'neutro',p?.principal?'Administrador principal':PERFIS[p?.perfil]||'Sem acesso')}</div>${imagemCabecalho()}</section>
    <div class="conta-grade">
      <form class="conta-dados form" data-form="minha-conta" aria-busy="${UIconta.salvando}">
        <div class="conta-bloco-titulo">${icone('pessoa')}<div><h3>Dados pessoais</h3><p>Escolha como seu nome aparece no painel.</p></div></div>
        <label class="campo" for="conta-nome"><span>Nome de exibição</span><input id="conta-nome" name="nome" type="text" autocomplete="name" required maxlength="80" value="${esc(UIconta.nome)}" aria-describedby="conta-nome-ajuda" ${!podeEditar||UIconta.salvando?'disabled':''}><small id="conta-nome-ajuda">Você pode alterar somente o nome. No menu, aparece seu primeiro nome.</small></label>
        <label class="campo" for="conta-email"><span>E-mail da conta <small>Somente leitura</small></span><input id="conta-email" type="email" value="${esc(u.email)}" readonly aria-describedby="conta-email-ajuda"><small id="conta-email-ajuda">Endereço autorizado para entrar no painel.</small></label>
        <p class="conta-feedback erro" role="alert" ${UIconta.erro?'':'hidden'}>${esc(UIconta.erro)}</p>
        <p class="conta-feedback sucesso" role="status" ${UIconta.salvo?'':'hidden'}>Nome atualizado com sucesso.</p>
        <div class="conta-salvar"><button class="btn prim" type="submit" ${!podeEditar||UIconta.salvando?'disabled':''}>${icone('ok')}${UIconta.salvando?'Salvando…':'Salvar nome'}</button></div>
      </form>
      <aside class="conta-informacoes" aria-labelledby="conta-acesso-titulo">
        <div class="conta-bloco-titulo">${icone('calendario')}<div><h3 id="conta-acesso-titulo">Cadastro e acesso</h3><p>Informações da sua conta no painel.</p></div></div>
        <dl><div><dt>Cadastrado em</dt><dd data-conta-cadastro>${p?.criadoEm?`<time datetime="${esc(p.criadoEm.slice(0,10))}">${cadastro}</time>`:cadastro}</dd></div><div><dt>Perfil de acesso</dt><dd>${esc(p?.principal?'Administrador principal':PERFIS[p?.perfil]||'Sem acesso')}</dd></div></dl>
        <p class="conta-acesso-nota">${podeAdministrar()?'Você administra acessos, cadastros e regras, além de acompanhar a operação.':perfilTecnico()?'Você acessa somente suas peças e informa devoluções e RMDF. Seu vínculo e seu saldo são gerenciados pela operação.':'Você pode consultar o painel, agendar devoluções e registrar contatos e observações.'}</p>
        <p class="nota">Seus registros permanecem vinculados à sua conta e ao seu e-mail.</p><details class="acesso-diagnostico"><summary>Diagnóstico de acesso</summary><pre>${esc(diagnosticoSessao(Acesso.auth))}</pre><p>Sem e-mail, senha ou tokens de acesso.</p></details>
      </aside>
    </div>
    <div class="conta-acoes">${podeAdministrar()?'<button class="btn" data-acao="ir" data-pagina="usuarios">Gerenciar usuários</button>':''}<button class="btn perigo" data-acao="sair">Sair desta conta</button></div><p class="nota">Em computadores compartilhados, saia ao terminar. A sessão pode ser reutilizada em outras abas deste navegador.</p>`;
}
async function salvarMinhaConta(form) {
  if (UIconta.salvando || !form.reportValidity()) return;
  const uid = Acesso.usuario?.uid, valor = form.elements.nome.value;
  UIconta.nome = valor; UIconta.salvando = true; UIconta.erro = ''; UIconta.salvo = false;
  renderizar(true);
  try {
    const nome = await salvarNomeConta(valor);
    if (Acesso.usuario?.uid === uid && Acesso.perfil?.ativo) Object.assign(UIconta, { nome, base: nome, salvo: true });
  } catch (e) {
    if (Acesso.usuario?.uid === uid) UIconta.erro = e.code ? erroAmigavel(e).message : e.message;
  } finally {
    if (Acesso.usuario?.uid === uid) {
      UIconta.salvando = false;
      if (UI.pagina === 'conta') renderizar(true);
    }
  }
}
async function modalHistoricoAgenda(tid) {
  const eventos = await Armazem.consultar('auditoria_agendamentos', { onde: [['tid','==',tid]] });
  eventos.sort((a,b)=>comparar(b.em,a.em));
  // Alterações simultâneas em várias peças são agrupadas para facilitar a leitura.
  const grupos = agrupar(eventos,e=>`${e.em}|${e.email}|${e.previsao}|${e.anterior}|${e.confirmacao?.contatoId||''}|${e.confirmacao?.referenciaEmail||''}`);
  abrirModal({titulo:'Histórico de agendamentos',subtitulo:nomeTecnico(tid),largura:'larga',
    corpo:eventos.length?`<ol class="linha-tempo">${[...grupos.values()].map(g=>{const e=g[0];return `<li><span class="lt-quando">${fmtDataHora(e.em)}</span><div><strong>${esc(primeiroNomeEmail(e.email))}</strong> ${e.previsao?`agendou para ${fmtData(e.previsao)}`:'removeu a previsão'}<small class="sub-celula">${esc(e.email)} · ${plural(g.length,'registro','registros')}${e.anterior?` · antes: ${fmtData(e.anterior)}`:''}</small>${g.some(x=>x.confirmacao)?`<details><summary>Conferir peças e formalização por e-mail</summary><ul>${g.filter(x=>x.confirmacao).map(x=>`<li><strong>${esc(x.confirmacao.mat)}</strong> · ${fmtNum(x.confirmacao.quantidade)} peça(s) · ${esc(descricaoConfirmacao({confirmacao:x.confirmacao,qtdPrevista:x.confirmacao.quantidade}))}<small class="sub-celula">${esc(x.confirmacao.referenciaEmail)}${x.confirmacao.observacao?` · ${esc(x.confirmacao.observacao)}`:''}</small></li>`).join('')}</ul></details>`:''}</div></li>`;}).join('')}</ol>`:vazio('calendario','Nenhuma alteração registrada','A autoria começa a ser registrada nesta versão. Previsões antigas permanecem sem autoria identificada.'),rodape:'<button class="btn" data-fechar>Fechar</button>'});
}
