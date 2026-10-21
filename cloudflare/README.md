# Lembretes de férias no Cloudflare Workers

Painel: https://positivo.pages.dev/. Este Worker é um projeto separado do Pages;
publicar o site não ativa o serviço de e-mail. O Worker está inativo por padrão.
O teste dispara via HTTPS autenticado, sem aguardar o GitHub. O cron verifica as
preferências a cada minuto, no horário de Brasília. A entrega na caixa de entrada
ainda depende do Gmail; não há garantia de entrega instantânea ou no segundo exato.

## 1. Criar o Worker conectado ao GitHub

No Cloudflare: Workers & Pages → Create application → Continue with GitHub.
Escolha `leandromendes-positivo/Positivo`, branch `main`, nome `positivo`.
Mantenha a raiz do repositório (não limite o checkout à pasta cloudflare).

- Build command: `npm ci --prefix cloudflare --ignore-scripts --no-audit --no-fund`
- Deploy command: `npm --prefix cloudflare run deploy`
- Não habilite Preview builds para este Worker de produção: previews não devem
  executar cron de produção nem receber as credenciais do remetente.
- A rota `/testar` usa Firebase Authentication; não coloque uma tela de Cloudflare
  Access na frente dessa rota, pois o navegador precisa chamar a API autenticada.

Copie a URL estável `https://positivo.leandromendes-positivo.workers.dev/`.
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
| `WORKER_URL` | Variable | Já versionada: `https://positivo.leandromendes-positivo.workers.dev/` |
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

A configuração versionada já contém `WORKER_URL`, `PAINEL_URL`, projeto e chave pública Firebase.
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
4. Preencha o e-mail e clique em **Enviar e-mail de teste**. O botão salva as
   preferências preenchidas antes de registrar o pedido, sem exigir outro clique
   em Salvar lembretes. A opção de recebimento ativo respeita a caixa marcada. Confira o status de aceite e a caixa de
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
- Para reduzir leituras no Spark, o cron consulta as inscrições autorizadas e
  uma revisão leve (última atualização e contagem). Só relê toda a programação
  quando muda o dia, chega o horário de uma inscrição, mudam preferências ou
  a programação de férias. O controle é persistido; não depende de memória do
  Worker. Reservas de envios continuam independentes desse controle.
- A conta gratuita tem cotas de requisições, CPU e subrequisições. Firestore e Gmail
  também têm cotas próprias. Acompanhe uso/erros; volumes maiores podem exigir
  paginação por lote, Cloudflare Queues ou plano pago. Não prometa envio ilimitado.
- Para retornar ao GitHub: primeiro defina `ATIVAR_SERVICO=false` no Worker e
  interrompa as execuções; depois, no console administrativo do Firestore,
  altere `servicos/lembretes-ferias.executor` para `github` e remova
  `endpointTeste`. Reative o workflow **Lembretes de férias**. Não apague os
  registros de reserva/envio. Confira tentativas `em_envio`/`incerto` antes de
  qualquer reenvio manual.

## Publicação do painel após a migração

O Cloudflare publica o Pages e o Worker pelas conexões ao repositório. O workflow
Publicar painel mantém os testes e as verificações do Firebase. A publicação no
GitHub Pages só acontece se a variável de repositório `PUBLICAR_GITHUB_PAGES` for
explicitamente `true`, para não reativar o endereço antigo após Unpublish site.

## Identidade visual dos e-mails

Lembretes e testes usam fundo branco, cabeçalho e rodapé pretos, com tipografia
Helvetica/Arial, tabelas e estilos inline. O layout solicita esquema claro para
preservar essa identidade; clientes que forçam inversão podem alterar as cores.
Datas continuam em texto, sem depender de imagens. O banner preto com a marca
Positivo é servido pelo Pages em `positivo-email-footer.png`, fica centralizado com largura máxima de 240 px. Cabeçalho e rodapé usam faixas
externas de 100% de largura; só o texto tem largura de leitura limitada. Há texto alternativo para imagens bloqueadas.
Lotes de até 20 saídas evitam que o Gmail corte o HTML antes do rodapé. Datas,
critérios, inscrições e deduplicação são os mesmos; avisos já enviados não são
repetidos só por uma mudança visual.

## Atualizações depois do primeiro lembrete

Após um envio aceito, `acompanhamento_lembretes_ferias` guarda, por destinatário e
cadastro, a programação que foi avisada. Somente o servidor acessa essa coleção.
Uma mudança de dados de negócio gera um e-mail **Programação atualizada**, com
os campos alterados e a programação anterior e atual. Isso inclui fim, retorno,
venda de dias, situação, cancelamento, retirada e exclusão. A atualização alcança
apenas endereços ativos que já receberam aquele cadastro e respeita o horário de
Brasília da inscrição, mesmo se a nova saída estiver fora da antecedência.
A verificação do Worker acontece a cada minuto; mudanças feitas antes do horário
escolhido aguardam esse horário. Várias edições entre duas verificações são
consolidadas na programação mais recente. Salvar sem mudar dados ou reordenar
períodos não gera repetição.

