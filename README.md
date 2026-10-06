# Controle de Peças

Painel web para acompanhar, todo dia, as **peças usadas** que cada técnico ainda não devolveu (prazo de 7 dias) e o **estoque de peças novas** de cada um (meta de ~10).

- **Site:** https://leandromendes-positivo.github.io/Positivo/ (abre no computador e no celular, com login Google)
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
3. Ainda no Firestore, aba **Regras**: apague o que estiver lá, cole o conteúdo do arquivo [`firestore.rules`](firestore.rules) **trocando `seu.email@gmail.com` pelo e-mail da conta que vai usar o painel** e clique em **Publicar**.
4. Menu **Criação → Authentication → Vamos começar → Google** → **Ativar** → escolha o e-mail de suporte → **Salvar**.
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

Abra o site → **Entrar com Google** → arraste as planilhas do dia (Novas e Usadas de cada região). Pronto.

---

## Rotina do dia

1. Exporte do sistema os relatórios de peças **Novas** e **Usadas** de cada região (`PR Usadas.csv`, `PR Novas.csv`…).
2. Abra o painel e **arraste as planilhas** (todas de uma vez).
3. **Cobranças → Cobrar hoje**: o botão **Cobrar** monta a mensagem para o WhatsApp; registre a cobrança e a **previsão de devolução** que o técnico informar.
4. Peça que some do relatório no dia seguinte conta como **devolvida**.

### Visão geral da operação

- **Indicadores no topo:** peças pendentes, técnicos a cobrar, compromissos de hoje e estoque conhecido. Cada cartão separa número, imagem, composição dos dados e ação. As barras representam peças dentro/fora do prazo, contatos da fila atual, compromissos dos próximos 7 dias e técnicos por faixa de estoque. Os cartões abrem as consultas correspondentes e limpam filtros antigos.
- **Prioridades de cobrança:** técnicos a cobrar, previsões vencidas e devoluções previstas hoje. As promessas vencidas aparecem primeiro, seguidas das peças mais antigas. O botão **Cobrar** abre o registro de contato e previsão.
- **Agenda de devoluções:** compromissos dos próximos 7 dias, com quantidade de peças e técnicos por data. Registrar uma previsão não confirma a devolução.
- **Mapa do Brasil:** selecione um estado para conferir pendências ou estoque. A escala de verde a coral representa quatro faixas da taxa de atraso: 0–10%, >10–25%, >25–50% e >50%. No modo Novas, representa a proporção de técnicos fora da faixa de estoque. Estados sem planilha usam hachuras; uma planilha vazia importada conta como dado conhecido. O mapa não usa localização individual dos técnicos.
- **Indicadores e gráficos:** cumprimento do prazo, idade média ponderada pela quantidade de peças, atraso crítico (mais de duas vezes o prazo) e devoluções confirmadas em 7 dias. A evolução usa azul para pendências e coral tracejado para atrasos. O histórico começa com suas importações, sem números simulados.
- **Demais telas:** cobranças, peças, estoque, técnicos, importação e configurações têm resumos operacionais, tabelas e filtros com a mesma organização visual. Relatórios de novas ausentes não contam como estoque zerado nem como necessidade de reposição.
- **Celular e acessibilidade:** layout adaptável, filtros por teclado, versões em tabela dos gráficos e animações reduzidas conforme a preferência do dispositivo.

O mapa amplia o estado ao passar o cursor ou receber foco por teclado; sair do estado ou pressionar Escape recolhe o destaque. A ampliação mantém a cor de risco e não muda a seleção. Estados na mesma faixa têm a mesma cor. Os controles também permitem aproximar o mapa inteiro e voltar à visão do Brasil. A evolução tem leitura por dia com as setas ← →, Home e End. Cartões, barras, linhas e medidores têm animações de entrada; os indicadores reagem ao cursor com uma inclinação suave e realce da imagem. Trocar filtros do mapa, da fila ou da agenda atualiza somente aquele componente. As animações respeitam a preferência de movimento reduzido.

## Regras (ajustáveis em Configurações)

| Regra | Padrão |
|---|---|
| Prazo para devolver peça usada (a partir da Data FT) | 7 dias |
| Aviso de "vence em breve" | a partir de 5 dias |
| Meta de peças novas por técnico | 10 (± 3) |
| Tipos de envio que contam no estoque | todos (BACKUP, PP, REP. BACKUP) |

Códigos numéricos no lugar do nome do técnico (ex.: `110301019`) são tratados como **base/depósito** e ficam fora da meta; dá para mudar em **Técnicos**.

---

## Estrutura do código

```
src/pagina.html, src/estilos.css   moldura e visual
src/operacao.css                   visual da central de operações
src/gestao.css                     temas, paleta funcional e composição das telas
src/tema.js, src/botao-tema.html   escolha de tema e preferência local
src/assets/                      logos, favicon, ilustração e mapa (atribuição em MAPA-LICENCA.txt)
src/js/00…80                       lógica e telas (JavaScript puro, sem framework)
src/js/25-firebase.js              banco Firebase + login Google
src/js/55-movimento.js             animações progressivas e preferência de movimento reduzido
src/js/62-indicadores.js           cálculos de gestão e resumos das seções
src/js/65-operacao.js              fila de cobranças, mapa e agenda
build.py                           monta dist/site/index.html (o site)
aviso/enviar-aviso.mjs             e-mail diário (roda no GitHub Actions)
.github/workflows/                 publicar-site.yml e aviso-diario.yml
firestore.rules                    quem pode acessar o banco
firebase.json                      emuladores para teste local
exemplos/                          planilhas fictícias no formato do sistema
testes/                            testes no Chromium (Playwright)
```

Testar localmente:

```bash
python3 build.py
npx firebase-tools emulators:start --only auth,firestore --project demo-controle-pecas
python3 -m http.server 8000 --directory dist/site
node testes/firebase-e2e.mjs exemplos capturas   # o emulador precisa de uma cópia de firestore.rules liberando teste@exemplo.com
```

Para validar a visão geral com as planilhas fictícias, sem conectar ao Firebase:

```bash
python3 build.py
python3 -m http.server 8000 --directory dist
# Em outro terminal, com Playwright e Chromium instalados:
node testes/operacao-e2e.mjs
node testes/gestao-e2e.mjs
```

Os testes abrem `pagina-completa.html` e exigem armazenamento em memória antes de importar dados. Verificam cobranças, previsões vencidas, agenda, devolução na importação seguinte, mapa, gráficos, cálculos dos indicadores, contraste dos dois temas e as sete telas em desktop e celular. Use `PW_PATH` e `CHROMIUM` para indicar instalações específicas; `URL_PAINEL_TESTE` permite mudar a URL local.
