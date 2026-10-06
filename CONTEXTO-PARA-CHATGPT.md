# Controle de Peças — contexto completo do projeto

> **Como usar este arquivo:** envie este documento (ou dê acesso ao repositório `leandromendes-positivo/Positivo`) para a outra IA e cole o prompt da seção 13. Ele descreve o que o sistema faz, as regras, o formato das planilhas, a arquitetura, o banco de dados e os serviços usados.

---

## 1. O que é

Painel web para um **coordenador de técnicos de campo** controlar:

1. **Peças usadas**: a peça com defeito que o técnico tirou num chamado. Ele tem **7 dias** para devolver. O painel mostra há quantos dias cada técnico está com cada peça, quem cobrar hoje, registra cobranças e a **previsão de devolução** que o técnico informou.
2. **Peças novas**: o estoque que cada técnico carrega. O padrão é **no máximo 10 peças** por técnico. De 0 a 10 está dentro do limite; acima disso é excesso. Estoque menor é desejável e não gera alerta de reposição.

Todo dia o coordenador exporta 8 planilhas do sistema da empresa (Novas e Usadas de PR, RS, SC e TO) e arrasta para o painel, que atualiza tudo e mostra as pendências.

**Onde está:**
- **Site:** https://leandromendes-positivo.github.io/Positivo/ (GitHub Pages), com login Google.
- **Dados:** Firebase (Firestore + Authentication) na conta Google do dono.
- **Aviso diário:** GitHub Actions, de segunda a sexta às 7h55 (Brasília), por e-mail.
- **Código:** repositório `leandromendes-positivo/Positivo` (branch `main`). Cada push no `main` publica o site de novo.
- Versão anterior (legado): página no Claude, https://claude.ai/artifact/XfzKt5XJGVvtSaj1LM5nza, com banco próprio do Claude. O mesmo código roda nos dois lugares (seção 7).

---

## 2. Uso diário (como o coordenador trabalha)

1. Exporta as 8 planilhas e arrasta todas de uma vez para a página (ou usa o botão **Importar planilhas**).
2. O painel reconhece região e tipo pelo nome do arquivo, confere pelas colunas e importa sozinho.
3. Abre **Cobranças → Cobrar hoje**: um cartão por técnico com quantas peças, dias da mais antiga, última cobrança e uma régua de prazo.
4. Botão **Cobrar**: mensagem pronta (peças, chamados, dias) para copiar ou abrir no WhatsApp (`wa.me`), e registro da cobrança (canal, previsão informada, observação).
5. No dia seguinte importa de novo: o que sumiu do relatório de usadas conta como **devolvido**.
6. Toda manhã de dia útil (7h55, horário de Brasília) recebe por e-mail o resumo de quem cobrar (GitHub Actions, seção 7).

Telas: **Painel**, **Cobranças**, **Peças usadas**, **Estoque de novas**, **Técnicos** (com ficha individual), **Importar planilhas**, **Configurações**.

---

## 3. Planilhas de entrada

- CSV exportado pelo sistema da empresa. Codificação **Latin-1 / Windows-1252**, separador **`;`**, com um `;` sobrando no fim de cada linha. Primeira linha é o cabeçalho.
- Nomes dos arquivos: `PR Novas.csv`, `PR Usadas.csv`, `RS Novas.csv`… (sigla do estado + Novas/Usadas).
- Também aceita `.xlsx` (primeira aba).

Colunas (as duas planilhas têm as mesmas, mudando só a penúltima):

