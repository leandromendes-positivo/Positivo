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
  if (lido.tipo === "usadas") {
    const anteriores = new Map(foto.usadas.filter((u) => u.regiao === R).map((u) => [u.k, u]));
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
      em: agoraS, dias: Math.max(0, diffDias(ant.desde, hoje)), prazo: prazoDoTecnico(ant.tid, 'novas'), destino: "pendente" });
  }
  return {
    linhas, devolvidas: [], movimentos,
    resumo: {
      entradas, alterados, saidas, qtd: somar(linhas, (n) => n.qtd), itens: linhas.length,
      qtdAntes: somar([...anteriores.values()], (n) => n.qtd),
    },
  };
}

/** Saldo oficial e arquivo de saídas entram juntos no Firebase. */
async function confirmarImportacaoNoBanco({ indice, registro, lote, devolvidas, movimentos, hoje }) {
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
  const fotoBase = { usadas: E.usadas, novas: E.novas };
  if (Armazem.online) {
    aoProgresso('Conferindo o estoque anterior…');
    const entradas = Object.entries(indiceBase.arquivos || {}).filter(([,ent]) => ent && ent.gen);
    const listas = await Promise.all(entradas.map(([chave,ent]) => lerArquivoDoIndice(chave,ent)));
    fotoBase.usadas = []; fotoBase.novas = [];
    entradas.forEach(([chave],i) => fotoBase[chave.split(':')[0]].push(...listas[i]));
  }

  const grupos = new Map();
  for (const l of lidos) {
    const chave = `${l.tipo}:${l.regiao}`;
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

  // novas fotos
  const resultados = [];
  const devolvidas = [];
  const movimentos = [];
  const fotos = new Map();
  for (const [chave, l] of grupos) {
    const r = compararFoto(l, hoje, agoraS, lote, fotoBase);
    fotos.set(chave, r);
    devolvidas.push(...r.devolvidas);
    movimentos.push(...r.movimentos);
    resultados.push({ nome: l.nome, regiao: l.regiao, tipo: l.tipo, linhas: l.linhasLidas, avisos: l.avisos, ...r.resumo });
  }

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
    const codificadas = r.linhas.map(tipo === "usadas" ? codificarUsada : codificarNova);
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
  const registro = { em: agoraS, por: E.usuario.id || '', arquivos: resultados, avisos, chaves: [...fotos.keys()], devolvidas: somar(devolvidas,d=>d[5]), desfeito: false };
  const arquivo = await confirmarImportacaoNoBanco({ indice: { arquivos: entradasIndice, anterior: anteriores, versao, atualizadoEm: agoraS, origemSessao: Acesso.sessao }, registro, lote, devolvidas, movimentos, hoje });
  E.existe.indice = true;

  // a partir daqui a nova foto é a oficial: atualiza a memória
  E.indice = {
    ...E.indice, versao, atualizadoEm: agoraS,
    arquivos: { ...(E.indice.arquivos || {}), ...entradasIndice },
    anterior: { ...(E.indice.anterior || {}), ...anteriores },
  };
  E.catalogo = { ...E.catalogo, ...novosMats };
  const cadastro = { ...E.cadastro };
  for (const [tid, c] of Object.entries(novosTecs)) cadastro[tid] = { ...(cadastro[tid] || {}), ...c };
  E.cadastro = cadastro;
  for (const [chave, r] of fotos) {
    const [tipo, regiao] = chave.split(":");
    if (tipo === "usadas") E.usadas = [...E.usadas.filter((u) => u.regiao !== regiao), ...r.linhas];
    else E.novas = [...E.novas.filter((x) => x.regiao !== regiao), ...r.linhas];
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
  const chaves = imp.chaves || [], versaoAnterior = E.indice.versao || 0;
  for (const chave of chaves) {
    if (E.indice.arquivos?.[chave]?.lote !== imp.id) throw new Error('Só dá para desfazer a importação mais recente de cada planilha.');
  }
  const arquivos = {}, anterior = {}, apagar = [];
  for (const chave of chaves) {
    const [tipo,regiao] = chave.split(':'), atual = E.indice.arquivos[chave];
    arquivos[chave] = E.indice.anterior?.[chave] || null; anterior[chave] = null;
    for (let i=0;i<(atual.partes||0);i++) apagar.push(caminhoParte(tipo,regiao,atual.gen,i));
  }
  let devs = await Armazem.consultar('devolucoes',{onde:[['lote','==',imp.id]]});
  if (!devs.length && imp.devolvidas) devs = (await Armazem.consultar('devolucoes')).filter(d=>(d.itens||[]).some(l=>l[9]===imp.id));
  const movs = await Armazem.consultar('movimentos',{onde:[['lote','==',imp.id]]});
  const alteracoes = devs.map(d=>[`devolucoes/${d.id}`,{...d,itens:(d.itens||[]).filter(l=>l[9]!==imp.id)}]);
  const indice = {arquivos,anterior,versao:versaoAnterior+1,atualizadoEm:agoraISO(),origemSessao:Acesso.sessao};
  const registro = {desfeito:true,desfeitoEm:agoraISO(),desfeitoPor:identidadeAtual()};
  if(Acesso.modo==='firebase') {
    await Acesso.fs.runTransaction(async tx=>{
      const ref = Acesso.fs.doc('dados/indice'), atual=await tx.get(ref);
      if((atual.data()?.versao||0)!==versaoAnterior) throw new Error('As planilhas foram atualizadas em outra sessão. Recarregue antes de desfazer.');
      for(const [c,d] of alteracoes) {
        const {id,...doc}=d;
        if(doc.itens.length)tx.set(Acesso.fs.doc(c),codificarFS(doc));else tx.delete(Acesso.fs.doc(c));
      }
      for(const m of movs)tx.delete(Acesso.fs.doc(`movimentos/${m.id}`));
      tx.set(Acesso.fs.doc(`importacoes/${imp.id}`),codificarFS(registro),{merge:true});
      tx.set(ref,codificarFS(indice),{merge:true});
    });
  } else {
    for(const [c,d] of alteracoes) {const {id,...doc}=d;if(doc.itens.length)await Armazem.gravar(c,doc);else await Armazem.apagar(c);}
    for(const m of movs)await Armazem.apagar(`movimentos/${m.id}`);
    await Armazem.mesclar(`importacoes/${imp.id}`,registro,true);
    await Armazem.mesclar('dados/indice',indice,true);
  }
  E.indice={...E.indice,...indice,arquivos:{...E.indice.arquivos,...arquivos},anterior:{...E.indice.anterior,...anterior}};
  for(const c of apagar) {try {await Armazem.apagar(c);}catch(e){console.warn('limpeza',e);}}
  await Promise.all([carregarFotos(),carregarHistoricos()]); mudou();
  await gravarHistoricoDoDia();
  try {await Armazem.gravar('resumo/atual',montarResumo());}catch(e){console.warn('resumo',e);}
  mudou();
}
