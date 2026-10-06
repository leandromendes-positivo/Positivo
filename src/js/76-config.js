/* ==========================================================================
   Página: Configurações (regras, mensagens, notificação e dados).
   ========================================================================== */

function renderConfig() {
  const D = derivar();
  const c = E.config;
  const ignorados = new Set(c.tiposIgnorados || []);
  const tipos = D.tiposEnvio.length ? D.tiposEnvio : ["BACKUP", "PP", "REP. BACKUP"];
  const exemplo = D.cobrarTec[0] || D.tecnicos.find((t) => t.usadas.length);
  const previa = exemplo ? montarMensagem(exemplo, exemplo.itensCobrar.length ? exemplo.itensCobrar : exemplo.usadas, c.msgCobranca) : "";

  return `<div class="grade-config">
    ${cartao("Regras do controle", `<form class="form" data-form="regras">
      <div class="campos-2">
        <label class="campo"><span>Prazo geral para devolver peça usada</span><div class="com-sufixo"><input type="number" min="1" max="90" name="prazo" value="${esc(c.prazo)}" required><em>dias</em></div><small>Vale para quem não tem prazo próprio no cadastro do técnico.</small></label>
        <label class="campo"><span>Avisar "vence em breve" a partir de</span><div class="com-sufixo"><input type="number" min="0" max="90" name="alerta" value="${esc(c.alerta)}" required><em>dias</em></div><small>Para lembrar o técnico antes de atrasar.</small></label>
        <label class="campo"><span>Prazo geral observado de peças novas</span><div class="com-sufixo"><input type="number" min="1" max="90" name="prazoNovas" value="${esc(c.prazoNovas)}" required><em>dias</em></div><small>Contado da primeira observação do material. Prazos próprios do técnico prevalecem.</small></label>
        <label class="campo"><span>Meta de peças novas por técnico</span><div class="com-sufixo"><input type="number" min="0" max="10000" name="meta" value="${esc(c.meta)}" required><em>peças</em></div><small>Pode ser trocada por técnico no cadastro.</small></label>
        <label class="campo"><span>Tolerância da meta</span><div class="com-sufixo"><input type="number" min="0" max="1000" name="tolerancia" value="${esc(c.tolerancia)}" required><em>± peças</em></div><small>Na meta = entre ${Math.max(0, c.meta - c.tolerancia)} e ${Number(c.meta) + Number(c.tolerancia)} peças.</small></label>
      </div>
      <fieldset class="campo"><legend>Tipos de envio que contam no estoque de novas</legend>
        <div class="checks">${tipos.map((t) => `<label class="check-inline"><input type="checkbox" name="tipo" value="${esc(t)}" ${ignorados.has(t) ? "" : "checked"}> ${tagTipoEnvio(t)}</label>`).join("")}</div>
        <small>Desmarque um tipo (por exemplo PP, peça enviada para um chamado específico) se ele não deve contar na meta.</small>
      </fieldset>
      <div class="form-acoes"><button class="btn prim" type="submit">Salvar regras</button></div>
    </form>`)}

    ${cartao("Mensagens de cobrança", `<form class="form" data-form="mensagens">
      <label class="campo"><span>Cobrança (peças atrasadas)</span><textarea name="msgCobranca" rows="8">${esc(c.msgCobranca)}</textarea></label>
      <label class="campo"><span>Lembrete (peças que vencem em breve)</span><textarea name="msgLembrete" rows="5">${esc(c.msgLembrete)}</textarea></label>
      <p class="nota">Campos que o sistema preenche: <span class="mono">{saudacao}</span> <span class="mono">{nome}</span> <span class="mono">{nome_completo}</span> <span class="mono">{qtd}</span> <span class="mono">{lista}</span> <span class="mono">{prazo}</span> <span class="mono">{regiao}</span></p>
      ${previa ? `<details class="previa"><summary>Ver exemplo com ${esc(exemplo.nome)}</summary><pre class="msg-previa"></pre></details>` : ""}
      <div class="form-acoes"><button class="btn fantasma" type="button" data-acao="restaurar-msgs">Voltar ao texto padrão</button><button class="btn prim" type="submit">Salvar mensagens</button></div>
    </form>`)}

    ${cartao("Aviso diário", `<div class="texto-cartao">
      ${Acesso.modo === "claude" ? `<p>Todo dia útil de manhã, o Claude lê o resumo deste painel e manda para o seu <strong>celular e e-mail</strong> a lista de técnicos que você deve cobrar, quantas peças e há quantos dias.</p>
      <p>O resumo é atualizado sozinho a cada importação e a cada cobrança ou previsão registrada aqui. Para mudar o horário ou os dias do aviso, peça ao Claude na conversa onde este painel foi criado.</p>`
      : `<p>Todo dia útil às 7h55, o GitHub (Actions) lê o resumo deste painel no Firebase e manda por <strong>e-mail</strong> a lista de técnicos que você deve cobrar, quantas peças e há quantos dias.</p>
      <p>O resumo é atualizado sozinho a cada importação e a cada cobrança ou previsão registrada aqui. O envio usa os segredos do repositório (conta de serviço do Firebase e senha de app do Gmail); o passo a passo está no README.</p>`}
      <p class="nota">${Armazem.online ? `${icone("ok")}Resumo salvo online.` : `${icone("alerta")}Sem banco de dados nesta visualização: o resumo não está sendo salvo.`}</p>
    </div>`)}

    ${cartao("Banco de dados", cartaoBanco())}

    ${cartao("Seus dados", `<div class="texto-cartao">
      <p>${Armazem.online ? `${icone("nuvem")} Os dados ficam salvos online, junto com este painel, e aparecem em qualquer dispositivo onde você abrir o link.` : `${icone("alerta")} Esta visualização não tem acesso ao banco de dados: nada do que você importar será salvo.`}</p>
      <ul class="lista-dados">
        <li><strong>${fmtNum(E.usadas.length)}</strong> linhas de peças usadas e <strong>${fmtNum(E.novas.length)}</strong> materiais em estoque de novas</li>
        <li><strong>${fmtNum(Object.keys(E.cadastro).length)}</strong> técnicos e bases no cadastro</li>
        <li><strong>${fmtNum(E.devolucoes.length)}</strong> devoluções e <strong>${fmtNum(E.importacoes.length)}</strong> importações nos últimos meses</li>
      </ul>
      <div class="form-acoes"><button class="btn" data-acao="exportar-tudo">${icone("baixar")}Baixar tudo em Excel</button></div>
    </div>`)}
  </div>`;
  // (a prévia da mensagem entra por textContent em posRender)
}