| Coluna | Exemplo | Observação |
|---|---|---|
| Técnico | `MARIA EXEMPLO DA SILVA ` | Às vezes com espaço no fim. No PR alguns são **códigos numéricos** (`110301019`), que são bases/depósitos. |
| Nota Fiscal | `47908` ou `LT:732693` | |
| Remessa | `8006097001` ou `0080604986` | |
| Material Solicitado | `000000000011144611` | Código SAP de 18 dígitos com zeros à esquerda. |
| Material Solicitado Descrição | `FONTE FATX 180W …` | |
| Material Enviado | `000000000011144611` | É o material que vale (pode diferir do solicitado). |
| Material Enviado Descrição | `FONTE FATX 180W …` | |
| Chamado | `60006509236` | Vazio na maioria das linhas de Novas. |
| **TIPO** (só Novas) | `BACKUP`, `PP`, `REP. BACKUP` | Tipo de envio. |
| **Data FT** (só Usadas) | `29/09/2026 11:30:00` | Dia em que a peça foi trocada no chamado. **Os 7 dias contam a partir daqui.** |
| Qtd | `1` | |

Exemplos fictícios (mesmo formato) estão em `exemplos/` dentro do zip.

Tamanho real das planilhas de 05/10/2026: PR Novas 8.871 linhas (122.505 peças, a maior parte em bases), PR Usadas 1.952, RS/SC/TO bem menores. Técnicos: ~90 (13 códigos numéricos no PR).

---

## 4. Regras de negócio

### 4.1 Configuráveis (tela Configurações, documento `config/geral`)

| Campo | Padrão | Significado |
|---|---|---|
| `prazo` | 7 | Dias máximos com peça usada. |
| `alerta` | 5 | A partir de quantos dias mostrar "vence em breve". |
| `meta` | 10 | Limite máximo de peças novas por técnico (pode ser personalizado; 0 = sem limite). |
| `tolerancia` | 0 | Campo legado ignorado no cálculo, inclusive quando um banco antigo ainda guarda 3. |
| `tiposIgnorados` | `[]` | Tipos de envio que **não** contam no estoque (ex.: `["PP"]`). |
| `msgCobranca`, `msgLembrete` | textos padrão | Modelos da mensagem. Campos: `{saudacao} {nome} {nome_completo} {qtd} {lista} {prazo} {regiao}`. |

### 4.2 Situação de cada peça usada (`statusUsada` em `30-modelo.js`)

```
dias = hoje − data(Data FT)          (sem Data FT: hoje − dia em que apareceu no relatório)
se previsão existe e previsão < hoje  → "previsao_vencida"   (cobrar)
senão se dias > prazo                 → previsão existe ? "aguardando" : "atrasada" (cobrar)
senão se dias >= alerta               → "vencendo"
senão                                 → "no_prazo"
cobrar = atrasada OU previsao_vencida
```

- "Cobrar hoje" lista técnicos com pelo menos uma peça a cobrar; ordem: previsão vencida primeiro, depois a peça mais antiga, depois a quantidade.
- **Previsão** é por peça (o modal aplica a todas as peças daquela cobrança). Enquanto a previsão não vence, a peça sai da lista de cobrança.
- **Devolução**: cada planilha é a *foto do momento* da região. Peça usada que estava na foto anterior e **não está** na nova é registrada como devolvida naquele dia, com os dias que ficou com o técnico (≤ prazo = no prazo).

### 4.3 Peças novas

- Soma de `Qtd` por técnico (só tipos que contam). Situação só para `tipo = "tecnico"`:
  `qtd > meta` → **acima do limite** (excesso = qtd − meta) · de 0 até meta → **dentro do limite** · meta 0 → **sem limite**. Sem relatório de novas da região → **sem relatório**, não zero. Os identificadores internos `meta`, `ideal` e `sem_meta` são mantidos por compatibilidade.
- Linhas de novas são agregadas por técnico + material + tipo de envio, guardando desde quando aparecem.

### 4.4 Técnicos

- Identificador estável `tid`: nome sem acento, maiúsculo, espaços únicos, espaços viram `_` (`idSeguro(chaveTexto(nome))`), ex. `MARIA_EXEMPLO_DA_SILVA`.
- Tipos: `tecnico`, `base` (base/depósito: fica fora do limite dos técnicos e aparece separado no estoque), `ignorar` (some de todas as contas). Nome só com dígitos entra como `base` na primeira vez.
- Cadastro editável: nome de exibição (apelido), tipo, limite próprio, WhatsApp, e-mail, observações.

