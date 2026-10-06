/* Localizador de peças: filtros combináveis e exportação do resultado completo. */
const UIconsulta = { filtros: { ...FILTROS_CONSULTA }, pagina: 1, visao: 'pecas', ordem: 'tecnico', avancados: false };
const ROTULOS_CONSULTA = { busca: 'Peça', correspondencia: 'Busca', tecnico: 'Técnico', tid: 'Técnico selecionado', tipo: 'Tipo', origem: 'Origem', regiao: 'UF', familia: 'Família', situacao: 'Situação', envio: 'Envio', documento: 'Documento', inicio: 'Desde', fim: 'Até', diasMin: 'Dias mín.', diasMax: 'Dias máx.', qtdMin: 'Qtd. mín.', qtdMax: 'Qtd. máx.', responsavel: 'Responsável' };
function filtrosAtivosConsulta() { return Object.entries(UIconsulta.filtros).filter(([k,v]) => v !== FILTROS_CONSULTA[k]); }
function aplicarConsulta(form) {
  const dados = new FormData(form), f = { ...FILTROS_CONSULTA };
  for (const k of Object.keys(f)) f[k] = limpar(dados.get(k) || '');
  for (const [min,max,nome] of [['inicio','fim','datas'],['diasMin','diasMax','dias'],['qtdMin','qtdMax','quantidades']]) {
    if (f[min] && f[max] && (min === 'inicio' ? f[min] > f[max] : Number(f[min]) > Number(f[max]))) { toast(`Confira o intervalo de ${nome}: o mínimo deve ser menor ou igual ao máximo.`, 'erro'); return; }
  }
  UIconsulta.filtros = f; UIconsulta.pagina = 1; UIconsulta.avancados = !!form.querySelector('details')?.open;
  renderizar(true);
  document.querySelector('#consulta-resultados')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
function consultaOrdenada() {
  const lista = filtrarConsulta(linhasConsulta(), UIconsulta.filtros);
  return lista.sort((a,b) => UIconsulta.ordem === 'quantidade' ? b.qtd-a.qtd || comparar(a.nome,b.nome) : UIconsulta.ordem === 'idade' ? (b.dias || 0)-(a.dias || 0) || comparar(a.nome,b.nome) : UIconsulta.ordem === 'material' ? comparar(a.mat,b.mat) || comparar(a.nome,b.nome) : comparar(a.nome,b.nome) || comparar(a.mat,b.mat));
}
function renderConsulta() {
  const D = derivar(), f = UIconsulta.filtros, lista = consultaOrdenada();
  const todas = linhasConsulta(D), familias = [...new Set(todas.map((i) => i.familia))].sort(comparar);
  const select = (campo, nome, opcoes) => `<label class="campo"><span>${nome}</span><select name="${campo}">${opcoes.map(([v,n]) => `<option value="${esc(v)}" ${f[campo] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  const input = (campo,nome,tipo='text',placeholder='') => `<label class="campo"><span>${nome}</span><input type="${tipo}" name="${campo}" value="${esc(f[campo])}" placeholder="${esc(placeholder)}" ${tipo === 'number' ? 'min="0" step="1"' : ''}></label>`;
  const opcoesSituacao = [['','Qualquer situação'],['atrasada','Acima do prazo'],['em_dia','Dentro do prazo'],['vencendo','Vence em breve (usadas)'],['aguardando','Com previsão (usadas)'],['previsao_vencida','Previsão vencida (usadas)'],['pendente','Saída a classificar (novas)'],['uso','Uso confirmado (novas)'],['transferencia','Transferência / ajuste (novas)']];
  const formulario = `<form class="consulta-form" data-form="consulta">
    <div class="consulta-busca"><label class="campo"><span>Nome ou código da peça</span><span class="consulta-entrada">${icone('busca')}<input type="search" name="busca" value="${esc(f.busca)}" placeholder="Ex.: memória 8GB ou 11155371" aria-describedby="consulta-ajuda"></span></label>${select('correspondencia','Correspondência',[['termos','Nome ou parte do código'],['codigo','Código exato']])}<button type="submit" class="btn prim">${icone('busca')}Localizar peças</button></div>
    <p class="nota" id="consulta-ajuda">Combine palavras para refinar. Separe por vírgula para buscar vários códigos ou descrições. Códigos aceitam zeros à esquerda.</p>
    <div class="consulta-filtros-base">${input('tecnico','Nome do técnico','search','Todos os técnicos')}${select('tipo','Tipo de peça',[['','Novas e usadas'],['usadas','Usadas'],['novas','Novas']])}${select('origem','Onde consultar',[['atual','Com técnicos / bases'],['devolvida','Devoluções registradas'],['saida','Saídas de novas'],['','Posição e histórico']])}${select('regiao','Estado',[['','Todas as UFs'],...D.regioes.map((r) => [r,r])])}</div>
    <input type="hidden" name="tid" value="${esc(f.tid)}">
    <details class="consulta-avancados" ${UIconsulta.avancados ? 'open' : ''}><summary>${icone('filtro')}Filtros avançados <span>Prazo, material, envio e documentos</span></summary><div class="consulta-filtros-extra">
      ${select('familia','Família (pela descrição)',[['','Todas as famílias'],...familias.map((r) => [r,r])])}${select('situacao','Situação',opcoesSituacao)}${select('envio','Tipo de envio · novas',[['','Todos os envios'],...D.tiposEnvio.map((r) => [r,r])])}${select('responsavel','Responsáveis',[['tecnico','Somente técnicos'],['base','Somente bases / depósitos'],['','Técnicos e bases']])}
      ${input('documento','Chamado, NF ou remessa','search','Dados disponíveis no relatório')}${input('inicio','Data inicial','date')}${input('fim','Data final','date')}<p class="consulta-explicacao">Datas: Data FT para usadas em aberto; primeira observação para novas; saída do relatório para o histórico.</p>
      ${input('diasMin','Dias com a peça · mínimo','number')}${input('diasMax','Dias com a peça · máximo','number')}${input('qtdMin','Quantidade por registro · mín.','number')}${input('qtdMax','Quantidade por registro · máx.','number')}
    </div><div class="consulta-aplicar"><button type="submit" class="btn prim">Aplicar filtros</button></div></details>
  </form>`;
  const ativos = filtrosAtivosConsulta();
  const chips = ativos.length ? `<div class="consulta-ativos"><span>Filtros aplicados</span>${ativos.map(([k,v]) => `<button class="chip" data-acao="consulta-remover" data-campo="${k}" aria-label="Remover filtro ${esc(ROTULOS_CONSULTA[k])}">${esc(ROTULOS_CONSULTA[k])}: ${esc(k === 'tid' ? nomeTecnico(v) : v || 'Todos')}${icone('fechar')}</button>`).join('')}<button class="btn fantasma pequeno" data-acao="consulta-limpar">Limpar filtros</button></div>` : '';
  const resumo = `<dl class="consulta-metricas" aria-live="polite"><div><dt>Peças no resultado</dt><dd>${fmtNum(somar(lista,(i) => i.qtd))}</dd></div><div><dt>Materiais diferentes</dt><dd>${fmtNum(new Set(lista.map((i) => i.mat)).size)}</dd></div><div><dt>Responsáveis</dt><dd>${fmtNum(new Set(lista.map((i) => i.tid)).size)}</dd></div><div class="metrica-atraso"><dt>Peças acima do prazo</dt><dd>${fmtNum(somar(lista.filter((i) => i.atrasada),(i) => i.qtd))}</dd></div></dl>`;
  const barra = `<div class="consulta-resultados-topo"><div class="filtros-segmentados" role="group" aria-label="Agrupamento da consulta">${[['pecas','Por peça'],['tecnicos','Por responsável']].map(([v,n]) => `<button class="${UIconsulta.visao === v ? 'ativo' : ''}" data-acao="consulta-visao" data-valor="${v}" aria-pressed="${UIconsulta.visao === v}">${n}</button>`).join('')}</div><div><select data-mudar="consulta-ordem" aria-label="Ordenar resultados">${[['tecnico','Nome do responsável'],['material','Código da peça'],['quantidade','Maior quantidade'],['idade','Mais dias com a peça']].filter(([v]) => UIconsulta.visao !== 'tecnicos' || v !== 'material').map(([v,n]) => `<option value="${v}" ${UIconsulta.ordem === v ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn pequeno" data-acao="consulta-exportar" ${lista.length ? '' : 'disabled'}>${icone('baixar')}Exportar resultado</button></div></div>`;
  const conteudo = !lista.length ? vazio('busca','Nenhuma peça encontrada','Revise os filtros ou importe uma planilha atualizada.','<button class="btn" data-acao="consulta-limpar">Limpar filtros</button>') : UIconsulta.visao === 'tecnicos' ? tabelaConsultaTecnicos(lista) : tabelaConsultaPecas(lista);
  return `<section class="consulta-intro"><div><span class="sobretitulo">LOCALIZADOR DE MATERIAIS</span><h2>Encontre a peça. Identifique o responsável.</h2><p>Cruze estoque e devoluções pelo código, descrição ou técnico.</p></div>${icone('busca')}</section>${cartao('Consulta avançada',formulario,{classe:'cartao-consulta'})}${chips}<section id="consulta-resultados" aria-label="Resultados da consulta">${resumo}${barra}${conteudo}</section><p class="nota consulta-rodape">A posição depende das últimas planilhas importadas. O histórico de saídas é consultado nos últimos 120 dias; novas começam a ter baixas registradas a partir desta atualização. As famílias são identificadas pela descrição do material.</p>`;
}
function paginaConsulta(lista) {
  UIconsulta.pagina = Math.min(UIconsulta.pagina, Math.max(1,Math.ceil(lista.length/50)));
  return lista.slice((UIconsulta.pagina-1)*50, UIconsulta.pagina*50);
}
function tabelaConsultaPecas(lista) {
  const linhas = paginaConsulta(lista);
  return `<div class="tabela-rolagem"><table class="tabela tabela-consulta"><thead><tr><th>Peça / material</th><th>Responsável</th><th>Tipo</th><th>Qtd.</th><th>Situação</th><th>Data de referência</th><th>Dias</th><th>Documentos / envio</th><th>Ações</th></tr></thead><tbody>${linhas.map((i) => `<tr>
    <td><span class="consulta-material"><strong class="mono">${esc(i.mat)}</strong><span>${esc(i.desc || 'Sem descrição')}</span><small>${esc(i.familia)}</small></span></td>
    <td><button class="link-forte" data-acao="tecnico" data-tid="${esc(i.tid)}">${esc(i.nome)}</button><small class="sub-celula">${esc(i.regiao)} · ${TIPOS_TEC[i.tipoTec]}</small></td>
    <td>${pill(i.tipo === 'usadas' ? 'alerta' : 'info',i.tipo === 'usadas' ? 'Usada' : 'Nova')}</td><td class="num"><strong>${fmtNum(i.qtd)}</strong></td>
    <td>${pill(i.origem === 'atual' && i.atrasada ? 'crit' : i.origem === 'atual' ? 'ok' : i.status === 'pendente' ? 'alerta' : 'neutro',i.situacao)}${i.previsao ? `<small class="sub-celula">Previsão ${fmtData(i.previsao)}</small>` : ''}</td>
    <td class="nowrap">${i.data ? fmtData(i.data) : '—'}<small class="sub-celula">${esc(i.referencia)}</small></td><td class="num">${i.dias == null ? '—' : fmtNum(i.dias)}<small class="sub-celula">Prazo ${i.prazo} d</small></td>
    <td>${i.chamado ? `<span class="mono">${esc(i.chamado)}</span>` : i.tipoEnvio ? esc(i.tipoEnvio) : '—'}${i.nf ? `<small class="sub-celula">NF ${esc(i.nf)}</small>` : ''}${i.remessa ? `<small class="sub-celula">Remessa ${esc(i.remessa)}</small>` : ''}</td>
    <td>${i.origem === 'saida' ? `<button class="btn pequeno" data-acao="consulta-classificar" data-k="${esc(i.k)}">${i.destino === 'pendente' ? 'Classificar saída' : 'Alterar destino'}</button>` : `<button class="btn pequeno" data-acao="tecnico" data-tid="${esc(i.tid)}">Ver técnico</button>`}</td></tr>`).join('')}</tbody></table></div>${paginacao(lista.length,UIconsulta.pagina,50,'consulta')}`;
}
function tabelaConsultaTecnicos(lista) {
  const grupos = [...agrupar(lista,(i) => i.tid)].map(([tid,itens]) => ({ tid, nome: itens[0].nome, regioes: [...new Set(itens.map((i) => i.regiao))].join(', '), qtd: somar(itens,(i) => i.qtd), usadas: somar(itens.filter((i) => i.tipo === 'usadas'),(i) => i.qtd), novas: somar(itens.filter((i) => i.tipo === 'novas'),(i) => i.qtd), materiais: new Set(itens.map((i) => i.mat)).size, atraso: somar(itens.filter((i) => i.atrasada),(i) => i.qtd), dias: Math.max(...itens.map((i) => i.dias || 0)) }));
  grupos.sort((a,b) => UIconsulta.ordem === 'quantidade' ? b.qtd-a.qtd : UIconsulta.ordem === 'idade' ? b.dias-a.dias : comparar(a.nome,b.nome));
  return `<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Responsável</th><th>UF</th><th>Materiais</th><th>Usadas</th><th>Novas</th><th>Total</th><th>Acima do prazo</th><th></th></tr></thead><tbody>${paginaConsulta(grupos).map((g) => `<tr><td><span class="celula-tec">${avatar(g.nome,'tecnico')}<button class="link-forte" data-acao="tecnico" data-tid="${esc(g.tid)}">${esc(g.nome)}</button></span></td><td>${esc(g.regioes)}</td><td class="num">${fmtNum(g.materiais)}</td><td class="num">${fmtNum(g.usadas)}</td><td class="num">${fmtNum(g.novas)}</td><td class="num"><strong>${fmtNum(g.qtd)}</strong></td><td class="num">${fmtNum(g.atraso)}</td><td><button class="btn pequeno" data-acao="consulta-responsavel" data-tid="${esc(g.tid)}">Ver peças</button></td></tr>`).join('')}</tbody></table></div>${paginacao(grupos.length,UIconsulta.pagina,50,'consulta')}`;
}
async function exportarConsulta() {
  const lista = consultaOrdenada();
  await exportarExcel(`consulta-pecas-${hojeISO()}.xlsx`, [{ nome: 'Peças filtradas', colunas: ['Código','Descrição','Família','Responsável','UF','Tipo','Origem','Quantidade','Situação','Data de referência','Referência da data','Dias','Chamado','NF','Remessa','Tipo de envio','Prazo aplicado (dias)'].map((titulo,n) => ({ titulo, largura: [1,3].includes(n) ? 36 : 20, tipo: [7,11,16].includes(n) ? 'numero' : 'texto' })), linhas: lista.map((i) => [i.mat,i.desc,i.familia,i.nome,i.regiao,i.tipo,i.origem,i.qtd,i.situacao,i.data,i.referencia,i.dias,i.chamado || '',i.nf || '',i.remessa || '',i.tipoEnvio || '',i.prazo]) }]);
}
function modalClassificarSaida(k) {
  const i = E.movimentos.find((m) => m.k === k); if (!i) return;
  const m = abrirModal({ titulo: 'Classificar saída de peças novas', subtitulo: `${nomeTecnico(i.tid)} · ${plural(i.qtd,'peça','peças')}`,
    corpo: `<p class="texto-modal"><strong>${esc(i.mat)}</strong> · ${esc(E.catalogo[i.mat] || '')}</p><p class="nota">O saldo diminuiu na importação de ${fmtData(i.em)}. Informe o destino confirmado para atualizar os rankings. A data é a da observação no relatório.</p><label class="campo"><span>Quantidade a classificar</span><input type="number" id="quantidade-saida" min="1" max="${i.qtd}" step="1" value="${i.qtd}" required><small>Se a saída teve mais de um destino, classifique uma parte de cada vez.</small></label><label class="campo"><span>Destino confirmado</span><select id="destino-saida">${Object.entries(DESTINOS_NOVAS).map(([v,n]) => `<option value="${v}" ${i.destino === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`,
    rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn prim" data-salvar-destino>Salvar destino</button>' });
  m.el.querySelector('[data-salvar-destino]').addEventListener('click', async (ev) => {
    const quantidade = m.el.querySelector('#quantidade-saida');
    if (!quantidade.reportValidity()) return;
    const btn = ev.currentTarget; btn.disabled = true;
    try { await classificarSaida(k,m.el.querySelector('#destino-saida').value, Number(quantidade.value)); m.fechar(); toast('Destino salvo. Rankings atualizados.'); renderizar(true); }
    catch (e) { toast(erroAmigavel(e).message,'erro'); btn.disabled = false; }
  });
}
