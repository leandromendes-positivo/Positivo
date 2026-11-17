/* ==========================================================================
   Importação diária.

   Cada planilha é a FOTO do momento de uma região: o que está nela continua
   com o técnico; o que sumiu desde a última importação saiu (peça usada
   devolvida / saída de peça nova a classificar). A foto é gravada em partes com uma
   "geração" nova e só vira a atual quando o índice aponta para ela, então
   uma falha no meio do caminho não deixa os dados pela metade.
   ========================================================================== */

const LIMITE_PARTE = 150000; // caracteres por documento (o banco aceita até 256 KiB)

function dividirEmPartes(linhas) {
  const partes = [];
  let atual = [], tam = 0;
  for (const l of linhas) {
    const t = JSON.stringify(l).length + 1;
    if (atual.length && tam + t > LIMITE_PARTE) { partes.push(atual); atual = []; tam = 0; }
    atual.push(l);
    tam += t;
  }
  if (atual.length || !partes.length) partes.push(atual);
  return partes;
}

/** Calcula a nova foto de uma planilha e o que mudou em relação à anterior. */
function compararFoto(lido, hoje, agoraS, lote, foto = E) {
  const R = lido.regiao;
  if (lido.tipo === "usadas" || lido.tipo === 'rmdf') {
    const anteriores = new Map((foto[lido.tipo] || []).filter((u) => u.regiao === R).map((u) => [u.k, u]));
    const ocorrencias = new Map();
    const novas = [];
    let entradas = 0, mantidos = 0;
    for (const it of lido.itens) {
      const base = [R, it.tecChave, it.nf, it.remessa, it.mat, it.chamado, it.dataFT || ""].join("|");
      const n = ocorrencias.get(base) || 0;
      ocorrencias.set(base, n + 1);
      const k = hash36(base) + (n ? "." + n : "");
      const ant = anteriores.get(k);
      if (ant) mantidos++; else entradas++;
      novas.push({
        k, tid: idSeguro(it.tecChave), regiao: R, nf: it.nf, remessa: it.remessa, mat: it.mat,
        chamado: it.chamado, dataFT: it.dataFT, qtd: it.qtd, desde: ant ? ant.desde : hoje,
        qtdUso: Math.max(it.qtd, ant ? ant.qtdUso || ant.qtd : 0),
        matSol: it.matSol && it.matSol !== it.mat ? it.matSol : "",
      });
    }
    const quantidades = new Map(novas.map((u) => [u.k, u.qtd]));
    const saidas = [...anteriores.values()].map((u) => ({ ...u, qtd: Math.max(0, u.qtd - (quantidades.get(u.k) || 0)), qtdUso: u.qtdUso || u.qtd })).filter((u) => u.qtd > 0);
    const devolvidas = saidas.map((u) => [
      u.k, u.tid, u.mat, u.chamado, u.dataFT || "", u.qtd, agoraS,
      Math.max(0, diffDias((u.dataFT || u.desde).slice(0, 10), hoje)), R, lote,
      u.qtdUso, prazoDoTecnico(u.tid), u.desde, u.nf || "", u.remessa || "",
      ...(lido.tipo === 'rmdf' ? ['rmdf'] : []),
    ]);
    return {
      linhas: novas, devolvidas, movimentos: [],
      resumo: { entradas, mantidos, saidas: saidas.length, saidasQtd: somar(saidas, (u) => u.qtd), qtd: somar(novas, (u) => u.qtd), itens: novas.length },
    };
  }
  // novas: agrega por técnico + material + tipo de envio
  const anteriores = new Map(foto.novas.filter((n) => n.regiao === R).map((n) => [`${n.tid}|${n.mat}|${n.tipoEnvio}`, n]));
  const primeiraObservacao = new Map();
  for (const n of anteriores.values()) {
    const chave = `${n.tid}|${n.mat}`, anterior = primeiraObservacao.get(chave);
    if (!anterior || n.desde < anterior) primeiraObservacao.set(chave, n.desde);
  }
  const agg = new Map();
  for (const it of lido.itens) {
    const tid = idSeguro(it.tecChave);
    const chave = `${tid}|${it.mat}|${it.tipoEnvio}`;
    let a = agg.get(chave);
    if (!a) {
      const ant = anteriores.get(chave);
      agg.set(chave, (a = { tid, regiao: R, mat: it.mat, tipoEnvio: it.tipoEnvio, qtd: 0, linhas: 0, desde: ant ? ant.desde : primeiraObservacao.get(`${tid}|${it.mat}`) || hoje }));
    }
    a.qtd += it.qtd;
    a.linhas++;
  }
  let entradas = 0, alterados = 0;
  for (const [chave, a] of agg) {
    const ant = anteriores.get(chave);
    if (!ant) entradas++;
    else if (ant.qtd !== a.qtd) alterados++;
  }
  const saidas = [...anteriores.keys()].filter((c) => !agg.has(c)).length;
  const linhas = [...agg.values()];
  // Tipo de envio pode mudar sem saída física; compare o total por técnico/material.
  const agruparSaldo = (lista) => {
    const mapa = new Map();
    for (const n of lista) {
      const chave = `${n.tid}|${n.mat}`;
      const a = mapa.get(chave) || { ...n, qtd: 0 };
      a.qtd += n.qtd; if (n.desde < a.desde) a.desde = n.desde;
      mapa.set(chave, a);
    }
    return mapa;
  };
  const saldosAntes = agruparSaldo([...anteriores.values()]), saldosDepois = agruparSaldo(linhas);
  const movimentos = [];
  for (const [chave, ant] of saldosAntes) {
    const qtd = ant.qtd - (saldosDepois.get(chave)?.qtd || 0);
    if (qtd > 0) movimentos.push({ k: `${lote}-${hash36(R + '|' + chave)}`, lote, tid: ant.tid, regiao: R, mat: ant.mat, qtd, desde: ant.desde,
      ...(hoje >= INICIO_CONTAGEM_NOVAS ? {contagemDesde:inicioContagemNova(ant.desde, hoje)} : {}),
      em: agoraS, dias: diasComPecaNova(ant.desde, hoje), prazo: prazoDoTecnico(ant.tid, 'novas'), destino: "pendente" });
  }
  return {
    linhas, devolvidas: [], movimentos,
    resumo: {
      entradas, alterados, saidas, qtd: somar(linhas, (n) => n.qtd), itens: linhas.length,
      qtdAntes: somar([...anteriores.values()], (n) => n.qtd),
    },
  };
}