### 4.5 Identidade de cada peça usada (para guardar previsão e cobranças)

`k = hash36(UF | tecChave | NF | remessa | material | chamado | DataFT)` + `.n` quando a mesma combinação se repete na planilha (n = ocorrência). Previsões e observações ficam ligadas a `k` e continuam valendo nas importações seguintes.

---

## 5. Arquitetura técnica

- **Uma página só**, HTML + CSS + JavaScript puro, **sem framework** e sem dependências de build. `build.py` (Python 3) concatena:
  `src/pagina.html` + `src/estilos.css` + `src/js/*.js` (em ordem alfabética) →
  - `dist/site/index.html`: **o site do GitHub Pages**, documento completo com a configuração de `firebase-config.json` embutida (`window.CP_FIREBASE`);
  - `dist/controle-de-pecas.html`: formato publicado no Claude (sem `<html>/<head>`, o Claude envolve);
  - `dist/pagina-completa.html`: documento completo sem Firebase embutido.
- `dist/` não vai para o repositório: o GitHub Actions roda o `build.py` a cada push.
- Todos os `.js` viram **um único `<script>`** com `"use strict"`, então compartilham o escopo global (sem `import`/`export`).
- Bibliotecas externas: Google Fonts (Barlow, Barlow Semi Condensed, IBM Plex Mono), **SheetJS 0.18.5** (cdnjs, só para ler `.xlsx` e gerar Excel) e **Firebase 10.14.1 compat** (gstatic: app, auth, firestore), carregado só quando há configuração do Firebase.

### 5.1 Ciclo da aplicação

```
iniciar()                      80-app.js
  └ Armazem.iniciar()          20-armazem.js   (banco do Claude, Firebase com login, ou memória)
  └ carregarTudo()             30-modelo.js    → preenche o estado E e assina mudanças
E (estado bruto) ──► derivar() (números calculados, memorizado por E.rev)
                       └ renderizar() → PAGINAS[UI.pagina].render() devolve HTML
                                         + .depois() desenha os gráficos
eventos: delegação global por atributos
  data-acao   (clique)  → ACOES[...]
  data-mudar  (change)  → MUDANCAS[...]
  data-digitar (input)  → DIGITACAO[...]   (buscas com debounce)
qualquer mudança no estado chama mudou() → E.rev++ → re-render
```

### 5.2 Arquivos

