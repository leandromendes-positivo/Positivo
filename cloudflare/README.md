# Lembretes de férias no Cloudflare Workers

Painel: https://positivo.pages.dev/. Este Worker é um projeto separado do Pages;
publicar o site não ativa o serviço de e-mail. O Worker está inativo por padrão.
O teste dispara via HTTPS autenticado, sem aguardar o GitHub. O cron verifica as
preferências a cada minuto, no horário de Brasília. A entrega na caixa de entrada
ainda depende do Gmail; não há garantia de entrega instantânea ou no segundo exato.

## 1. Criar o Worker conectado ao GitHub

No Cloudflare: Workers & Pages → Create application → Continue with GitHub.
Escolha `leandromendes-positivo/Positivo`, branch `main`, nome `positivo-lembretes`.
Mantenha a raiz do repositório (não limite o checkout à pasta cloudflare).

- Build command: `npm ci --prefix cloudflare --no-audit --no-fund`
- Deploy command: `npm --prefix cloudflare run deploy`
- Não habilite Preview builds para este Worker de produção: previews não devem
  executar cron de produção nem receber as credenciais do remetente.
- A rota `/testar` usa Firebase Authentication; não coloque uma tela de Cloudflare
  Access na frente dessa rota, pois o navegador precisa chamar a API autenticada.

Copie a URL estável `https://positivo-lembretes.<sua-conta>.workers.dev/`.
O primeiro deploy permanece inativo, mesmo se houver cron configurado.
`npm --prefix cloudflare run check` faz apenas o empacotamento, sem publicar/enviar.

## 2. Autorizar o Gmail atual (OAuth, uma vez)

A senha de aplicativo usada pelo GitHub não serve para a API do Gmail.
Não use conta de serviço como remetente de Gmail pessoal.

1. Entre em https://console.cloud.google.com/ e selecione o projeto usado pelo
   Firebase. Ative **Gmail API** em APIs & Services → Library.
2. Em **Google Auth Platform**, configure Branding e Audience. Use External se
   for Gmail pessoal. Na fase de testes, inclua o Gmail remetente em Test users.
3. Em Clients, crie um cliente OAuth do tipo **Web application**. Adicione como
   Authorized redirect URI: `https://developers.google.com/oauthplayground`.
4. Abra https://developers.google.com/oauthplayground, engrenagem → **Use your own
   OAuth credentials**, e informe o Client ID e Client Secret recém-criados.
5. Autorize somente `https://www.googleapis.com/auth/gmail.send`, usando o Gmail
   que já envia os lembretes. Troque o authorization code por tokens e guarde o
   **refresh token** diretamente nos Secrets do Worker. Não envie tokens pelo chat.
6. Uma aplicação OAuth External em Testing normalmente recebe refresh token que
   expira em sete dias para esse escopo. Antes de ativar o serviço definitivo,
   configure a aplicação em **Production**, cumpra os requisitos de consentimento
   apresentados pelo Google e gere novamente a autorização se necessário.
   Respeite as políticas da organização se for conta corporativa.

Essas configurações OAuth são para o remetente, não substituem o login do painel.

## 3. Cadastrar variáveis e secrets no Worker

No Worker → Settings → Variables and Secrets, em produção, cadastre:

| Nome | Tipo | Conteúdo |
|---|---|---|
| `WORKER_URL` | Variable | URL estável do Worker, com `/` final |
| `EMAIL_REMETENTE` | Variable | Gmail atual autorizado no passo anterior |
| `ATIVAR_SERVICO` | Variable | `false` durante a configuração |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | JSON completo da conta de serviço do projeto correto |
| `GMAIL_CLIENT_ID` | Secret | Client ID OAuth |
| `GMAIL_CLIENT_SECRET` | Secret | Client Secret OAuth |
| `GMAIL_REFRESH_TOKEN` | Secret | Refresh token do Gmail autorizado |

O projeto esperado é `controle-pecas-positivo`. Prefira uma conta de serviço
específica para este backend, com a permissão necessária de leitura/gravação no
Firestore (`roles/datastore.user`), sem conceder Owner. A chave é cadastrada
somente no backend. Não a coloque no código, no Pages, no HTML ou no chat.
Secrets existentes no GitHub não podem ser recuperados pela interface após salvos;
use seu arquivo original seguro ou crie uma credencial específica para o Worker.