/** Na mesma atualização, a entrada em RMDF reclassifica a saída de novas, sem devolução fictícia. */
function reconciliarRmdfNoLote(fotos, fotoBase) {
  for(const [chave,r] of fotos){
    if(!chave.startsWith('rmdf:'))continue;
    const uf=chave.split(':')[1], novas=fotos.get(`novas:${uf}`);if(!novas)continue;
    const antes=new Map((fotoBase.rmdf||[]).filter(i=>i.regiao===uf).map(i=>[i.k,i.qtd])), entradas=new Map();
    // Entrada e devolução do mesmo material podem acontecer juntas em referências diferentes.
    for(const i of r.linhas){const k=JSON.stringify([i.tid,i.mat]);entradas.set(k,(entradas.get(k)||0)+Math.max(0,i.qtd-(antes.get(i.k)||0)));}
    novas.movimentos=novas.movimentos.flatMap(m=>{
      const k=JSON.stringify([m.tid,m.mat]),q=Math.min(m.qtd,entradas.get(k)||0);if(!q)return [m];
      entradas.set(k,entradas.get(k)-q);
      const reclassificada={...m,k:`${m.k}-rmdf`,qtd:q,destino:'rmdf',origemClassificacao:'importacao'};
      return q===m.qtd?[reclassificada]:[reclassificada,{...m,qtd:m.qtd-q}];
    });
  }
}

