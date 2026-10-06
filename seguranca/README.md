# Ativação de contas e permissões

O cadastro de usuários é protegido pelas regras do Firestore. Alterar somente o HTML não habilita permissões. O workflow **Publicar painel** publica as regras primeiro e só atualiza o site se essa etapa terminar com sucesso.

## Primeira ativação

1. No GitHub, em **Settings → Secrets and variables → Actions → Secrets**, configure `FIREBASE_SERVICE_ACCOUNT` com a credencial do projeto `controle-pecas-positivo`. Se o aviso diário já usa esse Secret, ele pode ser reaproveitado. Nunca coloque a chave em arquivos públicos ou mensagens.
2. A conta de serviço precisa de permissão para ler/gravar o Firestore e publicar regras: papéis **Cloud Datastore User** (`roles/datastore.user`) e **Firebase Rules Admin** (`roles/firebaserules.admin`). A administração do projeto deve conceder esses papéis quando necessário.
3. Em **Variables**, defina `INITIAL_ADMIN_EMAIL` com o e-mail exato do administrador principal. Alternativamente, informe o endereço no campo **administrador_inicial** ao executar **Actions → Publicar painel → Run workflow**. O endereço não precisa ser colocado no código público.
4. Habilite os provedores de entrada descritos abaixo. O e-mail do administrador precisa conseguir autenticar por um deles e estar verificado.
5. Execute **Publicar painel**. O script cria o administrador principal, publica as regras e preserva todos os dados operacionais existentes. Em publicações seguintes, valida o administrador já gravado; mudar a variável não troca o proprietário.
6. Entre no painel e abra **Cadastro de usuários** para autorizar os demais endereços. A lista antiga de e-mails escritos nas regras deixa de ser usada; os outros acessos devem ser cadastrados nesta tela.

Sem credencial, administrador inicial ou permissão para publicar regras, o workflow interrompe a atualização do site. Não publique o HTML manualmente para contornar essa verificação.

## Google

Em **Firebase → Authentication → Sign-in method → Google**, habilite o provedor. Em **Settings → Authorized domains**, mantenha `leandromendes-positivo.github.io` e o domínio de autenticação do Firebase. E-mails de qualquer domínio podem usar Google quando vinculados a uma Conta Google.

## Microsoft: Outlook e Microsoft 365 corporativo

1. No **Microsoft Entra admin center → App registrations → New registration**, registre uma aplicação para o painel. Em **Supported account types**, escolha **Accounts in any organizational directory and personal Microsoft accounts**. Isso permite contas corporativas de outros domínios e contas Outlook/Hotmail.
2. Cadastre a plataforma **Web** com o endereço de retorno:
   `https://controle-pecas-positivo.firebaseapp.com/__/auth/handler`
3. Copie o **Application (client) ID** e crie um **client secret**. Guarde o **Value** do segredo, não seu identificador. Configure um lembrete de expiração para renová-lo no Firebase antes de vencer.
4. No **Firebase → Authentication → Sign-in method → Microsoft**, habilite o provedor e informe o client ID e o secret. O segredo fica no Firebase, nunca no JavaScript ou no GitHub.
5. O painel usa `tenant: common` e pede apenas a autenticação padrão do provedor; não solicita acesso às caixas de e-mail. Uma organização Microsoft 365 pode exigir consentimento do administrador de TI para permitir a aplicação. Autorizar um usuário no painel não contorna as políticas da empresa.
6. Teste o botão **Entrar com Microsoft** com uma conta previamente cadastrada. Os emuladores testam os fluxos internos e as regras; não substituem esse teste de autenticação real.

O endereço retornado pelo provedor deve ser exatamente o cadastrado. Aliases diferentes são acessos diferentes; use o endereço principal apresentado na conta. Se o mesmo e-mail já tiver sido registrado por outro provedor, entre pela opção original. O painel não vincula identidades automaticamente pelo endereço.

## Proteções implementadas

- E-mail verificado, provedor Google/Microsoft e cadastro ativo são exigidos em toda leitura ou gravação operacional. Não há liberação por domínio inteiro.
- Usuário comum consulta, agenda, registra contatos e observações. Somente administrador altera cadastros, configurações, importações, classificações e acessos.
- Ninguém pode promover o próprio usuário comum a administrador ou criar seu próprio acesso. Somente um administrador ativo cadastra usuários.
- Não é possível desativar/rebaixar o próprio administrador nem o administrador principal. Cadastros são desativados, não apagados, para manter a identificação histórica.
- Cada previsão grava a posição atual e um evento imutável na mesma transação. As regras conferem UID, e-mail, horário do servidor, versão e data anterior; nem administradores do painel podem reescrever/apagar eventos.
- Contatos são acrescentados sem permissão para editar/apagar o histórico. A autoria antiga desconhecida permanece sem identificação.
- Revogação é aplicada pelas regras nas próximas operações e atualizada na sessão aberta. A interface limpa os dados carregados ao receber a revogação.
- A sessão de autenticação fica no armazenamento da aba, sem habilitar persistência de dados do Firestore em disco. O site usa HTTPS do GitHub Pages; tokens e segredos não entram no repositório.
- A falha ao conectar ao Firebase não é convertida silenciosamente em gravação temporária.
- Os totais do aviso diário são calculados no servidor a partir do banco atual, incluindo agendas de usuários comuns. Usuários comuns não podem substituir o resumo enviado pelo sistema.

A autenticação federada pode criar um registro técnico em **Firebase Authentication** após um login sem autorização. Isso **não cria um usuário do painel nem dá acesso a dados**: a coleção `usuarios` só pode ser alterada por administradores. O cadastro de acesso não é público.

Administradores do projeto Firebase e contas de serviço continuam sendo autoridades externas às regras do aplicativo. Proteja essas contas com MFA no provedor, acesso restrito e rotação de segredos; a recuperação do administrador principal exige essa administração do projeto.

## Testes locais

Use somente o projeto `demo-controle-pecas` e emuladores. Nunca importe dados fictícios no banco real.

```sh
python3 build.py
firebase emulators:start --only auth,firestore --project demo-controle-pecas
python3 -m http.server 8000 --directory dist
# Em outro terminal:
URL_SITE=http://127.0.0.1:8000/pagina-completa.html node testes/firebase-e2e.mjs
node testes/usuarios-e2e.mjs
node testes/seguranca-regras.mjs
node testes/inventario-e2e.mjs
```

Os testes de usuários precisam de Playwright, Chromium, Firebase compat 10.14.1, `@firebase/rules-unit-testing` 3.x e `firebase-admin`. `PW_PATH`, `CHROMIUM` e `FIREBASE_SDK_DIR` permitem usar instalações locais. Os testes de navegador usam `URL_PAINEL_TESTE`; o teste legado de Firebase usa `URL_SITE`. Os testes que preparam o mesmo emulador devem rodar em sequência.