| Arquivo | Conteúdo | Funções principais |
|---|---|---|
| `src/pagina.html` | Moldura: trilho de navegação, topo, áreas de aviso, `#conteudo`, `#dica`, `#toasts`, camada de soltar arquivos | — |
| `src/estilos.css` | Visual completo, tokens em `:root`, modo escuro, responsivo | — |
| `00-util.js` | Texto, datas, números, hash, ícones SVG | `esc`, `chaveTexto`, `nomeBonito`, `codigoMaterial`, `parseQtd`, `regiaoDoNome`, `tipoDoNome`, `agora`, `hojeISO`, `diffDias`, `somaDias`, `parseDataTexto`, `fmt*`, `hash36`, `idSeguro`, `icone` |
| `10-leitura.js` | Leitura de CSV/XLSX, detecção de cabeçalho, região e tipo | `lerRelatorio(arquivo, {regiao, tipo})`, `parseCSV`, `decodificar`, `acharCabecalho`, `carregarSheetJS` |
| `20-armazem.js` | Acesso ao banco (único ponto) + banco em memória. `Armazem.iniciar()` escolhe: banco do Claude > Firebase > memória | `Armazem.{iniciar, ler, gravar, mesclar, apagar, consultar, ouvirDoc, ouvirColecao}`, `criarDbMemoria` |
| `25-firebase.js` | Firebase: carrega o SDK, login Google (tela de entrada), adaptador do Firestore com a mesma interface, textos por modo | `Acesso`, `configFirebase`, `iniciarFirebase`, `criarDbFirestore`, `codificarFS/decodificarFS`, `pedirLogin`, `sairDoFirebase`, `textoSemBanco` |
| `30-modelo.js` | Estado `E`, carregamento, regras, resumo diário, edições | `carregarTudo`, `derivar`, `statusUsada`, `statusNovas`, `montarMensagem`, `montarResumo`, `definirPrevisao`, `definirObs`, `registrarCobranca`, `salvarTecnico`, `salvarConfig` |
| `40-importacao.js` | Importação diária (foto, devoluções, índice) e desfazer | `importarLote(lidos)`, `compararFoto`, `desfazerImportacao` |
| `50-graficos.js` | Gráficos SVG feitos à mão | `graficoColunas`, `graficoEmpilhado`, `graficoLinhas`, `medidorEstoque`, `reguaPrazo` |
| `60-ui.js` | Componentes | `toast`, `abrirModal`, `confirmar`, `pill*`, `cartao`, `paginacao`, `copiarTexto`, `linkWhatsApp`, `exportarExcel` |
| `70-painel.js` | Tela Painel | `renderPainel`, `desenharPainel` |
| `71-cobrancas.js` | Tela Cobranças | `renderCobrancas`, `cartaoCobranca`, `resumoTexto`, `exportarCobrancas` |
| `72-usadas.js` | Tela Peças usadas (pendentes e devolvidas) | `renderUsadas`, `tabelaUsadas`, `tabelaDevolvidas` |
| `73-estoque.js` | Tela Estoque de novas | `renderEstoque`, `tabelaLinhasNovas` |
| `74-tecnicos.js` | Lista e ficha do técnico | `renderTecnicos`, `renderFicha` |
| `75-importar.js` | Tela Importar e histórico | `receberArquivos`, `executarImportacao`, `renderImportar` |
| `76-config.js` | Tela Configurações | `renderConfig`, `salvarFormulario`, `exportarTudo` |
| `77-modais.js` | Janelas Cobrar, Previsão, Cadastro | `modalCobrar`, `modalPrevisao`, `modalTecnico` |
| `80-app.js` | Navegação, eventos, inicialização | `UI`, `PAGINAS`, `irPara`, `renderizar`, `ACOES`, `MUDANCAS`, `iniciar` |
| `build.py` | Junta tudo em `dist/` (inclui `dist/site/index.html`) | — |
| `aviso/enviar-aviso.mjs` | E-mail diário: lê `resumo/atual` com firebase-admin e envia pelo Gmail (nodemailer) | `montarAviso`, `hojeBrasilia` |
| `.github/workflows/publicar-site.yml` | Build + deploy no GitHub Pages a cada push no `main` | — |
| `.github/workflows/aviso-diario.yml` | Agenda seg–sex 10h55 UTC; roda o aviso e mantém o agendamento ativo | — |
| `firestore.rules` | Só e-mails listados leem e gravam | — |
| `firebase.json` | Regras + emuladores (testes) | — |
| `testes/firebase-e2e.mjs` | Teste com os emuladores do Firebase (login, importação, persistência, devolução, conta barrada) | — |
| `testes/e2e.mjs` | Teste ponta a ponta no Chromium (Playwright) | — |
| `testes/gerar-semente.mjs` | Gera os documentos do banco a partir das planilhas (carga inicial) | — |

---

## 6. Banco de dados

API no estilo Firestore: caminhos alternam coleção/documento; `doc(caminho).get/set/update/delete/onSnapshot` e `collection(caminho).where/orderBy/limit/get/onSnapshot`. No banco do Claude, `update` funde objetos aninhados recursivamente (listas são trocadas inteiras) e exige que o documento exista. Limites: documento ≤ 256 KiB, até 25.000 documentos. Os dados lidos chegam **congelados** (não mutar; sempre copiar).

