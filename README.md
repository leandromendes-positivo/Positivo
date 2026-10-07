# Controle de Peças

Painel web para acompanhar, todo dia, as **peças usadas** que cada técnico ainda não devolveu (prazo de 7 dias) e o **estoque de peças novas** de cada um (limite máximo padrão de 10 peças).

- **Site:** https://leandromendes-positivo.github.io/Positivo/ (abre no computador e no celular, com login Google ou Microsoft após configurar os provedores)
- **Dados:** Firebase (Firestore), na conta Google escolhida por você. Nada de planilha ou dado de técnico fica neste repositório.
- **Aviso diário:** e-mail de segunda a sexta às 7h55 com quem cobrar (GitHub Actions).
- **Atualização do site:** qualquer alteração em `src/` enviada para o branch `main` publica o site de novo sozinha.
- **Aparência:** o botão no topo e na tela de login alterna entre claro (base branca e texto preto) e escuro (base preta e texto branco), com a logo correspondente. Botões principais usam grafite no claro e turquesa no escuro; azul, coral, âmbar e verde distinguem categorias e situações. A escolha fica salva neste navegador; no primeiro acesso, acompanha o tema do sistema.

Detalhes do funcionamento (regras, formato das planilhas, banco, arquitetura): [CONTEXTO-PARA-CHATGPT.md](CONTEXTO-PARA-CHATGPT.md).

---

## Configuração (uma vez só)

Faça tudo logado na **conta Google que vai ser dona do painel**. Use uma janela anônima ou um perfil separado do Chrome para não misturar com outras contas.

### 1. Ligar o site no GitHub Pages

1. Neste repositório: **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Vá em **Actions → Publicar painel → Run workflow**. Em 1 a 2 minutos o site fica no endereço acima.

> O repositório precisa ser **público** (no plano grátis do GitHub, o Pages só funciona assim). Ele só tem código; os dados ficam no Firebase, protegidos por login.

### 2. Criar o Firebase

1. Acesse https://console.firebase.google.com → **Criar um projeto** → nome `controle-pecas` → pode **desativar o Google Analytics** → **Criar projeto**.
2. Menu **Criação → Firestore Database → Criar banco de dados**:
   - Local: **southamerica-east1 (São Paulo)**
   - Modo: **produção** → **Criar**.