/** Saldo oficial e arquivo de saídas entram juntos no Firebase. */
async function confirmarImportacaoNoBanco({ indice, registro, lote, devolvidas, movimentos, hoje, portal }) {
  const docs = [];
  if (devolvidas.length) dividirEmPartes(devolvidas).forEach((itens,n)=>docs.push([`devolucoes/${lote}-${n}`,{data:hoje,lote,itens,atualizadoEm:agoraISO()}]));
  if (movimentos.length) dividirEmPartes(movimentos).forEach((itens,n)=>docs.push([`movimentos/${lote}-${n}`,{data:hoje,lote,itens}]));
  if (docs.length > 450 || JSON.stringify(docs).length > 8000000) throw new Error('Este lote é muito grande. Importe menos regiões por vez.');
  if (Acesso.modo === 'firebase') {
    const ref = Acesso.fs.doc('dados/indice');
    await Acesso.fs.runTransaction(async tx => {
      const atual = await tx.get(ref);
      if ((atual.data()?.versao || 0) !== (indice.versao - 1)) throw Object.assign(new Error('Outra pessoa importou planilhas durante esta atualização. Recarregue e importe novamente.'), { amigavel: true });
      for (const [c,d] of docs) tx.set(Acesso.fs.doc(c),codificarFS(d));
      tx.set(Acesso.fs.doc(`importacoes/${lote}`),codificarFS(registro));
      if (portal) tx.set(Acesso.fs.doc('portal/controle'),portal);
      tx.set(ref,codificarFS(indice),{merge:true});
    });
  } else {
    const gravados=[];
    try {
      for (const [c,d] of docs) { await Armazem.gravar(c,d);gravados.push(c); }
      await Armazem.gravar(`importacoes/${lote}`,registro);gravados.push(`importacoes/${lote}`);
      await Armazem.mesclar('dados/indice',indice,E.existe.indice);
    } catch(e) { for(const c of gravados) await Armazem.apagar(c);throw e; }
  }
  return {
    devolucoes:docs.filter(([c])=>c.startsWith('devolucoes/')).flatMap(([c,d])=>d.itens.map(l=>decodificarDevolucao(l,c.split('/')[1]))),
    movimentos:docs.filter(([c])=>c.startsWith('movimentos/')).flatMap(([c,d])=>d.itens.map(m=>({...m,doc:c.split('/')[1]}))),
  };
}

/**
 * Importa um conjunto de planilhas já lidas.
 * aoProgresso(texto) recebe mensagens para a tela.
 */