| Documento | Formato |
|---|---|
| `config/geral` | `{prazo, alerta, meta, tolerancia, tiposIgnorados[], msgCobranca, msgLembrete, atualizadoEm}` (só existe depois que alguém salva Configurações) |
| `cadastro/tecnicos` | `{t: {<tid>: {chave, nome, apelido, regiao, tipo, meta, telefone, email, obs, criadoEm}}}` |
| `dados/indice` | `{arquivos: {"usadas:PR": {gen, partes, itens, qtd, linhas, em, arquivo, hash, lote}, …}, anterior: {mesmas chaves}, versao, atualizadoEm}` |
| `dados/catalogo` | `{m: {"11144611": "FONTE FATX 180W …", …}}` (descrição de cada material) |
| `dados/<u\|n>-<UF>-<gen>-<parte>` | `{tipo, regiao, gen, parte, total, itens: [linhas compactas]}` |
| `acompanhamento/<tid>` | `{itens: {<k>: {p: previsão, o: observação, c: nº de cobranças, uc: última cobrança}}, cobrancas: [{em, canal, previsao, obs, pecas, por}], atualizadoEm}` |
| `devolucoes/<AAAA-MM-DD>` (e `.2`, `.3` se o dia for grande) | `{data, itens: [[k, tid, material, chamado, dataFT, qtd, em, dias, UF, lote]], atualizadoEm}` |
| `historico/<AAAA-MM-DD>` | `{data, em, t: {<tid>: [usadasPendentes, atrasadas, diasMaisAntiga, novas]}, tot: {usadas, atrasadas, cobrarTec, cobrarPecas, novas, ideal, acima, excessoNovas}}` |
| `importacoes/<lote>` | `{em, por, arquivos: [{nome, regiao, tipo, linhas, itens, qtd, entradas, saidas, …, avisos}], avisos, chaves, devolvidas, desfeito}` |
| `resumo/atual` | Projeção dos próximos 7 dias, lida pelo aviso diário: `{geradoEm, hoje, prazo, meta, dias: {<AAAA-MM-DD>: {cobrar: [{nome, regiao, tipo, pecas, maxDias, previsaoVencida, telefone, ultimaCobranca, proxPrevisao}], totalTecnicos, totalPecas, pendentes, atrasadas, previsoes: [{nome, regiao, pecas}]}}, estoque: {regra: "limite_maximo", excesso, acima, ideal, totalNovas}, vencendoAmanha, previsoesHoje, atualizacao: [{arquivo, em}]}` |

**Linhas compactas** (para caber nos documentos):
- Usada: `[k, tid, nf, remessa, material, chamado, dataFT "AAAA-MM-DD HH:MM", qtd, desde "AAAA-MM-DD", materialSolicitado (só se diferente)]`
- Nova: `[tid, material, tipoEnvio, qtd, nºDeLinhas, desde]`

**No Firestore:** o adaptador de `25-firebase.js` grava cada lista que está dentro de outra lista como `{cp_lista: [...]}` (o Firestore não aceita lista dentro de lista) e desfaz isso na leitura; `update` vira `set(dados, {merge: true})` (fusão de objetos aninhados, como no banco do Claude). Os caminhos dos documentos são os mesmos da tabela acima, na raiz do banco.

**Gerações e desfazer:** cada importação grava as partes com uma geração nova (`g` + data/hora) e só depois atualiza `dados/indice` para apontar para ela. Uma falha no meio não deixa dados pela metade. O índice guarda a geração `anterior` de cada planilha; **Desfazer** volta para ela (um passo) e apaga as devoluções daquela importação. A geração mais antiga que isso é apagada na importação seguinte. Partes têm até 150.000 caracteres.

---

## 7. Serviços usados (e onde cada um entra)

