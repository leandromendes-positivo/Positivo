/* Identidade e permissões. A interface orienta; o Firestore impõe as regras. */
const PERFIS = { usuario: 'Usuário', administrador: 'Administrador' };
const LOCALIDADES = { '': 'Não informado', capital: 'Capital', interior: 'Interior' };
function primeiroNomeEmail(email) {
  const parte = String(email || '').split('@')[0].split(/[._+\-\s]/)[0].replace(/\d+$/u, '');
  return parte ? parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1).toLocaleLowerCase('pt-BR') : 'Usuário';
}
function nomeDaConta(perfil = Acesso.perfil, email = Acesso.usuario?.email) {
  return limpar(perfil?.nome) || primeiroNomeEmail(email);
}
async function salvarNomeConta(valor) {
  if (Acesso.modo !== 'firebase' || !Acesso.usuario?.uid || !Acesso.perfil?.ativo) throw new Error('Entre com uma conta autorizada para alterar seu nome.');
  const nome = limpar(valor);
  if (!nome || nome.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(nome)) throw new Error('Informe um nome de até 80 caracteres, sem símbolos < ou >.');
  const usuario = Acesso.usuario, por = identidadeAtual();
  await Acesso.fs.doc(`usuarios/${por.email}`).update({ nome, atualizadoEm: carimboServidor(), atualizadoPor: por });
  if (Acesso.usuario?.uid === usuario.uid && Acesso.perfil?.ativo) {
    Acesso.perfil = { ...Acesso.perfil, nome };
    Acesso.usuario.nome = nome.split(' ')[0];
    mudou();
  }
  return nome;
}
function podeAdministrar() { return Acesso.modo !== 'firebase' || (Acesso.perfil?.ativo === true && Acesso.perfil.perfil === 'administrador'); }
function exigirAdministrador() {
  if (!podeAdministrar()) throw Object.assign(new Error('Esta ação é exclusiva de administradores.'), { code: 'sem_permissao' });
}
function identidadeAtual() {
  const email = String(Acesso.usuario?.email || E.usuario.email || '').toLowerCase();
  return { uid: Acesso.usuario?.uid || E.usuario.id || 'demonstracao', email };
}
function emailValido(email) { return typeof email === 'string' && email.length <= 254 && /^[a-z0-9.!#$%&'*+\-=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email); }
function autorPrevisao(item) {
  return item.agendadoPor?.email ? primeiroNomeEmail(item.agendadoPor.email) : 'Sem autoria registrada';
}
function autoresAgenda(itens) {
  return [...new Set(itens.map(autorPrevisao))].join(', ');
}
function carimboServidor() { return Acesso.modo === 'firebase' ? firebase.firestore.FieldValue.serverTimestamp() : agoraISO(); }

/** Um evento imutável e a previsão atual são gravados juntos. A versão evita sobrescrita silenciosa. */
async function gravarAgendamentos(itens, previsao, contato = null, opcoes = {}) {
  if (previsao && (!/^\d{4}-\d{2}-\d{2}$/.test(previsao) || Number.isNaN(Date.parse(previsao)))) throw new Error('Informe uma data válida.');
  const unicos = [...new Map(itens.map(i => [i.k, i])).values()];
  const identidade = identidadeAtual();
  const contatoId = contato ? crypto.randomUUID() : '';
  const versaoIndice = opcoes.versaoIndice ?? E.indice.versao ?? 0;
  const falhar = mensagem => { throw Object.assign(new Error(mensagem), {amigavel:true}); };
  for (const i of unicos) if (previsao && !i.confirmacao) falhar('Confirme a previsão com a referência ao e-mail de resposta do técnico.');
  const criar = (i, anterior) => {
    if (i.versaoAgenda != null && i.versaoAgenda !== (anterior?.versao || 0)) falhar('Esta previsão mudou em outra sessão. Feche e abra a confirmação novamente.');
    return ({
    tid: i.tid, peca: i.k, previsao: previsao || '', anterior: anterior?.previsao ?? i.previsao ?? '',
    versao: (anterior?.versao || 0) + 1, evento: crypto.randomUUID(), ...identidade, em: carimboServidor(),
    ...(previsao ? {confirmacao:i.confirmacao} : {}),
  }); };
  if (Acesso.modo === 'firebase') {
    // Até 8 peças por transação para respeitar os limites de consultas das regras.
    let concluidos = 0;
    try {
      for (let inicio = 0; inicio < unicos.length || (inicio === 0 && contato); inicio += 8) {
        const grupo = unicos.slice(inicio, inicio + 8);
        await Acesso.fs.runTransaction(async tx => {
          if(grupo.length){
            const indice=await tx.get(Acesso.fs.doc('dados/indice'));
            if((indice.data()?.versao || 0)!==versaoIndice)falhar('O estoque mudou durante a confirmação. Atualize a lista de peças antes de salvar.');
          }
          const refs = grupo.map(i => Acesso.fs.doc(`agendamentos/${i.k}`));
          const anteriores = await Promise.all(refs.map(ref => tx.get(ref)));
          grupo.forEach((i, n) => {
            const d = criar(i, anteriores[n].exists ? anteriores[n].data() : null);
            tx.set(refs[n], d); tx.set(Acesso.fs.doc(`auditoria_agendamentos/${d.evento}`), d);
          });
          if (inicio + 8 >= unicos.length && contato) tx.set(Acesso.fs.doc(`contatos/${contatoId}`), { ...contato, ...identidade, em: carimboServidor() });
        });
        concluidos += grupo.length;
      }
    } catch(e) {
      if (concluidos) {
        try { await carregarAcompanhamento(); mudou(); } catch (_) { /* O listener atualiza quando a conexão voltar. */ }
        throw Object.assign(new Error(`${concluidos} de ${unicos.length} registros tiveram a previsão atualizada. Confira a seleção antes de tentar novamente. ${erroAmigavel(e).message}`), { amigavel: true, original: e });
      }
      throw e;
    }
  } else {
    if(unicos.length && (E.indice.versao || 0)!==versaoIndice)falhar('O estoque mudou. Reabra a confirmação.');
    for (const i of unicos) {
      const d = criar(i, await Armazem.ler(`agendamentos/${i.k}`));
      await Armazem.gravar(`agendamentos/${i.k}`, d);
      await Armazem.gravar(`auditoria_agendamentos/${d.evento}`, d);
    }
    if (contato) await Armazem.gravar(`contatos/${contatoId}`, { ...contato, ...identidade, em: agoraISO() });
  }
  await carregarAcompanhamento();
  mudou(); agendarResumo();
}

function combinarAcompanhamento() {
  const acomp = JSON.parse(JSON.stringify(E.acompLegado || {}));
  const garantir = tid => acomp[tid] || (acomp[tid] = { itens: {}, cobrancas: [] });
  for (const a of E.agendamentos || []) {
    const t = garantir(a.tid); t.itens ||= {};
    t.itens[a.peca] = { ...(t.itens[a.peca] || {}), p: a.previsao, agendadoPor: { uid: a.uid, email: a.email }, agendadoEm: a.em, evento: a.evento };
  }
  for (const n of E.anotacoes || []) {
    const t = garantir(n.tid); t.itens ||= {};
    t.itens[n.peca] = { ...(t.itens[n.peca] || {}), o: n.texto };
  }
  for (const c of E.contatos || []) {
    const t = garantir(c.tid); (t.cobrancas ||= []).push({ ...c, por: c.uid });
    for (const k of c.itens) {
      const ant = (t.itens ||= {})[k] || {};
      t.itens[k] = { ...ant, c: (ant.c || 0) + 1, uc: [ant.uc || '', c.em].sort().at(-1) };
    }
  }
  for (const t of Object.values(acomp)) t.cobrancas = (t.cobrancas || []).sort((a,b) => comparar(a.em,b.em));
  E.acomp = acomp;
}
async function carregarAcompanhamento() {
  [E.agendamentos, E.contatos, E.anotacoes] = await Promise.all(['agendamentos','contatos','anotacoes'].map(c => Armazem.consultar(c)));
  combinarAcompanhamento();
}

async function salvarUsuario(email, perfil, ativo) {
  exigirAdministrador(); email = String(email || '').trim().toLowerCase();
  if (!emailValido(email) || !PERFIS[perfil] || typeof ativo !== 'boolean') throw new Error('Confira o e-mail e o perfil informado.');
  if (Acesso.modo !== 'firebase') throw new Error('O cadastro de acessos exige conexão com o Firebase.');
  const ref = Acesso.fs.doc(`usuarios/${email}`);
  await Acesso.fs.runTransaction(async tx => {
    const atual = await tx.get(ref);
    if (atual.data()?.principal) throw new Error('O acesso do administrador principal é protegido e não pode ser alterado pelo painel.');
    if (email === Acesso.usuario.email.toLowerCase()) throw new Error('Você não pode alterar suas próprias permissões. Para editar seu nome, use Minha conta.');
    const por = identidadeAtual(), em = carimboServidor();
    const d = { email, perfil, ativo, principal: atual.data()?.principal || false, atualizadoEm: em, atualizadoPor: por,
      criadoEm: atual.exists ? atual.data().criadoEm : em, criadoPor: atual.exists ? atual.data().criadoPor : por };
    if (typeof atual.data()?.nome === 'string') d.nome = atual.data().nome;
    tx.set(ref, d);
  });
  toast(ativo ? 'Acesso autorizado salvo.' : 'Acesso desativado.');
}

function bloquearSessao(mensagem = 'Seu acesso foi desativado. Procure o administrador.') {
  OutlookCobranca.desconectar();
  MenuLateral.fechar({ restaurarFoco: false });
  Acesso.perfil = null;
  fecharModaisAdministrativos();
  limparHistoricoRanking();
  limparHistoricoRelatorio();
  Object.assign(UIinventario,{devolucoes:[],movimentos:[],chave:null,carregando:false,erro:''});
  for (const parar of E.ouvintes) parar(); E.ouvintes = [];
  E.usadas = []; E.novas = []; E.cadastro = {}; E.acomp = {}; E.acompLegado = {};
  E.agendamentos = []; E.contatos = []; E.anotacoes = []; E.usuarios = [];
  E.devolucoes = []; E.movimentos = []; E.historico = []; E.importacoes = [];
  E.catalogo = {}; E.indice = { arquivos: {}, anterior: {} }; E.config = { ...PADROES };
  document.querySelectorAll('.modal-fundo').forEach(el => el.remove());
  E.status = 'erro'; E.erroCodigo = 'sem_permissao'; E.erro = mensagem; mudou(); renderizar(true);
}