async function importarLote(lidos, aoProgresso = () => {}) {
  exigirAdministrador();
  const hoje = hojeISO();
  const agoraS = agoraISO();
  const lote = "L" + carimbo() + Math.random().toString(36).slice(2, 6);
  const gen = "g" + carimbo() + crypto.randomUUID().replaceAll("-", "");
  const avisos = [];

  // Capture uma foto consistente, independente das atualizações do listener.
  const indiceBase = structuredClone((Armazem.online ? await Armazem.ler('dados/indice') : E.indice) || { arquivos: {}, anterior: {} });
  const fotoBase = { usadas: E.usadas, novas: E.novas, rmdf: E.rmdf||[] };
  if (Armazem.online) {
    aoProgresso('Conferindo o estoque anterior…');
    const entradas = Object.entries(indiceBase.arquivos || {}).filter(([,ent]) => ent && ent.gen);
    const listas = await Promise.all(entradas.map(([chave,ent]) => lerArquivoDoIndice(chave,ent)));
    fotoBase.usadas = []; fotoBase.novas = []; fotoBase.rmdf = [];
    entradas.forEach(([chave],i) => fotoBase[chave.split(':')[0]].push(...listas[i]));
  }

  const grupos = new Map();
  for (const l of lidos) {
    if (!["usadas","novas","rmdf"].includes(l.tipo) || !Object.hasOwn(UFS,l.regiao) || regiaoDesativada(l.regiao)) throw new Error("Tipo ou UF inválidos na importação.");
    const chave = `${l.tipo}:${l.regiao}`;
    if (grupos.has(chave) && l.tipo === "rmdf") throw new Error(`Há mais de uma planilha RMDF de ${l.regiao} no mesmo lote. Selecione somente a relação atual para evitar substituição ambígua.`);
    if (grupos.has(chave)) avisos.push(`Havia mais de um arquivo de ${l.tipo} de ${l.regiao}; usei "${l.nome}".`);
    grupos.set(chave, l);
  }

  // técnicos novos e descrições de material
  const novosTecs = {};
  const novosMats = {};
  for (const l of grupos.values()) {
    for (const it of l.itens) {
      const tid = idSeguro(it.tecChave);
      if (!E.cadastro[tid] && !novosTecs[tid]) {
        novosTecs[tid] = {
          chave: it.tecChave, nome: it.tecNome, apelido: "", regiao: l.regiao,
          tipo: "tecnico",
          meta: null, telefone: "", email: "", obs: "", criadoEm: agoraS,
        };
      } else if (E.cadastro[tid] && !E.cadastro[tid].regiao && !novosTecs[tid]) {
        novosTecs[tid] = { regiao: l.regiao };
      }
      if (it.desc && E.catalogo[it.mat] !== it.desc) novosMats[it.mat] = it.desc;
    }
  }

  // Nomes normalizados não podem colidir com outro identificador já cadastrado.
  const identidades = new Map();
  for (const l of grupos.values()) for (const it of l.itens) {
    const tid=idSeguro(it.tecChave), anterior=identidades.get(tid) || E.cadastro[tid]?.chave;
    if (anterior && anterior!==it.tecChave) throw new Error('Dois técnicos geraram o mesmo identificador. Corrija os nomes na origem antes de importar.');
    identidades.set(tid,it.tecChave);
  }
  // novas fotos
  const resultados = [];
  const devolvidas = [];
  const movimentos = [];
  const fotos = new Map();
  for (const [chave, l] of grupos) {
    const r = compararFoto(l, hoje, agoraS, lote, fotoBase);
    fotos.set(chave, r);
    resultados.push({ nome: l.nome, regiao: l.regiao, tipo: l.tipo, linhas: l.linhasLidas, avisos: l.avisos, ...r.resumo });
  }
  reconciliarRmdfNoLote(fotos, fotoBase);
  for(const r of fotos.values()){devolvidas.push(...r.devolvidas);movimentos.push(...r.movimentos);}
  const cadastroAntes=Object.fromEntries(Object.keys(novosTecs).map(tid=>[tid,structuredClone(E.cadastro[tid]||null)]));
  const cadastroImportado=Object.fromEntries(Object.entries(novosTecs).map(([tid,c])=>[tid,{...cadastroAntes[tid],...c}]));
  const catalogoAntes=Object.fromEntries(Object.keys(novosMats).map(mat=>[mat,E.catalogo[mat]??null]));

  // ---------------------------------------------------------- gravação
  if (Object.keys(novosTecs).length) {
    aoProgresso("Cadastrando técnicos novos…");
    await Armazem.mesclar("cadastro/tecnicos", { t: novosTecs }, E.existe.cadastro);
    E.existe.cadastro = true;
  }
  if (Object.keys(novosMats).length) {
    aoProgresso("Atualizando o catálogo de materiais…");
    await Armazem.mesclar("dados/catalogo", { m: novosMats }, E.existe.catalogo);
    E.existe.catalogo = true;
  }

  const entradasIndice = {}, anteriores = {}, apagar = [];
  let n = 0;
  for (const [chave, r] of fotos) {
    const [tipo, regiao] = chave.split(":");
    const l = grupos.get(chave);
    n++;
    aoProgresso(`Salvando ${tipo} de ${regiao} (${n} de ${fotos.size})…`);
    const codificadas = r.linhas.map(tipo === "novas" ? codificarNova : codificarUsada);
    const partes = dividirEmPartes(codificadas);
    for (let i = 0; i < partes.length; i++) {
      await Armazem.gravar(caminhoParte(tipo, regiao, gen, i), { tipo, regiao, gen, parte: i, total: partes.length, itens: partes[i] });
    }
    const atual = (indiceBase.arquivos || {})[chave] || null;
    const anterior = (indiceBase.anterior || {})[chave] || null;
    entradasIndice[chave] = {
      gen, partes: partes.length, itens: codificadas.length, qtd: r.resumo.qtd, linhas: l.linhasLidas,
      em: agoraS, arquivo: l.nome, hash: l.hash, lote,
    };
    anteriores[chave] = atual;
    // a geração anterior à anterior não é mais necessária (o desfazer volta só um passo)
    if (anterior && anterior.gen && anterior.gen !== gen && (!atual || anterior.gen !== atual.gen)) {
      for (let i = 0; i < (anterior.partes || 0); i++) apagar.push(caminhoParte(tipo, regiao, anterior.gen, i));
    }
  }

  aoProgresso("Atualizando o índice…");
  const versao = (indiceBase.versao || 0) + 1;
  const registro = { em: agoraS, por: E.usuario.id || '', arquivos: resultados, avisos, chaves: [...fotos.keys()], devolvidas: somar(devolvidas,d=>d[5]), desfeito: false,
    cadastroAntes,cadastroImportado,catalogoAntes,catalogoImportado:{...novosMats} };
  aoProgresso('Preparando os saldos individuais dos técnicos…');
  const fotoPortal = {usadas:[...fotoBase.usadas],novas:[...fotoBase.novas],rmdf:[...fotoBase.rmdf]};
  for(const [chave,r] of fotos) {
    const [tipo,regiao]=chave.split(':');
    fotoPortal[tipo]=[...fotoPortal[tipo].filter(x=>x.regiao!==regiao),...r.linhas];
  }
  const cadastroPortal=structuredClone(E.cadastro);
  for(const [tid,c] of Object.entries(novosTecs))cadastroPortal[tid]={...cadastroPortal[tid],...c};
  const portal=await prepararSaldosTecnicos(fotoPortal.usadas,fotoPortal.novas,cadastroPortal,{...E.catalogo,...novosMats},versao,fotoPortal.rmdf);
  const reversivel=Object.fromEntries([...fotos.keys()].map(c=>[c,true]));
  const arquivo = await confirmarImportacaoNoBanco({ indice: { arquivos: entradasIndice, anterior: anteriores, reversivel, versao, atualizadoEm: agoraS, origemSessao: Acesso.sessao }, registro, lote, devolvidas, movimentos, hoje, portal });
  E.existe.indice = true;

  // a partir daqui a nova foto é a oficial: atualiza a memória
  E.indice = {
    ...E.indice, versao, atualizadoEm: agoraS,
    arquivos: { ...(E.indice.arquivos || {}), ...entradasIndice },
    anterior: { ...(E.indice.anterior || {}), ...anteriores },
    reversivel: {...E.indice.reversivel,...reversivel},
  };
  E.catalogo = { ...E.catalogo, ...novosMats };
  const cadastro = { ...E.cadastro };
  for (const [tid, c] of Object.entries(novosTecs)) cadastro[tid] = { ...(cadastro[tid] || {}), ...c };
  E.cadastro = cadastro;
  for (const [chave, r] of fotos) {
    const [tipo, regiao] = chave.split(":");
    E[tipo] = [...E[tipo].filter(x => x.regiao !== regiao), ...r.linhas];
  }
  E.devolucoes.push(...arquivo.devolucoes);
  E.movimentos.push(...arquivo.movimentos);
  E.importacoes = [{ id: lote, ...registro }, ...E.importacoes];
  mudou();

  aoProgresso("Registrando o histórico…");
  for (const c of apagar) { try { await Armazem.apagar(c); } catch (e) { console.warn("limpeza", c, e); } }
  await gravarHistoricoDoDia();
  try { await Armazem.gravar("resumo/atual", montarResumo()); } catch (e) { console.warn("resumo", e); }
  mudou();
  return { lote, resultados, avisos, devolvidas: registro.devolvidas };
}