3. Configure a credencial, o administrador principal e a publicação de regras conforme [Ativação de contas e permissões](seguranca/README.md). A lista fixa de e-mails foi substituída pelo cadastro protegido de usuários.
4. Menu **Criação → Authentication → Vamos começar → Google** → **Ativar** → escolha o e-mail de suporte → **Salvar**. Para Outlook/Microsoft 365, siga a configuração do Microsoft Entra e do provedor Microsoft no [guia de contas](seguranca/README.md#microsoft-outlook-e-microsoft-365-corporativo).
5. Em **Authentication → Configurações → Domínios autorizados → Adicionar domínio**: `leandromendes-positivo.github.io`
6. Engrenagem (⚙) → **Configurações do projeto → Geral → Seus apps** → ícone **Web `</>`** → apelido `painel` → **Registrar app**. Copie o bloco `firebaseConfig` que aparece.
7. Coloque esses valores no arquivo **`firebase-config.json`** deste repositório (veja o modelo em [`firebase-config.exemplo.json`](firebase-config.exemplo.json)) e envie para o `main`. O site é publicado de novo já ligado ao Firebase.
   - Alternativa rápida, só para testar: abra o site → **Configurações → Banco de dados**, cole o bloco e clique em **Salvar e conectar** (vale só naquele navegador).

O bloco `firebaseConfig` não é senha: ele só identifica o projeto. Quem pode ler e gravar é decidido pelas regras do passo 3.

### 3. Aviso diário por e-mail

1. Firebase → ⚙ **Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Baixa um arquivo `.json`. **Guarde com cuidado: ele dá acesso total ao banco.**
2. No Gmail que vai **enviar** o aviso: https://myaccount.google.com/security → ative a **Verificação em duas etapas** → depois **Senhas de app** (https://myaccount.google.com/apppasswords) → crie uma com o nome `painel` → copie a senha de 16 letras.
3. Neste repositório: **Settings → Secrets and variables → Actions → New repository secret**, um de cada vez:

   | Nome | Valor |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | o conteúdo inteiro do arquivo `.json` do passo 1 |
   | `GMAIL_USUARIO` | o e-mail do Gmail que envia |
   | `GMAIL_SENHA_APP` | a senha de app do passo 2 |
   | `EMAIL_PARA` | quem recebe (opcional; vários separados por vírgula; sem ele, vai para o próprio Gmail) |

4. Teste: **Actions → Aviso diário de peças → Run workflow**. O e-mail chega em alguns segundos.

Senhas e chaves ficam **só** nos Secrets do GitHub. Nunca coloque esses valores em arquivos do repositório.

### 4. Primeiro uso

Abra o site → **Entrar com Google** ou **Entrar com Microsoft** com o e-mail do administrador principal. Em **Cadastro de usuários**, autorize cada endereço e escolha **Usuário** ou **Administrador**. A conta comum consulta e agenda; a administração também importa e altera cadastros e regras.

---

## Usuários, autoria e localidade

- **Cadastro de usuários:** administradores autorizam endereços exatos de qualquer domínio, atribuem perfis e desativam acessos. E-mail verificado e permissão ativa são exigidos no banco, inclusive se alguém tentar ignorar os botões da interface.
- **Minha conta:** mostra o primeiro nome extraído do início do e-mail, o endereço e o perfil. O mesmo nome aparece ao lado do e-mail no rodapé do menu.
- **Agendamentos:** nome do responsável nas previsões e na agenda; **Ficha do técnico → Histórico de agendamentos** mostra e-mail, horário e alterações. Registros anteriores sem autoria conhecida não recebem nomes inventados. Horários do servidor são exibidos em Brasília.
- **Capital/interior:** **Técnicos → Editar cadastro → Localidade do técnico**. O campo começa como não informado e pode ser filtrado na lista e na consulta avançada; também aparece nas exportações.
- **Login:** vídeo de circuitos do banco Pexels, incorporado ao próprio painel, com reprodução automática, silenciosa, em loop e sem controle de pausa. Inclui versões WebM/MP4, imagem de abertura, botões Google/Microsoft e enquadramento para celular. [Origem e licença do vídeo](src/assets/VIDEO-LICENCA.md).

A ativação inicial exige configuração no Firebase e, para Microsoft, no Entra. Veja o [guia de implantação e segurança](seguranca/README.md). O workflow não publica o novo site se não conseguir publicar as regras do banco.

## Rotina do dia

1. Exporte do sistema os relatórios de peças **Novas** e **Usadas** de cada região (`PR Usadas.csv`, `PR Novas.csv`…).
2. Abra o painel e **arraste as planilhas** (todas de uma vez).
3. **Cobranças → Cobrar hoje**: o botão **Cobrar** monta a mensagem para WhatsApp ou **E-mail / Outlook**; depois de enviar, registre a cobrança e a **previsão de devolução** que o técnico informar.
4. Peça **usada** que sai do relatório (inclusive redução parcial da quantidade) conta como **devolvida**. Para novas, confira **Consulta avançada → Saídas de novas** e classifique a baixa como devolução, uso em atendimento ou transferência/ajuste.

### Mensagens de cobrança pelo Outlook

Em **Cobrar → E-mail / Outlook**, confira o destinatário, assunto e mensagem já preenchidos. Há também o atalho **Configurações → Mensagens de cobrança → Preparar e-mail**. O assunto padrão é **Devolução de peças**. O conteúdo reúne resumo, prazo próprio do técnico, quantidades, códigos, descrições, chamados e previsões, com todas as peças selecionadas, sem assinatura do painel.

- **Outlook · rascunho com formatação** (padrão): conecte sua própria conta Microsoft uma vez por sessão e autorize a permissão apresentada. Confira o endereço conectado e clique em **Criar e abrir rascunho formatado**. O painel cria um rascunho na sua caixa, com exatamente o HTML da prévia: fonte Arial, títulos em negrito, resumo em tabela e peças em blocos. O Outlook pode ajustar a renderização conforme a versão. Nenhuma cópia ou colagem é necessária. Revise e clique em **Enviar** no Outlook.
- A conexão usa o provedor Microsoft do Firebase e a permissão delegada `Mail.ReadWrite` do Microsoft Graph. Pode exigir aprovação da TI da empresa. Veja [configuração e consentimento](seguranca/README.md#rascunhos-formatados-no-outlook). O login do painel permanece intacto, inclusive quando feito pelo Google. O token Microsoft fica apenas em memória e é descartado ao desconectar, sair ou perder o acesso ao painel.
- Um novo clique com o mesmo conteúdo reabre o rascunho criado nesta janela, sem duplicá-lo. Depois de editar a mensagem, o próximo clique cria outro rascunho. Se houver falha de conexão após a criação, confira **Rascunhos** antes de tentar novamente. Se a nova aba for bloqueada, aparece um link para abrir o rascunho já criado.
- **Outlook na Web · somente texto** e **Outlook instalado · somente texto** são alternativas sem conexão com a caixa. O aplicativo padrão do dispositivo precisa ser Outlook para a segunda opção. Os links usam `%20` para espaços e preservam sinais `+` reais. Mensagens acima do limite de URL não são truncadas: use o modo formatado ou o arquivo `.eml`.
- **Copiar com formatação** e **Baixar rascunho (.eml)** continuam disponíveis. O arquivo é compatível com edições do Outlook que aceitam rascunhos `.eml`. A prévia, a cópia e o rascunho sempre usam o texto editado.

O painel não acrescenta assinatura. Confira sua assinatura pessoal no Outlook: rascunhos criados externamente podem não receber automaticamente a assinatura configurada no cliente.

O e-mail e o telefone do técnico são somente contatos. Não criam usuário autorizado, não vinculam identidade ao painel e não concedem acesso. A conta Microsoft conectada para preparar o rascunho é a do operador, escolhida na autenticação, nunca derivada do cadastro do técnico.

Preparar, abrir ou baixar um rascunho não envia e-mail nem registra envio no histórico. Após enviar pelo Outlook, clique em **Registrar cobrança**; o responsável registrado é o operador autenticado, nunca o destinatário.

### Central de notificações

O sino **Notificações**, no topo de todas as páginas, reúne alertas ativos com contador de **não lidos**, prioridades e atalhos. A central acompanha importações, contatos e agendamentos enquanto está aberta, e recalcula as regras na virada do dia.

- **Cobranças que precisam de retorno:** técnicos com pelo menos uma peça usada acima do prazo, cobrada há **2 dias corridos ou mais**, ainda sem previsão registrada. A regra considera a cobrança de cada peça: um contato recente sobre outro material não esconde a pendência. Não presume que o técnico deixou de responder fora do sistema.
- **Faltam contatos para cobrar:** técnicos na fila sem e-mail em formato válido e sem telefone com 10 a 15 dígitos. Bases e cadastros ignorados não entram neste alerta. Telefones e e-mails continuam sendo somente contatos, sem permissão de acesso ao painel.
- **Previsões vencidas:** a data combinada passou e as peças ainda constam no último relatório. O atalho abre a aba de previsões vencidas.
- **Estoque acima do limite:** considera somente estoque conhecido de técnicos e respeita limites personalizados. Saldo igual ou inferior ao limite, inclusive zero, não gera alerta; bases e tipos de envio desconsiderados não são tratados como excesso de técnico.
- **Planilhas não atualizadas hoje ou faltando:** aparece primeiro para lembrar que o saldo pode estar desatualizado antes de cobrar. Mostra a última importação de cada tipo/UF. Administradores podem abrir a importação; os demais recebem orientação para solicitar a atualização.

Os atalhos de retorno e contato abrem **Cobranças** com um filtro identificado e removível, sem reaproveitar buscas ou regiões anteriores. Os cartões mostram todas as peças a cobrar dos técnicos selecionados; o resumo e a exportação respeitam esse filtro da central. Abrir outra aba de cobrança ou um atalho do dashboard limpa esse filtro.

**Marcar como lida** apenas altera a leitura pessoal: não registra cobrança, não agenda devolução e não remove a pendência. Alertas resolvidos saem da central; reincidências e alterações relevantes voltam a ser não lidas. A leitura é salva **por conta e projeto, neste navegador**, somente como identificadores e versões dos alertas, sem copiar contatos ou mensagens. Não é sincronizada entre dispositivos. Se o armazenamento estiver bloqueado, a central informa que a leitura dura apenas enquanto a página estiver aberta.

A central tem navegação por teclado, retorno do foco ao sino, rolagem independente e animações breves que respeitam a preferência por movimento reduzido. Não solicita permissão de notificações do navegador nem envia mensagens externas.

### Visão geral da operação

- **Indicadores no topo:** peças pendentes, técnicos a cobrar, compromissos de hoje e estoque conhecido. Fotografias cobrem todo o fundo dos cartões nos dois temas, com enquadramento proporcional e sobreposição para leitura dos números. As barras representam peças dentro/fora do prazo, contatos da fila atual, compromissos dos próximos 7 dias e técnicos dentro ou acima do limite de estoque. Os cartões abrem as consultas correspondentes e limpam filtros antigos.
- **Prioridades de cobrança:** técnicos a cobrar, previsões vencidas e devoluções previstas hoje. As promessas vencidas aparecem primeiro, seguidas das peças mais antigas. O botão **Cobrar** abre o registro de contato e previsão.
- **Agenda de devoluções:** compromissos dos próximos 7 dias, com quantidade de peças e técnicos por data. Registrar uma previsão não confirma a devolução.
- **Mapa do Brasil:** selecione um estado para conferir pendências ou estoque. A escala de verde a coral representa quatro faixas da taxa de atraso: 0–10%, >10–25%, >25–50% e >50%. No modo Novas, representa a proporção de técnicos acima do limite máximo de estoque. Estados sem planilha usam hachuras; uma planilha vazia importada conta como dado conhecido. O mapa não usa localização individual dos técnicos.
- **Indicadores e gráficos:** cumprimento do prazo, idade média ponderada pela quantidade de peças, atraso crítico (mais de duas vezes o prazo) e devoluções confirmadas em 7 dias. A evolução usa azul para pendências e coral tracejado para atrasos. O histórico começa com suas importações, sem números simulados.
- **Demais telas:** cobranças, peças, estoque, técnicos, importação e configurações têm resumos operacionais, tabelas e filtros com a mesma organização visual. Relatórios de novas ausentes não contam como estoque zerado nem como estoque dentro do limite.
- **Celular e acessibilidade:** layout adaptável, filtros por teclado, versões em tabela dos gráficos e animações reduzidas conforme a preferência do dispositivo.

O mapa amplia o estado ao passar o cursor ou receber foco por teclado; sair do estado ou pressionar Escape recolhe o destaque. A ampliação mantém a cor de risco e não muda a seleção. Estados na mesma faixa têm a mesma cor. Os controles também permitem aproximar o mapa inteiro e voltar à visão do Brasil. A evolução tem leitura por dia com as setas ← →, Home e End. Cartões, barras, linhas e medidores têm animações de entrada; os indicadores reagem ao cursor com uma inclinação suave e realce da imagem. Trocar filtros do mapa, da fila ou da agenda atualiza somente aquele componente. As animações respeitam a preferência de movimento reduzido.

## Regras (ajustáveis em Configurações)

### Histórico completo de inventário

**Histórico de inventário**, no menu lateral, ou **Técnicos → nome → Histórico de peças**, reúne o saldo atual e todas as saídas preservadas no banco, sem o corte operacional de 120 dias. Filtre por técnico, novas/usadas, situação, código, descrição, chamado ou NF e exporte o resultado completo.

Usadas que desaparecem da planilha ficam como devolvidas; reduções parciais encerram apenas a quantidade que saiu. Nas novas, uma saída sem destino informado aparece como **Devolução presumida**, separada de uso, transferência e devolução confirmada. O administrador pode confirmar/reclassificar o destino, inclusive em registros antigos. Novas presumidas não entram como devoluções confirmadas no ranking.

Uma linha representa um saldo ou uma saída registrada. O mesmo material pode aparecer em várias movimentações; o relatório não identifica unidades físicas únicas. O sistema mantém primeira observação, saída, quantidade e referências disponíveis. Não é possível reconstruir movimentações anteriores ao início do acompanhamento que nunca foram gravadas. Desfazer a última importação retira somente os registros produzidos por ela e restaura o saldo anterior.

No Firebase, as saídas de usadas e novas, o registro de importação e a troca do saldo oficial são confirmados na mesma transação. Assim, uma falha ao salvar o arquivo histórico não avança a foto do inventário.

O botão **Recolher**, no topo do menu lateral, amplia a área do painel no computador. Use **Mostrar menu lateral**, ao lado do título, para reabrir; a preferência é lembrada no navegador. As setas do topo e do rodapé percorrem as seções permitidas para o usuário, e as tabelas mantêm setas próprias de paginação.

No celular e em tablets com menu compacto, o menu abre sobre a página e tem **rolagem independente**. O fundo fica imóvel e não recebe cliques ou foco. Feche pelo botão, por Escape ou tocando na área escurecida: a página volta à mesma posição. Selecionar uma seção fecha o menu e abre a seção no topo. Ao passar para uma largura de computador, o menu compacto é encerrado automaticamente. Janelas e login também isolam a rolagem do fundo; os formulários acompanham a altura útil da tela, inclusive com teclado virtual.

Quando as colunas não cabem na tela, uma **barra horizontal inferior** acompanha a tabela visível, sem precisar descer até a última linha. Arraste o controle, toque na barra, use suas setas ou a roda do mouse sobre ela; não é necessário segurar Shift. Pelo teclado, as setas deslocam as colunas, e Home/End vão ao início/fim. Funciona também nas fichas de técnicos e nos detalhes em janelas, adapta-se ao menu recolhido e desaparece quando a tabela cabe inteira.

### Consulta avançada e rankings

**Consulta avançada**, no menu lateral, localiza materiais por nome ou código, inclusive códigos com zeros à esquerda. Combine palavras para refinar a descrição ou separe códigos por vírgula/ponto e vírgula. Os filtros incluem técnico, UF, novas/usadas, posição atual/histórico, família, situação, tipo de envio, chamado/NF/remessa, datas, dias e quantidade por registro. Campos ausentes no relatório não são inventados. A visão por responsável agrupa as quantidades; **Ver peças** abre seu detalhamento. **Exportar resultado** exporta todas as linhas filtradas, não apenas a página exibida.

Na **Visão geral**, os rankings têm filtros de **esta semana** (segunda-feira até hoje), **este mês** (dia 1 até hoje), **intervalo personalizado** (data inicial e final inclusivas), UF e novas/usadas, com usadas selecionadas inicialmente:

- **Maior volume em atraso:** quantidade de peças que ficaram acima do prazo no período, incluindo pendências e devoluções atrasadas. O maior atraso desempata; fotos diárias não são somadas repetidamente.
- **Devoluções em dia:** percentual das quantidades devolvidas dentro do prazo, com volume no prazo como desempate. Técnicos sem devolução não recebem uma taxa artificial de 100%.
- **Uso por técnico:** no modo usadas, trocas registradas por Data FT; cada registro conta uma vez mesmo após devolução parcial. No modo novas, saídas classificadas como uso em atendimento. Os dois modos são separados, não somados. Clique no técnico para ver códigos, descrições, tipos, quantidades e registros que compõem o indicador. O ranking completo fica disponível quando há mais de cinco técnicos.

Para escolher datas, clique em **Intervalo personalizado**, preencha **Data inicial** e **Data final** e clique em **Aplicar intervalo**. O período vale para os três rankings e seus detalhes, aceita um único dia e não permite datas futuras ou a data final anterior à inicial. Os atalhos de semana e mês continuam disponíveis.

**Novas: 7 dias por padrão, a partir da primeira observação do material no estoque.** O relatório não informa data de recebimento nem identifica individualmente cada unidade; a idade acompanha o saldo do material e não comprova a idade de cada unidade após uma reposição. Uma troca de tipo de envio não reinicia essa referência. Quedas de saldo entre importações geram saídas a classificar, sem presumir consumo. Somente saídas classificadas como devolução entram na pontualidade; transferências e ajustes não contam como uso. As datas de saída são as datas em que a diferença foi observada na importação, não uma confirmação do horário físico da movimentação.

Se uma saída tiver destinos diferentes, informe a quantidade de cada parte ao classificá-la; o restante mantém o destino anterior. As saídas de novas começam a ser registradas com esta versão e também entram em **Baixar tudo em Excel**. A carga operacional inicial usa os últimos 120 dias. Ao aplicar um intervalo anterior nos rankings, o painel busca também os registros antigos necessários; o menu **Histórico de peças** consulta todo o acervo preservado, sem esse corte. Lacunas entre importações e períodos anteriores ao acompanhamento não são reconstruídos. Os gráficos respeitam movimento reduzido e oferecem detalhes acessíveis por teclado.

### Parâmetros

**Prazos por técnico:** abra **Técnicos**, clique no nome e em **Alterar prazos**. Também é possível clicar diretamente nos prazos da lista ou usar **Editar cadastro**. Informe separadamente os dias para **usadas** e **novas** (inteiros de 1 a 90). Deixar um campo vazio faz aquele tipo seguir a regra geral; **Usar prazos gerais** limpa os dois campos, e **Salvar** confirma a mudança.

O prazo próprio recalcula as peças em aberto e vale para futuras importações. Usadas contam da Data FT (ou da primeira importação, se não houver data); novas contam da primeira observação do material. O alerta antecipado mantém a distância da regra geral: com prazo geral de 7 dias e aviso no 5º, um prazo próprio de 14 dias avisa a partir do 12º. Previsões combinadas com o técnico continuam registradas e, quando vencidas, continuam na fila de cobrança.

Alertas, mensagens, resumo diário, mapa, consultas e rankings respeitam a regra de cada responsável. Ao importar uma devolução ou saída de novas, o sistema guarda o prazo vigente; mudanças posteriores no cadastro não alteram esse registro. Registros antigos sem prazo salvo usam a regra geral. O prazo aplicado aparece na consulta e no detalhe do ranking, e os prazos do cadastro também constam na exportação de técnicos.

| Regra | Padrão |
|---|---|
| Prazo para devolver peça usada (a partir da Data FT) | 7 dias |
| Prazo observado de novas (primeira aparição do material) | 7 dias |
| Aviso de "vence em breve" | a partir de 5 dias |
| Limite máximo de peças novas por técnico | 10, sem tolerância adicional |
| Tipos de envio que contam no estoque | todos (BACKUP, PP, REP. BACKUP) |

Códigos numéricos no lugar do nome do técnico (ex.: `110301019`) são tratados como **base/depósito** e ficam fora do limite dos técnicos; dá para mudar em **Técnicos**.

---

## Estrutura do código

```
src/pagina.html, src/estilos.css   moldura e visual
src/operacao.css                   visual da central de operações
src/gestao.css                     temas, paleta funcional e composição das telas
src/analises.css                   consulta avançada e gráficos dos rankings
src/acesso.css                     login, contas e histórico de inventário
src/tema.js, src/botao-tema.html   escolha de tema e preferência local
src/assets/                      logos, favicon, ilustração e mapa (atribuição em MAPA-LICENCA.txt)
src/js/00…80                       lógica e telas (JavaScript puro, sem framework)
src/js/25-firebase.js              banco Firebase + login Google/Microsoft
src/js/26-identidade.js            autorização e autoria dos agendamentos
src/js/32-inventario.js            acervo completo de responsabilidades
src/js/79-usuarios.js              contas e cadastro de usuários
src/js/79-inventario.js            histórico de peças por técnico
src/js/31-analises.js              filtros, períodos, rankings e classificação de saídas
src/js/55-movimento.js             animações progressivas e preferência de movimento reduzido
src/js/62-indicadores.js           cálculos de gestão e resumos das seções
src/js/65-operacao.js              fila de cobranças, mapa e agenda
src/js/66-desempenho.js            rankings com detalhamento por material
src/js/78-consulta.js              tela de consulta avançada e exportação filtrada
build.py                           monta dist/site/index.html (o site)
aviso/enviar-aviso.mjs             e-mail diário (roda no GitHub Actions)
.github/workflows/                 publicar-site.yml e aviso-diario.yml
firestore.rules                    perfis, autorização e integridade da auditoria
seguranca/                         implantação protegida e guia Google/Microsoft
firebase.json                      emuladores para teste local
exemplos/                          planilhas fictícias no formato do sistema
testes/                            testes no Chromium (Playwright)
```

Testar localmente:

```bash
python3 build.py
npx firebase-tools emulators:start --only auth,firestore --project demo-controle-pecas
python3 -m http.server 8000 --directory dist
URL_SITE=http://127.0.0.1:8000/pagina-completa.html node testes/firebase-e2e.mjs exemplos capturas   # usa as regras reais e prepara somente o emulador local
```

Para validar a visão geral com as planilhas fictícias, sem conectar ao Firebase:

```bash
python3 build.py
python3 -m http.server 8000 --directory dist
# Em outro terminal, com Playwright e Chromium instalados:
node testes/operacao-e2e.mjs
node testes/gestao-e2e.mjs
node testes/interface-e2e.mjs
node testes/notificacoes-e2e.mjs
node testes/email-cobranca-e2e.mjs
node testes/analises-e2e.mjs
node testes/prazos-e2e.mjs
node testes/inventario-e2e.mjs
node testes/limite-estoque-e2e.mjs
node testes/intervalo-navegacao-e2e.mjs
node testes/rolagem-e2e.mjs
node testes/responsividade-e2e.mjs
```

Os testes abrem `pagina-completa.html` e exigem armazenamento em memória antes de importar dados. Verificam cobranças, previsões, agenda, devoluções, mapa, gráficos, cálculos, filtros combinados, agrupamento, períodos civis, uso sem duplicação, saídas classificadas, devoluções parciais, persistência e desfazer. A regressão de interface cobre contraste dos botões em repouso, com cursor e foco, seleção parcial, quantidades em lote, avisos e navegação por teclado nas janelas dos dois temas. Use `PW_PATH` e `CHROMIUM` para indicar instalações específicas; `URL_PAINEL_TESTE` permite mudar a URL local. O teste de prazos verifica herança, limites, alertas, mensagens, histórico, rankings e falhas de gravação. O teste com emuladores Firebase também verifica prazos personalizados e classificação em dois dispositivos, recarregamento e reversão das saídas de novas.

O teste de e-mail intercepta os links sem abrir provedores ou enviar mensagens reais. Verifica espaços codificados como `%20` (sem `+` indevido), sinais `+` reais, cópia real nos formatos HTML/texto, bloqueio da área de transferência, preenchimento, quantidades, prazo próprio, acentos, proteção dos cabeçalhos e da prévia, rascunho completo `.eml`, separação de contatos e usuários, autoria e responsividade nos dois temas. `testes/seguranca-regras.mjs` confirma nos emuladores que ter e-mail apenas no cadastro de técnico não autoriza acesso nem criação da própria permissão.

### Limite de peças novas

Até **10 peças**, inclusive zero, está dentro do limite padrão. **11 peças já significam excesso de 1**; não existe alerta de reposição por estoque baixo nem tolerância adicional. O dashboard, mapa, filtros, ficha do técnico, exportações e aviso diário seguem essa regra. Limites personalizados já cadastrados continuam válidos; 0 na configuração significa sem limite. Sem relatório de novas, o estoque fica como desconhecido, nunca como zero.