| Serviço | Para quê | Onde configura |
|---|---|---|
| **GitHub Pages** | Hospeda o site (`dist/site`) | Settings → Pages → Source: GitHub Actions. Repositório público (plano grátis). |
| **Firebase Authentication** | Login com Google | Console do Firebase → Authentication → Google ativado; domínio `leandromendes-positivo.github.io` autorizado. |
| **Cloud Firestore** | Todos os dados (seção 6) | Console do Firebase → Firestore (região southamerica-east1); regras = `firestore.rules` com o e-mail do dono. |
| **GitHub Actions** | Publicar o site e mandar o aviso diário | Secrets: `FIREBASE_SERVICE_ACCOUNT` (JSON da conta de serviço), `GMAIL_USUARIO`, `GMAIL_SENHA_APP` (senha de app), `EMAIL_PARA` (opcional). Sem os secrets o aviso não envia e não falha. |
| Claude (legado) | A primeira versão, com banco e rotina próprios do Claude | Só se continuar usando o link do Claude. |

Como o painel escolhe o banco (`Armazem.iniciar`): se roda dentro do Claude, usa o banco do Claude; senão, se há configuração do Firebase (`window.CP_FIREBASE` embutida pelo build, ou colada em Configurações → Banco de dados e guardada no navegador), usa o Firestore com login; senão, usa memória (nada é salvo e um aviso aparece).

`firebase-config.json` tem só identificadores públicos do projeto (apiKey, authDomain, projectId…). A proteção dos dados é o login + `firestore.rules`. A chave da conta de serviço e a senha do Gmail ficam **só** nos Secrets do GitHub.

---

## 8. Como compilar e testar

```bash
python3 build.py                                   # gera dist/
node testes/e2e.mjs "<pasta com os CSV>" capturas/ # teste ponta a ponta (Node + Playwright + Chromium)
```

- O teste importa as planilhas, confere os números, registra uma cobrança com previsão, simula o 2º dia (tira 1/3 das linhas de usadas e acrescenta uma peça), desfaz a última importação e tira capturas em tema claro, escuro e celular. Ajuste o caminho do Playwright (`PW_PATH`) e do Chromium no começo do arquivo para a sua máquina.
- Teste com o Firebase de verdade, sem conta: emuladores oficiais. `npx firebase-tools emulators:start --only auth,firestore --project demo-controle-pecas` (com uma cópia de `firestore.rules` liberando `teste@exemplo.com`), `python3 -m http.server 8000 --directory dist/site` e `node testes/firebase-e2e.mjs exemplos capturas`. O teste entra com uma conta falsa, importa os exemplos, registra cobrança, reabre e confere que tudo veio do banco, simula o 2º dia e confere que outra conta é barrada.
- Aviso diário sem enviar: `cd aviso && npm install && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 AVISO_SIMULAR=1 node enviar-aviso.mjs` (ou com `FIREBASE_SERVICE_ACCOUNT` real).
- Para abrir na mão: `dist/pagina-completa.html` direto no navegador (modo sem salvamento).
- Ganchos de teste no navegador: `window.__CP_AGORA = "2026-10-06T08:30:00"` fixa o relógio; `window.__CP_SEM_DB__ = true` força o banco em memória; `window.__CP_FIREBASE_EMULADOR__ = true` liga nos emuladores; `window.__CP_LOGIN_TESTE__ = {sub, email, email_verified}` entra com uma conta falsa (só no emulador). No console dá para usar `E`, `UI`, `derivar()`, `irPara("cobrancas")`.

**Números esperados com as planilhas fictícias de `exemplos/`** (relógio em 05/10/2026): 10 peças usadas pendentes, 5 atrasadas, 3 técnicos para cobrar (José Exemplo Pereira 56 dias, Carlos Exemplo Souza 13, Ana Exemplo Costa 10), 46 peças novas com 4 técnicos (2 dentro do limite, 2 acima, 16 peças em excesso) e 1 base.

**Números esperados com as planilhas reais de 05/10/2026:** 2.005 peças usadas pendentes, 758 atrasadas (mais antiga com 229 dias), 15 técnicos para cobrar, 3.878 peças novas com 67 técnicos (média 57,9), 13 bases. Os indicadores por limite precisam ser recalculados com os relatórios reais; as antigas faixas de tolerância não se aplicam.

---

## 9. Convenções do código