/** Volta a foto anterior das planilhas de uma importação (só a mais recente). */
async function desfazerImportacao(imp) {
  exigirAdministrador();
  const chaves = validarReversaoImportacao(imp,E.indice), versaoAnterior = E.indice.versao || 0;
  const arquivos = {}, anterior = {}, reversivel = {};
  for (const chave of chaves) {
    arquivos[chave] = E.indice.anterior?.[chave] || null; anterior[chave] = null;
    reversivel[chave]=false;
  }
  let devs = await Armazem.consultar('devolucoes',{onde:[['lote','==',imp.id]],preservarHistorico:true});
  if (!devs.length && imp.devolvidas) devs = (await Armazem.consultar('devolucoes',{preservarHistorico:true})).filter(d=>(d.itens||[]).some(l=>l[9]===imp.id));
  const movs = await Armazem.consultar('movimentos',{onde:[['lote','==',imp.id]],preservarHistorico:true});
  const alteracoes = devs.map(d=>[`devolucoes/${d.id}`,{...d,itens:(d.itens||[]).filter(l=>l[9]!==imp.id)}]);
  const fotosRestauradas={usadas:[],novas:[],rmdf:[]};
  for(const [chave,ent]of Object.entries({...E.indice.arquivos,...arquivos}))if(ent?.gen)fotosRestauradas[chave.split(':')[0]].push(...await lerArquivoDoIndice(chave,ent));
  const [cadSnap,catSnap,usuarios,agendas,contatos,anotacoes]=await Promise.all([
    Armazem.ler('cadastro/tecnicos'),Armazem.ler('dados/catalogo'),...['usuarios','agendamentos','contatos','anotacoes'].map(c=>Armazem.consultar(c))
  ]);
  const cadastroBase=cadSnap?.t||{},catalogoBase=catSnap?.m||{};
  const limpeza=planejarLimpezaImportacao(imp,{cadastro:cadastroBase,catalogo:catalogoBase,fotos:fotosRestauradas,usuarios,registros:[...agendas,...contatos,...anotacoes,...E.devolucoes,...E.movimentos]});
  const indice = {arquivos,anterior,reversivel,versao:versaoAnterior+1,atualizadoEm:agoraISO(),origemSessao:Acesso.sessao};
  const registro = {desfeito:true,desfeitoEm:agoraISO(),desfeitoPor:identidadeAtual(),cadastrosRemovidos:limpeza.removidos,backupReversao:{arquivos:Object.fromEntries(chaves.map(c=>[c,E.indice.arquivos[c]])),
    cadastroAntes:Object.fromEntries([...limpeza.removidos,...limpeza.restaurados].map(tid=>[tid,cadastroBase[tid]])),catalogoAntes:Object.fromEntries(Object.keys(imp.catalogoAntes||{}).map(mat=>[mat,catalogoBase[mat]??null]))}};
  if(Acesso.modo==='firebase') {
    const portal=await prepararSaldosTecnicos(fotosRestauradas.usadas,fotosRestauradas.novas,limpeza.cadastro,limpeza.catalogo,indice.versao,fotosRestauradas.rmdf);
    await Acesso.fs.runTransaction(async tx=>{
      const ref = Acesso.fs.doc('dados/indice'),cadRef=Acesso.fs.doc('cadastro/tecnicos'),catRef=Acesso.fs.doc('dados/catalogo');
      const [atual,cadAtual,catAtual]=await Promise.all([tx.get(ref),tx.get(cadRef),tx.get(catRef)]);
      if((atual.data()?.versao||0)!==versaoAnterior) throw new Error('As planilhas foram atualizadas em outra sessão. Recarregue antes de desfazer.');
      if(assinaturaRegistroImportacao(decodificarFS(cadAtual.data()?.t||{}))!==assinaturaRegistroImportacao(cadastroBase)||assinaturaRegistroImportacao(decodificarFS(catAtual.data()?.m||{}))!==assinaturaRegistroImportacao(catalogoBase))throw new Error('O cadastro foi editado durante a reversão. Recarregue antes de desfazer.');
      for(const [c,d] of alteracoes) {
        const {id,...doc}=d;
        if(doc.itens.length)tx.set(Acesso.fs.doc(c),codificarFS(doc));else tx.delete(Acesso.fs.doc(c));
      }
      for(const m of movs)tx.delete(Acesso.fs.doc(`movimentos/${m.id}`));
      tx.set(Acesso.fs.doc('portal/controle'),portal);
      tx.set(Acesso.fs.doc(`importacoes/${imp.id}`),codificarFS(registro),{merge:true});
      tx.set(cadRef,{...cadAtual.data(),t:codificarFS(limpeza.cadastro)});tx.set(catRef,{...catAtual.data(),m:limpeza.catalogo});
      tx.set(ref,codificarFS(indice),{merge:true});
    });
  } else {
    for(const [c,d] of alteracoes) {const {id,...doc}=d;if(doc.itens.length)await Armazem.gravar(c,doc);else await Armazem.apagar(c);}
    for(const m of movs)await Armazem.apagar(`movimentos/${m.id}`);
    await Armazem.mesclar(`importacoes/${imp.id}`,registro,true);
    await Armazem.gravar('cadastro/tecnicos',{...cadSnap,t:limpeza.cadastro});await Armazem.gravar('dados/catalogo',{...catSnap,m:limpeza.catalogo});
    await Armazem.mesclar('dados/indice',indice,true);
  }
  E.cadastro=limpeza.cadastro;E.catalogo=limpeza.catalogo;
  E.indice={...E.indice,...indice,arquivos:{...E.indice.arquivos,...arquivos},anterior:{...E.indice.anterior,...anterior},reversivel:{...E.indice.reversivel,...reversivel}};
  await Promise.all([carregarFotos(),carregarHistoricos()]); mudou();
  await gravarHistoricoDoDia();
  try {await Armazem.gravar('resumo/atual',montarResumo());}catch(e){console.warn('resumo',e);}
  mudou();
  return {cadastrosRemovidos:limpeza.removidos.length};
}
