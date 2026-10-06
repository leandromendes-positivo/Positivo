/* ==========================================================================
   Importação diária.

   Cada planilha é a FOTO do momento de uma região: o que está nela continua
   com o técnico; o que sumiu desde a última importação saiu (peça usada
   devolvida / peça nova consumida). A foto é gravada em partes com uma
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
function compararFoto(lido, hoje, agoraS, lote) {
  const R = lido.regiao;
  if (lido.tipo === "usadas") {
    const anteriores = new Map(E.usadas.filter((u) => u.regiao === R).map((u) => [u.k, u]));
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
      u.qtdUso, Number(E.config.prazo) || 7, u.desde, u.nf || "", u.remessa || "",
    ]);
    return {
      linhas: novas, devolvidas, movimentos: [],
      resumo: { entradas, mantidos, saidas: saidas.length, saidasQtd: somar(saidas, (u) => u.qtd), qtd: somar(novas, (u) => u.qtd), itens: novas.length },
    };
  }
  // novas: agrega por técnico + material + tipo de envio
  const anteriores = new Map(E.novas.filter((n) => n.regiao === R).map((n) => [`${n.tid}|${n.mat}|${n.tipoEnvio}`, n]));
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
      em: agoraS, dias: Math.max(0, diffDias(ant.desde, hoje)), prazo: Number(E.config.prazoNovas) || 7, destino: "pendente" });
  }
  return {
    linhas, devolvidas: [], movimentos,
    resumo: {
      entradas, alterados, saidas, qtd: somar(linhas, (n) => n.qtd), itens: linhas.length,
      qtdAntes: somar([...anteriores.values()], (n) => n.qtd),
    },
  };
}

/** Acrescenta as devoluções do dia (vários documentos se o dia for grande). */
async function gravarDevolucoes(hoje, linhas) {
  if (!linhas.length) return;
  let sufixo = 1, doc = null, id = hoje;
  for (;;) {
    id = sufixo === 1 ? hoje : `${hoje}.${sufixo}`;
    doc = await Armazem.ler(`devolucoes/${id}`);
    if (!doc) break;
    const tam = JSON.stringify(doc.itens || []).length;
    if (tam + JSON.stringify(linhas).length < LIMITE_PARTE) break;
    sufixo++;
  }
  const itens = [...((doc && doc.itens) || []), ...linhas];
  await Armazem.gravar(`devolucoes/${id}`, { data: hoje, itens, atualizadoEm: agoraISO() });
}

/**
 * Importa um conjunto de planilhas já lidas.
 * aoProgresso(texto) recebe mensagens para a tela.
 */
