/* Estoques publicados por proprietário e UF. Nunca conceder ao técnico leitura dos documentos globais. */
function perfilTecnico() { return Acesso.modo === 'firebase' && Acesso.perfil?.perfil === 'tecnico'; }
function paginaPermitida(id) {
  if (!Object.hasOwn(PAGINAS, id)) return false;
  if (perfilTecnico()) return ['meu-painel','conta'].includes(id);
  return !PAGINAS[id].tecnico && (!PAGINAS[id].admin || podeAdministrar());
}
function chaveSaldoTecnico(tid, regiao) {
  if (!/^[A-Z0-9_.-]{1,120}$/.test(tid) || !['PR','SC','TO','RS'].includes(regiao)) throw new Error('Identificação ou UF do técnico inválida.');
  return `${regiao}--${tid}`;
}
function opcoesVinculoTecnico() {
  const opcoes=new Map();
  const incluir=(tid,regiao)=>{if(E.cadastro[tid] && /^[A-Z0-9_.-]{1,120}$/.test(tid) && ['PR','SC','TO','RS'].includes(regiao)) {
    const id=chaveSaldoTecnico(tid,regiao);opcoes.set(id,{id,tid,regiao,nome:E.cadastro[tid].nome});
  }};
  for(const [tid,t] of Object.entries(E.cadastro))incluir(tid,t.regiao);
  for(const p of [...E.usadas,...E.novas,...(E.rmdf||[])])incluir(p.tid,p.regiao);
  return [...opcoes.values()].sort((a,b)=>comparar(a.nome,b.nome)||comparar(a.regiao,b.regiao));
}
/* Função pura também usada pela implantação para publicar o estoque já existente. */
function montarSaldosTecnicos(usadas, novas, cadastro, catalogo, rmdf = []) {
  const saldos = new Map();
  for (const [tipo, lista] of [['usadas', usadas], ['novas', novas], ['rmdf', rmdf]]) for (const linha of lista) {
    if (!['PR','SC','TO','RS'].includes(linha.regiao)) continue;
    const id = chaveSaldoTecnico(linha.tid, linha.regiao);
    if (!saldos.has(id)) saldos.set(id, { nome: cadastro[linha.tid]?.nome || linha.tid, tid: linha.tid, regiao: linha.regiao, pecas: new Map() });
    // Codificação reversível e sem colisões para novas; usadas conservam a chave oficial.
    const peca = tipo !== 'novas' ? `${tipo === 'rmdf' ? 'r' : 'u'}-${linha.k}` : `n-${Array.from(new TextEncoder().encode(JSON.stringify([linha.mat, linha.tipoEnvio || '']))).map(b=>b.toString(16).padStart(2,'0')).join('')}`;
    if (peca.length > 1400) throw new Error('Código de material muito longo para publicar no portal.');
    const s = saldos.get(id);
    if (s.pecas.has(peca)) throw new Error('Estoque ambíguo: duas linhas com a mesma identificação. Corrija a origem antes de publicar.');
    if (!Number.isSafeInteger(linha.qtd) || linha.qtd <= 0) throw new Error('O portal exige quantidades inteiras e positivas. Confira o relatório.');
    s.pecas.set(peca, { tipo, mat: linha.mat, descricao: catalogo[linha.mat] || '', quantidade: linha.qtd, chamado: linha.chamado || '', nf: linha.nf || '', tipoEnvio: linha.tipoEnvio || '', desde: linha.desde || '', ...(tipo==='rmdf'?{remessa:linha.remessa||'',dataFT:linha.dataFT||''}:{}) });
  }
  return saldos;
}
async function prepararSaldosTecnicos(usadas, novas, cadastro, catalogo, versao, rmdf = []) {
  if (Acesso.modo !== 'firebase') return null;
  exigirAdministrador();
  const geracao = crypto.randomUUID(), saldos = montarSaldosTecnicos(usadas, novas, cadastro, catalogo, rmdf);
  let lote = Acesso.fs.batch(), n = 0;
  const gravar = async (ref,d) => { lote.set(ref,d); if (++n === 400) { await lote.commit(); lote=Acesso.fs.batch();n=0; } };
  for (const [id,s] of saldos) {
    const ref=Acesso.fs.doc(`saldos_tecnicos/${id}/geracoes/${geracao}`);
    await gravar(ref,{nome:s.nome,tid:s.tid,regiao:s.regiao,total:s.pecas.size});
    for (const [p,d] of s.pecas) await gravar(ref.collection('pecas').doc(p),d);
  }
  if(n)await lote.commit();
  return {geracao,versao,atualizadoEm:agoraISO()};
}
// Leitura REST autenticada não reutiliza o alvo de um listener já encerrado pelo SDK.
// É usada somente para confirmar a autorização após uma falha de acesso ao portal.
async function lerPerfilPortalNoServidor() {
  const token=await Acesso.auth.currentUser.getIdToken();
  const emulador=window.__CP_FIREBASE_EMULADOR__ && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const base=emulador?'http://127.0.0.1:8080/v1':'https://firestore.googleapis.com/v1';
  const url=`${base}/projects/${encodeURIComponent(Acesso.projeto)}/databases/(default)/documents/usuarios/${encodeURIComponent(identidadeAtual().email)}`;
  const resposta=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  if(resposta.status===404)return null;
  if(!resposta.ok)throw Object.assign(new Error('Não foi possível confirmar a autorização.'),{code:[401,403].includes(resposta.status)?'permission-denied':'unavailable'});
  const campos=(await resposta.json()).fields||{};
  return {ativo:campos.ativo?.booleanValue===true,perfil:campos.perfil?.stringValue||'',tecnicoId:campos.tecnicoId?.stringValue||''};
}
const PortalTecnico = { controle:null, saldo:null, pecas:[], declaracoes:[], eventos:[], erro:'', sequencia:0 };
function limparPortalTecnico() { PortalTecnico.sequencia++;Object.assign(PortalTecnico,{controle:null,saldo:null,pecas:[],declaracoes:[],eventos:[],erro:''}); }
async function carregarPortalTecnico() {
  limparPortalTecnico();
  const seq=PortalTecnico.sequencia, id=Acesso.perfil?.tecnicoId;
  if(!perfilTecnico() || !id) throw new Error('Seu acesso não está vinculado a um estoque. Procure o administrador.');
  const vigente=()=>seq===PortalTecnico.sequencia && perfilTecnico() && Acesso.perfil?.tecnicoId===id && Acesso.perfil?.ativo;
  UI.pagina='meu-painel';montarMoldura();
  let verificandoAcesso=false;
  const erro=async e=>{
    if(!vigente())return;
    // Negação de uma consulta também invalida os dados visíveis, mesmo se o
    // listener do perfil ainda não recebeu a desativação feita em outra sessão.
    PortalTecnico.pecas=[];PortalTecnico.saldo=null;
    PortalTecnico.erro='Não foi possível atualizar seu estoque com segurança. Verifique a conexão e recarregue.';
    E.status='erro';E.erro=PortalTecnico.erro;mudou();
    if(verificandoAcesso)return;
    verificandoAcesso=true;
    try {
      const p=await lerPerfilPortalNoServidor();
      if(!vigente())return;
      if(!p || !p.ativo || p.perfil!=='tecnico' || p.tecnicoId!==id)bloquearSessao();
    }catch(falha){
      if(vigente() && ['permission-denied','unauthenticated'].includes(falha.code))bloquearSessao('Sua sessão não tem mais acesso. Entre novamente.');
    }finally{verificandoAcesso=false;}
  };
  let pararPecas=()=>{};
  const pararControle=Acesso.fs.doc('portal/controle').onSnapshot({includeMetadataChanges:true},async snap=>{
    if(!vigente() || snap.metadata.hasPendingWrites || snap.metadata.fromCache)return;
    const c=snap.data();
    pararPecas();PortalTecnico.pecas=[];PortalTecnico.saldo=null;PortalTecnico.controle=c||null;E.status='carregando';mudou();
    if(!c){E.status='pronto';mudou();return;}
    const gen=c.geracao;
    try {
      const ref=Acesso.fs.doc(`saldos_tecnicos/${id}/geracoes/${gen}`), meta=await ref.get({source:'server'});
      if(!vigente() || PortalTecnico.controle?.geracao!==gen)return;
      PortalTecnico.saldo=meta.data()||null;
      pararPecas=ref.collection('pecas').onSnapshot({includeMetadataChanges:true},s=>{
        if(!vigente() || PortalTecnico.controle?.geracao!==gen || s.metadata.fromCache)return;
        PortalTecnico.pecas=s.docs.map(d=>({id:d.id,...d.data()}));E.status='pronto';mudou();
      },e=>{if(PortalTecnico.controle?.geracao===gen)erro(e);});
    }catch(e){if(PortalTecnico.controle?.geracao===gen)erro(e);}
  },erro);
  const pararDeclaracoes=Acesso.fs.collection(`declaracoes_tecnicos/${id}/itens`).onSnapshot(s=>{
    if(!vigente())return;PortalTecnico.declaracoes=s.docs.map(d=>({id:d.id,...decodificarFS(d.data())}));mudou();
  },erro);
  E.ouvintes.push(()=>{limparPortalTecnico();pararControle();pararPecas();pararDeclaracoes();});
}
async function salvarDeclaracaoTecnico(peca, valores, versaoEsperada) {
  if(!perfilTecnico() || !Acesso.perfil?.ativo)throw new Error('Acesso exclusivo do técnico vinculado.');
  const tecnicoId=Acesso.perfil.tecnicoId, geracao=PortalTecnico.controle?.geracao, por=identidadeAtual();
  const ref=Acesso.fs.doc(`declaracoes_tecnicos/${tecnicoId}/itens/${peca}`), evento=crypto.randomUUID();
  await Acesso.fs.runTransaction(async tx=>{
    const [c,p,ant]=await Promise.all([tx.get(Acesso.fs.doc('portal/controle')),tx.get(Acesso.fs.doc(`saldos_tecnicos/${tecnicoId}/geracoes/${geracao}/pecas/${peca}`)),tx.get(ref)]);
    if(c.data()?.geracao!==geracao || !p.exists)throw new Error('Seu saldo mudou. Reabra a peça e confira as quantidades.');
    if((ant.data()?.versao||0)!==versaoEsperada)throw new Error('Este registro mudou em outra sessão. Reabra a peça.');
    const qtd=valores.quantidadeDevolver+valores.quantidadeRmdf;
    if(!Number.isSafeInteger(qtd) || qtd>p.data().quantidade)throw new Error('A soma das quantidades não pode superar o saldo atual.');
    const d={...valores,tecnicoId,peca,geracao,mat:p.data().mat,tipo:p.data().tipo,...por,evento,versao:versaoEsperada+1,em:carimboServidor()};
    tx.set(ref,d);tx.set(Acesso.fs.doc(`eventos_tecnicos/${evento}`),d);
  });
}