A reserva transacional impede duplicação entre trabalhadores concorrentes e
reconfere inscrição/perfil e férias antes de reservar. O estado anterior só é
substituído após o aceite do provedor. Rejeições inequívocas permitem tentar de
novo; timeout ou resultado incerto exigem conferência, sem repetição automática.
Registros antigos não guardavam o conteúdo enviado: a migração evita reenviar
tudo e usa a data da última edição para detectar alterações posteriores ao envio
antigo. Nesses casos o e-mail pode mostrar apenas a programação atual, pois não
há dados suficientes para reconstruir a anterior. A assinatura do agendador foi
versionada para executar essa conferência na implantação, após o horário devido.

## Login próprio com e-mail e senha

O login usa **Firebase Authentication**, não uma tabela de senhas. No cadastro de
usuários e técnicos, **Gerar senha temporária e enviar por e-mail** vem marcado
para novos acessos. Em acessos existentes, marcar a mesma opção substitui a senha
anterior por uma aleatória. A geração exige administrador ativo, autenticação
recente e permite somente outro cadastro ativo. O administrador principal é
protegido. O Google continua disponível; Microsoft foi retirado da tela inicial
(a conexão opcional do Outlook para rascunhos é independente e foi preservada).

### Ativação necessária, uma vez

1. No [Firebase Authentication](https://console.firebase.google.com/project/controle-pecas-positivo/authentication/providers),
   em **Método de login → E-mail/senha**, habilite **E-mail/senha** e salve.
2. Em [Google Cloud → IAM](https://console.cloud.google.com/iam-admin/iam?project=controle-pecas-positivo),
   localize a conta de serviço cujo `client_email` pertence ao JSON já guardado no
   Secret `FIREBASE_SERVICE_ACCOUNT` do Worker. Acrescente **Firebase Authentication
   Admin** (`roles/firebaseauth.admin`). Preserve o papel **Cloud Datastore User**
   usado pelo serviço. Não é necessário criar outra chave ou publicar o JSON.
3. Confira que o Worker tem o remetente Gmail e as credenciais já usados pelos
   lembretes. O código e as regras devem estar na mesma versão implantada. O
   Worker confere a configuração do provedor antes de gerar senhas; configuração
   ausente não deve invalidar o acesso atual durante essa conferência.
4. Cadastre um acesso de teste em **Cadastro de usuários**, mantenha a opção de
   senha temporária marcada e salve. Confirme o recebimento no e-mail autorizado.
   Em janela anônima, entre com e-mail e senha temporária, defina uma senha com no
   mínimo 12 caracteres e confira as permissões. Para técnico, confira o vínculo
   e a ausência de dados de outros estoques. Nenhum teste automatizado envia
   mensagens reais ou configura o provedor do projeto de produção.

### Fluxos e proteção

- A senha temporária é criptograficamente aleatória, enviada somente ao endereço
  do cadastro, não retornada ao administrador e expira em 24 horas. O Firestore
  guarda apenas seu hash (alta entropia), UID, versão e estado, nunca a senha.
- Antes da troca, **as regras do banco bloqueiam até o perfil**, não apenas a UI.
  Ao definir a senha, o servidor atualiza o Firebase, incrementa a claim `cpSenha`
  e exige uma nova autenticação. Tokens antigos, inclusive sessões federadas de
  contas que receberam uma senha temporária, não podem contornar a barreira.
- **Esqueci minha senha** envia um link secreto válido por 15 minutos. Pedir o
  link não altera a senha e não encerra sessões. Só quem possuir o link pode
  definir outra senha. Apenas o link mais recente vale, o uso é único e o token
  é armazenado como hash. O fragmento é removido do histórico ao abrir a tela.
- A redefinição administrativa gera outra senha aleatória, invalida as sessões
  antigas no banco e exige a troca novamente. A recuperação pública usa o link,
  em vez de trocar a senha antes de comprovar a posse do e-mail; isso impede que
  terceiros bloqueiem a conta apenas conhecendo o endereço corporativo.
- `credenciais_usuarios`, `recuperacoes_senha`, `pedidos_recuperacao` e
  `limites_contas` são exclusivamente do servidor. As APIs conferem o token no
  Firebase, projeto, UID, revogação e perfil; não aceitam permissões/estoque do
  corpo. CORS é restrito à origem configurada. Há limites por IP, conta e
  administrador, respostas de recuperação uniformes e corpos limitados a 4 KB.
- Se o cadastro for salvo e o envio falhar, a tela informa **cadastro salvo, envio
  não confirmado** e permite nova tentativa. Confira spam antes de reenviar; uma
  nova geração substitui a temporária anterior. Conta desativada não recebe
  credenciais nem pode concluir recuperação. A senha não altera perfil ou vínculo.
- Depois de resetar, abas antigas podem continuar exibindo conteúdo já visto;
  as regras bloqueiam novas leituras e escritas. Recarregar/entrar limpa a sessão.
  Permissões, revogação do perfil e isolamento dos técnicos continuam aplicados.