async function importarLote(lidos, aoProgresso = () => {}) {
  const hoje = hojeISO();
  const agoraS = agoraISO();
  const lote = "L" + carimbo() + Math.random().toString(36).slice(2, 6);
  const gen = "g" + carimbo();
  const avisos = [];

  // compara sempre com a foto mais recente (outro aparelho pode ter importado antes)
  if (Armazem.online) {
    const idx = await Armazem.ler("dados/indice");
    if (idx && (idx.versao || 0) !== (E.indice.versao || 0)) {
      aoProgresso("Atualizando com a importação feita em outro aparelho…");
      E.indice = { arquivos: {}, anterior: {}, ...idx };
      E.existe.indice = true;
      const cat = await Armazem.ler("dados/catalogo");
      if (cat) { E.catalogo = cat.m || {}; E.existe.catalogo = true; }
      await carregarFotos();
    }
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
          tipo: /^\d+$/.test(it.tecChave) ? "base" : "tecnico",
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
    const r = compararFoto(l, hoje, agoraS, lote);
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
    const atual = (E.indice.arquivos || {})[chave] || null;
    const anterior = (E.indice.anterior || {})[chave] || null;
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
  const versao = (E.indice.versao || 0) + 1;
  E.versoesProprias.add(versao);
  await Armazem.mesclar("dados/indice", { arquivos: entradasIndice, anterior: anteriores, versao, atualizadoEm: agoraS }, E.existe.indice);
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
  for (const d of devolvidas) {
    E.devolucoes.push(decodificarDevolucao(d, hoje));
  }
  const registro = {
    em: agoraS, por: E.usuario.id || "", arquivos: resultados, avisos, chaves: [...fotos.keys()],
    devolvidas: somar(devolvidas, (d) => d[5]), desfeito: false,
  };
  E.importacoes = [{ id: lote, ...registro }, ...E.importacoes];
  mudou();

  aoProgresso("Registrando o histórico…");
  for (const c of apagar) { try { await Armazem.apagar(c); } catch (e) { console.warn("limpeza", c, e); } }
  await gravarDevolucoes(hoje, devolvidas);
  const partesMovimentos = movimentos.length ? dividirEmPartes(movimentos) : [];
  for (let i = 0; i < partesMovimentos.length; i++) {
    const id = `${lote}-${i}`;
    await Armazem.gravar(`movimentos/${id}`, { data: hoje, lote, itens: partesMovimentos[i] });
    E.movimentos = [...E.movimentos.filter((m) => m.doc !== id), ...partesMovimentos[i].map((m) => ({ ...m, doc: id }))];
  }
  await Armazem.gravar(`importacoes/${lote}`, registro);
  await gravarHistoricoDoDia();
  try { await Armazem.gravar("resumo/atual", montarResumo()); } catch (e) { console.warn("resumo", e); }
  mudou();
  return { lote, resultados, avisos, devolvidas: registro.devolvidas };
}

/** Volta a foto anterior das planilhas de uma importação (só a mais recente). */
async function desfazerImportacao(imp) {
  const chaves = imp.chaves || [];
  for (const chave of chaves) {
    const atual = (E.indice.arquivos || {})[chave];
    if (!atual || atual.lote !== imp.id) {
      throw new Error("Só dá para desfazer a importação mais recente de cada planilha.");
    }
  }
  const arquivos = {}, anterior = {}, apagar = [];
  for (const chave of chaves) {
    const [tipo, regiao] = chave.split(":");
    const atual = E.indice.arquivos[chave];
    arquivos[chave] = (E.indice.anterior || {})[chave] || null;
    anterior[chave] = null;
    for (let i = 0; i < (atual.partes || 0); i++) apagar.push(caminhoParte(tipo, regiao, atual.gen, i));
  }
  const versao = (E.indice.versao || 0) + 1;
  E.versoesProprias.add(versao);
  await Armazem.mesclar("dados/indice", { arquivos, anterior, versao, atualizadoEm: agoraISO() }, true);
  E.indice = {
    ...E.indice, versao,
    arquivos: { ...E.indice.arquivos, ...arquivos },
    anterior: { ...E.indice.anterior, ...anterior },
  };
  for (const c of apagar) { try { await Armazem.apagar(c); } catch (e) { console.warn(e); } }

  // tira as devoluções registradas por esta importação
  const docs = [...new Set(E.devolucoes.filter((d) => d.lote === imp.id).map((d) => d.doc))];
  for (const id of docs) {
    const doc = await Armazem.ler(`devolucoes/${id}`);
    if (!doc) continue;
    const itens = (doc.itens || []).filter((l) => l[9] !== imp.id);
    if (itens.length) await Armazem.gravar(`devolucoes/${id}`, { ...doc, itens });
    else await Armazem.apagar(`devolucoes/${id}`);
  }
  await Armazem.mesclar(`importacoes/${imp.id}`, { desfeito: true, desfeitoEm: agoraISO() }, true);
  const movs = await Armazem.consultar("movimentos", { onde: [["lote", "==", imp.id]] });
  for (const doc of movs) await Armazem.apagar(`movimentos/${doc.id}`);
  await Promise.all([carregarFotos(), carregarHistoricos()]);
  mudou();
  await gravarHistoricoDoDia();
  try { await Armazem.gravar("resumo/atual", montarResumo()); } catch (e) { console.warn(e); }
  mudou();
}