A configuração versionada já contém `PAINEL_URL`, projeto e chave pública Firebase.
`keep_vars` mantém as variáveis acima ao publicar novas versões. Os secrets
continuam no Cloudflare. Nunca salve esses valores em arquivos versionados.

## 4. Ativar, conferir e encerrar o agendador antigo

1. Com todas as configurações preenchidas, altere `ATIVAR_SERVICO` para `true` e
   aplique a versão/configuração no Cloudflare.
2. Aguarde a primeira execução do Cron Trigger (a propagação inicial de um cron
   novo pode levar alguns minutos). O Worker valida o provedor e registra no
   Firestore `servicos/lembretes-ferias`: `executor=cloudflare`, endpoint estável,
   disponibilidade e data da verificação. Nunca registre secrets nesse documento.
3. Reabra o modal de lembretes no painel. Ele passa a informar Cloudflare e
   verificação por minuto. A inscrição, o e-mail, a antecedência, o horário e o
   histórico de envios permanecem os mesmos.
4. Clique em **Enviar e-mail de teste**. Confira o status de aceite e a caixa de
   entrada/spam. O teste chama `/testar` com o ID token do Firebase e processa
   exclusivamente o pedido já autorizado daquela conta. Não aceita UID/endereço
   de destino no corpo da requisição. A conta precisa permanecer ativa e possuir
   perfil de gestão de férias. Técnicos não podem chamar esse serviço.
5. Confira uma execução programada em Workers → Triggers/Observability. O teste
   imediato não confirma sozinho a execução do cron.
6. Só depois da conferência, no GitHub → Actions → **Lembretes de férias** → menu
   de três pontos → **Disable workflow**. Não desative **Publicar painel** nem o
   aviso diário de peças. Enquanto a transição ocorre, os scripts do GitHub
   reconhecem `executor=cloudflare` e pulam os envios. As reservas no Firestore
   também protegem contra tentativas simultâneas e reenvios duplicados.

O GitHub continua guardando o código. O Pages continua servindo o painel. O
Firebase continua guardando os dados e verificando os usuários. O serviço de
férias passa a executar no Worker. O caminho Gmail API não precisa de Resend nem
de domínio próprio. O código também suporta Resend com domínio verificado caso
haja uma decisão futura de trocar de provedor; não é necessário configurá-lo.

## Segurança, limites e recuperação

- CORS aceita somente a origem exata do painel configurado. CORS não substitui a
  autenticação: o token é validado na API do Firebase, incluindo projeto e
  revogação, e o perfil é relido no servidor antes de processar o pedido.
- O endpoint não cria pedidos e não libera o cliente para marcar um teste como
  enviado. As regras do Firestore continuam aplicando o limite entre testes.
- Os resultados vêm da resposta do Gmail/Resend. Um aceite não prova entrega ou
  leitura. Resultados incertos permanecem reservados, sem repetição automática.
- Configuração e falhas não são retornadas com credenciais ou dados de terceiros.
  Consulte os estados privados de envio no Firestore para conferência.
- O Worker usa o cron para retomar pedidos registrados quando a chamada direta
  falhar. Não há dependência da fila de máquinas do GitHub para o envio imediato.
- A conta gratuita tem cotas de requisições, CPU e subrequisições. Firestore e Gmail
  também têm cotas próprias. Acompanhe uso/erros; volumes maiores podem exigir
  paginação por lote, Cloudflare Queues ou plano pago. Não prometa envio ilimitado.
- Para retornar ao GitHub: primeiro defina `ATIVAR_SERVICO=false` no Worker e
  interrompa as execuções; depois, no console administrativo do Firestore,
  altere `servicos/lembretes-ferias.executor` para `github` e remova
  `endpointTeste`. Reative o workflow **Lembretes de férias**. Não apague os
  registros de reserva/envio. Confira tentativas `em_envio`/`incerto` antes de
  qualquer reenvio manual.
