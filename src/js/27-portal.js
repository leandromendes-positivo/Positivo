/* Estoques publicados por proprietário e UF. Nunca conceder ao técnico leitura dos documentos globais. */
function perfilTecnico() { return Acesso.modo === 'firebase' && Acesso.perfil?.perfil === 'tecnico'; }
function paginaPermitida(id) {
  if (!PAGINAS[id]) return false;
  if (perfilTecnico()) return ['meu-painel','conta'].includes(id);
  return !PAGINAS[id].tecnico && (!PAGINAS[id].admin || podeAdministrar());
}
function chaveSaldoTecnico(tid, regiao) {
  if (!/^[A-Z0-9_.-]{1,120}$/.test(tid) || !['PR','SC','TO','RS'].includes(regiao)) throw new Error('Identificação ou UF do técnico inválida.');
  return `${regiao}--${tid}`;
}
/* Função pura também usada pela implantação para publicar o estoque já existente. */
function montarSaldosTecnicos(usadas, novas, cadastro, catalogo) {
  const saldos = new Map();
  for (const [tipo, lista] of [['usadas', usadas], ['novas', novas]]) for (const linha of lista) {
    if (!['PR','SC','TO','RS'].includes(linha.regiao)) continue;
    const id = chaveSaldoTecnico(linha.tid, linha.regiao);
    if (!saldos.has(id)) saldos.set(id, { nome: cadastro[linha.tid]?.nome || linha.tid, tid: linha.tid, regiao: linha.regiao, pecas: new Map() });
    // Codificação reversível e sem colisões para novas; usadas conservam a chave oficial.
    const peca = tipo === 'usadas' ? `u-${linha.k}` : `n-${Array.from(new TextEncoder().encode(JSON.stringify([linha.mat, linha.tipoEnvio || '']))).map(b=>b.toString(16).padStart(2,'0')).join('')}`;
    if (peca.length > 1400) throw new Error('Código de material muito longo para publicar no portal.');
    const s = saldos.get(id);
    if (s.pecas.has(peca)) throw new Error('Estoque ambíguo: duas linhas com a mesma identificação. Corrija a origem antes de publicar.');
    if (!Number.isSafeInteger(linha.qtd) || linha.qtd <= 0) throw new Error('O portal exige quantidades inteiras e positivas. Confira o relatório.');
    s.pecas.set(peca, { tipo, mat: linha.mat, descricao: catalogo[linha.mat] || '', quantidade: linha.qtd, chamado: linha.chamado || '', nf: linha.nf || '', tipoEnvio: linha.tipoEnvio || '', desde: linha.desde || '' });
  }
  return saldos;
}
async function prepararSaldosTecnicos(usadas, novas, cadastro, catalogo, versao) {
  if (Acesso.modo !== 'firebase') return null;
  exigirAdministrador();
  const geracao = crypto.randomUUID(), saldos = montarSaldosTecnicos(usadas, novas, cadastro, catalogo);
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
const PortalTecnico = { controle:null, saldo:null, pecas:[], declaracoes:[], eventos:[], erro:'', sequencia:0 };
function limparPortalTecnico() { PortalTecnico.sequencia++;Object.assign(PortalTecnico,{controle:null,saldo:null,pecas:[],declaracoes:[],eventos:[],erro:''}); }
async function carregarPortalTecnico() {
  limparPortalTecnico();
  const seq=PortalTecnico.sequencia, id=Acesso.perfil?.tecnicoId;
  if(!perfilTecnico() || !id) throw new Error('Seu acesso não está vinculado a um estoque. Procure o administrador.');
  const vigente=()=>seq===PortalTecnico.sequencia && perfilTecnico() && Acesso.perfil?.tecnicoId===id && Acesso.perfil?.ativo;
  UI.pagina='meu-painel';montarMoldura();
  const erro=e=>{if(!vigente())return;PortalTecnico.erro='Não foi possível atualizar seu estoque com segurança. Verifique a conexão e recarregue.';E.status='erro';E.erro=PortalTecnico.erro;mudou();};
  let pararPecas=()=>{};
  const pararControle=Acesso.fs.doc('portal/controle').onSnapshot(async snap=>{
    if(!vigente() || snap.metadata.hasPendingWrites || snap.metadata.fromCache)return;
    const c=snap.data();
    pararPecas();PortalTecnico.pecas=[];PortalTecnico.saldo=null;PortalTecnico.controle=c||null;E.status='carregando';mudou();
    if(!c){E.status='pronto';mudou();return;}
    const gen=c.geracao;
    try {
      const ref=Acesso.fs.doc(`saldos_tecnicos/${id}/geracoes/${gen}`), meta=await ref.get({source:'server'});
      if(!vigente() || PortalTecnico.controle?.geracao!==gen)return;
      PortalTecnico.saldo=meta.data()||null;
      pararPecas=ref.collection('pecas').onSnapshot(s=>{
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