function cartaoBanco() {
  if (Acesso.modo === "claude") {
    return `<div class="texto-cartao"><p>${icone("nuvem")}Os dados ficam no banco do próprio painel publicado no Claude.</p></div>`;
  }
  if (Acesso.modo === "firebase" && Armazem.online) {
    return `<div class="texto-cartao">
      <p>${icone("nuvem")}Os dados ficam no Firebase, projeto <span class="mono">${esc(Acesso.projeto)}</span>.</p>
      <p>Conectado como <strong>${esc((Acesso.usuario && Acesso.usuario.email) || "")}</strong>.</p>
      ${Acesso.configLocal ? `<p class="nota">${icone("info")}A configuração do Firebase está guardada só neste navegador. Para valer em todos os aparelhos, ela precisa entrar no arquivo firebase-config.json do repositório.</p>` : ""}
      <div class="form-acoes">${Acesso.configLocal ? `<button class="btn fantasma" data-acao="apagar-config-firebase">Esquecer configuração</button>` : ""}<button class="btn" data-acao="sair">Sair desta conta</button></div>
    </div>`;
  }
  if (window.claude) {
    return `<div class="texto-cartao"><p>${icone("alerta")}Esta visualização do Claude não tem acesso ao banco de dados.</p></div>`;
  }
  return `<div class="form">
    <p class="texto-cartao">${Acesso.erroFirebase ? `${icone("alerta")}Não consegui ligar o Firebase: ${esc(Acesso.erroFirebase)}` : "Para guardar os dados, ligue o painel a um projeto do Firebase."} Cole abaixo o bloco <span class="mono">firebaseConfig</span> do console do Firebase (Configurações do projeto → Seus apps).</p>
    <label class="campo"><span>Configuração do Firebase</span><textarea id="config-firebase" rows="7" placeholder="const firebaseConfig = {&#10;  apiKey: &quot;…&quot;,&#10;  authDomain: &quot;…&quot;,&#10;  projectId: &quot;…&quot;,&#10;  appId: &quot;…&quot;&#10;};"></textarea></label>
    <div class="form-acoes">${Acesso.erroFirebase ? `<button class="btn fantasma" data-acao="apagar-config-firebase">Esquecer configuração</button>` : ""}<button class="btn prim" data-acao="salvar-config-firebase">Salvar e conectar</button></div>
  </div>`;
}

function posRenderConfig() {
  const D = derivar();
  const exemplo = D.cobrarTec[0] || D.tecnicos.find((t) => t.usadas.length);
  const pre = document.querySelector(".msg-previa");
  if (pre && exemplo) pre.textContent = montarMensagem(exemplo, exemplo.itensCobrar.length ? exemplo.itensCobrar : exemplo.usadas, E.config.msgCobranca);
}

