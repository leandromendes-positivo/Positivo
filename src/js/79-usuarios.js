/* Gestão de acessos: somente administradores; o perfil vem do banco protegido. */
function renderUsuarios() {
  if (!podeAdministrar()) return vazio('pessoa','Acesso restrito','O cadastro de usuários é exclusivo de administradores.');
  if (Acesso.modo !== 'firebase') return vazio('info','Conecte o Firebase','Os acessos são gerenciados no banco autenticado. A demonstração não libera contas reais.');
  const lista = [...E.usuarios].sort((a,b) => Number(b.principal)-Number(a.principal) || comparar(a.email,b.email));
  return `<section class="usuarios-intro"><div><span class="sobretitulo">ADMINISTRAÇÃO / ACESSOS</span><h2>As pessoas da operação</h2><p>Autorize cada endereço e escolha o que a pessoa pode fazer.</p></div><button class="btn prim" data-acao="novo-usuario">${icone('mais')}Cadastrar usuário</button>${imagemCabecalho()}</section>
    <div class="perfis-grade"><article>${icone('pessoa')}<h3>Usuário</h3><p>Consulta peças e indicadores, agenda devoluções e registra contatos e observações.</p></article><article>${icone('ajustes')}<h3>Administrador</h3><p>Também importa planilhas, edita técnicos e regras, classifica saídas e gerencia acessos.</p></article></div>
    <div class="usuarios-resumo"><span><strong>${lista.filter(u=>u.ativo).length}</strong> acessos ativos</span><span><strong>${lista.filter(u=>u.ativo&&u.perfil==='administrador').length}</strong> administradores</span><span><strong>${lista.filter(u=>!u.ativo).length}</strong> desativados</span></div>
    ${lista.length ? `<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Pessoa / e-mail autorizado</th><th>Perfil</th><th>Acesso</th><th>Última alteração</th><th></th></tr></thead><tbody>${lista.map(u=>`<tr><td><span class="celula-tec">${avatar(nomeDaConta(u,u.email))}<span><strong>${esc(nomeDaConta(u,u.email))}</strong><small class="sub-celula">${esc(u.email)}</small></span></span></td><td>${pill(u.perfil==='administrador'?'info':'neutro',u.principal?'Administrador principal':PERFIS[u.perfil])}</td><td>${pill(u.ativo?'ok':'grave',u.ativo?'Ativo':'Desativado')}</td><td>${u.atualizadoEm?fmtDataHora(u.atualizadoEm):'—'}<small class="sub-celula">${esc(u.atualizadoPor?.email ? primeiroNomeEmail(u.atualizadoPor.email) : 'Configuração inicial')}</small></td><td><button class="btn pequeno" data-acao="editar-usuario" data-email="${esc(u.email)}">Gerenciar</button></td></tr>`).join('')}</tbody></table></div>` : vazio('pessoas','Carregando acessos','Os cadastros aparecerão aqui.')}
    <p class="nota usuarios-nota">A desativação bloqueia novas leituras e gravações, inclusive em uma sessão já aberta. O administrador principal permanece protegido para evitar que a equipe perca o acesso.</p>`;
}
function modalUsuario(email = '') {
  exigirAdministrador();
  const u = E.usuarios.find(u=>u.email===email);
  const protegido = u?.principal || email === Acesso.usuario?.email?.toLowerCase();
  const m = abrirModal({ titulo: u ? 'Gerenciar acesso' : 'Cadastrar usuário', subtitulo: 'Autorize o endereço exato usado no Google ou na Microsoft.',
    corpo: `<form class="form" id="usuario-form"><label class="campo"><span>E-mail autorizado</span><input type="email" name="email" required maxlength="254" autocomplete="off" ${u?'readonly':''} value="${esc(email)}" autofocus><small>O domínio pode ser Gmail, Outlook ou corporativo.</small></label><label class="campo"><span>Perfil de acesso</span><select name="perfil" ${protegido?'disabled':''}>${Object.entries(PERFIS).map(([v,n])=>`<option value="${v}" ${u?.perfil===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="check-inline"><input type="checkbox" name="ativo" ${!u||u.ativo?'checked':''} ${protegido?'disabled':''}>Acesso ativo</label><p class="nota">${protegido?'Este acesso administrativo está protegido.':'Uma conta desativada permanece no cadastro para preservar a identificação do histórico.'}</p><p class="nota">Não é necessário cadastrar senha. A pessoa entra com seu provedor e só acessa o painel se este e-mail estiver ativo.</p></form>`,
    rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar>Salvar acesso</button>' });
  const f=m.el.querySelector('form'), btn=m.el.querySelector('[data-salvar]');
  const salvar=async()=>{
    if (btn.disabled || !f.reportValidity()) return;
    btn.disabled=true;
    try { await salvarUsuario(f.email.value, f.perfil.value, f.ativo.checked);m.fechar(); }
    catch(e){toast(e.code ? erroAmigavel(e).message : e.message,'erro');btn.disabled=false;}
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
        <p class="conta-acesso-nota">${podeAdministrar()?'Você administra acessos, cadastros e regras, além de acompanhar a operação.':'Você pode consultar o painel, agendar devoluções e registrar contatos e observações.'}</p>
        <p class="nota">Seus registros permanecem vinculados à sua conta e ao seu e-mail.</p>
      </aside>
    </div>
    <div class="conta-acoes">${podeAdministrar()?'<button class="btn" data-acao="ir" data-pagina="usuarios">Gerenciar usuários</button>':''}<button class="btn" data-acao="sair">${icone('sair')}Sair desta conta</button></div><p class="nota">Em computadores compartilhados, saia ao terminar. A sessão fica limitada a esta aba do navegador.</p>`;
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