- Nomes de funções, variáveis e textos em **português**.
- Datas guardadas como texto local: dia `AAAA-MM-DD`, data/hora `AAAA-MM-DD HH:MM`. Contas de dias com `diffDias` (sem fuso).
- HTML montado com template strings: todo dado vindo das planilhas passa por `esc()`. Textos livres digitados (observações) entram com `textContent`.
- Nunca mutar objetos vindos do banco: criar cópias (`{...obj}`).
- Gravações em fila (`Armazem.enfileirar`), com nova tentativa automática em `unavailable` e `resource_exhausted`.
- Visual: cores como tokens CSS em `:root`, com versão escura em `@media (prefers-color-scheme: dark)` e `[data-theme="dark"]`. Cores de situação (verde/âmbar/laranja/vermelho) sempre acompanhadas de ícone e texto. Funciona a partir de 400 px de largura sem rolagem horizontal.
- O viewer do Claude não mostra `alert/confirm/prompt` nem permite `window.print()`; por isso há `confirmar()` próprio.

---

## 10. Aviso diário (texto do e-mail)

```
Peças para cobrar hoje — DD/MM
X técnicos para cobrar · Y peças com mais de 7 dias
• Nome (UF) — P peças, mais antiga com D dias [· previsão vencida] [· última cobrança DD/MM]
… (até 10) e mais K técnicos
[Prometeram devolver hoje: …]
Estoque de novas: A técnicos dentro do limite e B acima; C peças em excesso.
[Lembrete: importe as planilhas de hoje no painel para atualizar as devoluções.]
https://leandromendes-positivo.github.io/Positivo/
```

---

## 11. Estado atual

- Código completo no repositório `leandromendes-positivo/Positivo`, com publicação automática e aviso diário prontos.
- Testado com os emuladores do Firebase e com as planilhas reais de 05/10/2026 (seção 8).
- Para entrar no ar falta a configuração única descrita no `README.md`: ligar o Pages, criar o projeto no Firebase, colocar `firebase-config.json` e os Secrets do aviso.
- Depois de configurado, é só importar as planilhas no site (o banco começa vazio).

---

## 12. Ideias para os próximos passos

1. Importar o WhatsApp e o e-mail dos técnicos de uma planilha (hoje é um por um em Técnicos).
2. E-mail automático aos técnicos com peças atrasadas (opcional, com aprovação).
3. Histórico do estoque de novas por técnico (gráfico) e alerta de "estoque parado" (material há muitos dias sem sair).
4. Ranking de técnicos por tempo médio de devolução e % no prazo.
5. Se mais pessoas forem usar: login e permissões por região.
6. Exportar/importar um backup completo do banco em JSON pela tela de Configurações.

---

## 13. Prompt para colar na outra IA

```
Vou continuar um projeto que já está pronto e em uso: o "Controle de Peças", um painel web
para controlar peças usadas (devolução em até 7 dias) e o estoque de peças novas dos técnicos.

O código está no GitHub: leandromendes-positivo/Positivo (branch main). Cada push no main
publica o site sozinho (GitHub Pages); os dados ficam no Firebase.

Leia primeiro o arquivo CONTEXTO-PARA-CHATGPT.md do repositório (regras, formato das
planilhas, arquitetura, banco de dados e serviços usados).

Como quero trabalhar:
- Mantenha a arquitetura atual: HTML/CSS/JS puro, sem framework, arquivos em src/,
  juntados pelo build.py. Não troque nomes de funções sem necessidade.
- Antes de mudar algo, me diga em poucas linhas o que vai mudar e em quais arquivos.
- Quando alterar um arquivo, me devolva o arquivo COMPLETO, pronto para substituir.
- Preserve as regras de negócio da seção 4 e o formato do banco da seção 6
  (os dados já gravados precisam continuar funcionando).
- Nunca coloque senhas, chaves ou dados reais de técnicos no repositório (ele é público).
- Escreva a interface em português do Brasil.

Primeira tarefa: <descreva aqui o que você quer>
```