async function salvarFormulario(form) {
  const dados = new FormData(form);
  if (form.dataset.form === "regras") {
    const prazo = Math.max(1, parseInt(dados.get("prazo"), 10) || 7);
    const alerta = Math.min(prazo, Math.max(0, parseInt(dados.get("alerta"), 10) || 0));
    const meta = Math.max(0, parseInt(dados.get("meta"), 10) || 0);
    const tolerancia = Math.max(0, parseInt(dados.get("tolerancia"), 10) || 0);
    const marcados = new Set(dados.getAll("tipo"));
    const todos = [...form.querySelectorAll('input[name="tipo"]')].map((i) => i.value);
    const tiposIgnorados = todos.filter((t) => !marcados.has(t));
    const prazoNovas = Math.max(1, Math.min(90, parseInt(dados.get("prazoNovas"), 10) || 7));
    await salvarConfig({ prazo, prazoNovas, alerta, meta, tolerancia, tiposIgnorados });
    toast("Regras salvas. Os números foram recalculados.");
  } else if (form.dataset.form === "mensagens") {
    await salvarConfig({ msgCobranca: String(dados.get("msgCobranca") || ""), msgLembrete: String(dados.get("msgLembrete") || "") });
    toast("Mensagens salvas.");
  }
}

async function exportarTudo() {
  const D = derivar();
  const cob = [];
  for (const [tid, a] of Object.entries(E.acomp)) for (const c of a.cobrancas || []) cob.push([nomeTecnico(tid), c.em, CANAIS[c.canal] || c.canal, c.pecas, c.previsao, c.obs]);
  cob.sort((a, b) => comparar(b[1], a[1]));
  await exportarExcel(`controle-de-pecas-${D.hoje}.xlsx`, [
    {
      nome: "Peças usadas",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Chamado", largura: 14 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 }, { titulo: "Data FT", largura: 12, tipo: "data" }, { titulo: "Dias", largura: 7, tipo: "numero" }, { titulo: "Situação", largura: 16 }, { titulo: "Previsão", largura: 12, tipo: "data" }, { titulo: "Observação", largura: 30 }, { titulo: "Qtd", largura: 6, tipo: "numero" }],
      linhas: [...D.itens].sort((a, b) => b.dias - a.dias).map((i) => [i.nome, i.regiao, i.chamado, i.mat, i.desc, i.dataFT, i.dias, STATUS[i.status].rotulo, i.previsao, i.obs, i.qtd]),
    },
    {
      nome: "Estoque por técnico",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "Tipo", largura: 14 }, { titulo: "UF", largura: 5 }, { titulo: "Peças novas", largura: 10, tipo: "numero" }, { titulo: "Meta", largura: 7, tipo: "numero" }, { titulo: "Situação", largura: 16 }],
      linhas: D.tecnicos.filter((t) => t.novasLinhas.length).map((t) => [t.nome, TIPOS_TEC[t.tipo], t.regiao, t.novasQtd, t.tipo === "tecnico" ? t.meta : "", t.tipo === "tecnico" ? STATUS_NOVAS[t.statusNovas].rotulo : ""]),
    },
    {
      nome: "Devolvidas",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Chamado", largura: 14 }, { titulo: "Material", largura: 11 }, { titulo: "Descrição", largura: 40 }, { titulo: "Data FT", largura: 12, tipo: "data" }, { titulo: "Saiu do relatório", largura: 16, tipo: "data" }, { titulo: "Dias com o técnico", largura: 10, tipo: "numero" }, { titulo: "Quantidade", largura: 10, tipo: "numero" }],
      linhas: [...E.devolucoes].sort((a, b) => comparar(b.em, a.em)).map((d) => [nomeTecnico(d.tid), d.regiao, d.chamado, d.mat, E.catalogo[d.mat] || "", d.dataFT, d.em, d.dias, d.qtd]),
    },
    {
      nome: "Saídas de novas",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "UF", largura: 5 }, { titulo: "Material", largura: 14 }, { titulo: "Descrição", largura: 40 }, { titulo: "Quantidade", largura: 10, tipo: "numero" }, { titulo: "Primeira observação", largura: 18, tipo: "data" }, { titulo: "Saída observada", largura: 18, tipo: "data" }, { titulo: "Dias observados", largura: 12, tipo: "numero" }, { titulo: "Destino", largura: 24 }],
      linhas: [...E.movimentos].sort((a,b) => comparar(b.em,a.em)).map((m) => [nomeTecnico(m.tid),m.regiao,m.mat,E.catalogo[m.mat] || '',m.qtd,m.desde,m.em,m.dias,DESTINOS_NOVAS[m.destino] || m.destino]),
    },
    {
      nome: "Cobranças",
      colunas: [{ titulo: "Técnico", largura: 30 }, { titulo: "Quando", largura: 16, tipo: "data" }, { titulo: "Canal", largura: 14 }, { titulo: "Peças", largura: 7, tipo: "numero" }, { titulo: "Previsão informada", largura: 12, tipo: "data" }, { titulo: "Observação", largura: 40 }],
      linhas: cob,
    },
  ]);
}
