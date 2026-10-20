# Lembretes de férias

Em **Férias da equipe → Lembretes por e-mail**, cada usuário com acesso à gestão de férias cadastra um endereço, altera sua preferência ou desativa os lembretes. A inscrição é privada e vinculada à conta autenticada. O perfil técnico não acessa inscrições nem recebe dados de férias da equipe. A desativação do usuário ou a mudança para perfil técnico também o exclui dos próximos envios.

O formulário permite escolher **horário de Brasília** e **antecedência de 1 a 90 dias corridos**. Inscrições antigas continuam com 7h55 e 10 dias até serem alteradas. O workflow **Lembretes de férias** verifica a cada cinco minutos, inclusive aos fins de semana, e considera cada inscrição somente após o horário escolhido. GitHub Actions pode atrasar ou omitir execuções; o horário não tem garantia de pontualidade. Saídas ainda futuras dentro da antecedência escolhida são recuperadas na próxima verificação. O e-mail informa os dias reais restantes, nome, UF, situação, período e retorno, sem observações internas ou matrícula. Se duas contas usam a mesma caixa, vale a união das preferências elegíveis, com um aviso por saída/endereço.

Cada início de período gera um aviso por endereço destinatário. Vários períodos são tratados separadamente; saídas próximas são reunidas na mensagem. Inscrições diferentes no mesmo endereço são agrupadas e não expõem outros destinatários em CC/BCC. Mudar a saída gera uma nova referência; editar observações, reordenar os períodos ou executar novamente o job não repete um aviso já aceito pelo SMTP. Férias canceladas, cadastros retirados/excluídos e inscrições desativadas são ignorados. Mudanças após uma mensagem já enviada não recolhem esse e-mail; o link permite consultar a programação atual.

## Configuração

Reaproveita os Secrets já usados no aviso diário de peças: `FIREBASE_SERVICE_ACCOUNT`, `GMAIL_USUARIO` (endereço completo) e `GMAIL_SENHA_APP`. Não usa `EMAIL_PARA` nem um destinatário padrão: apenas inscrições ativas e autorizadas recebem mensagens.

A publicação valida o projeto da credencial e a autenticação SMTP. Também processa os testes explicitamente solicitados; o teste inicial solicitado pelo proprietário usa somente a inscrição vinculada à conta principal, com uma operação única persistida para não repetir em publicações futuras. O resultado é registrado em `servicos/lembretes-ferias`, sem credenciais ou endereço do remetente. Se a configuração estiver ausente ou indisponível, o formulário informa que as inscrições aguardam a disponibilidade do serviço. Preencha/corrija os Secrets nas configurações seguras do GitHub e execute **Publicar painel** novamente; nunca coloque senhas no código ou em mensagens. O job agendado também reconfere a disponibilidade. O agendamento frequente consome minutos da cota GitHub Actions do repositório; acompanhe a cota e as execuções em Actions.

## Teste de envio

Preencha o e-mail e clique em **Enviar e-mail de teste**. O botão salva automaticamente o endereço e as preferências preenchidas antes de registrar o pedido, respeitando a opção de recebimento marcada. O pedido independe de inscrição ativa, horário, antecedência ou existência de saídas próximas; exige conta ativa com acesso às férias. O agendador processa o pedido na próxima execução. O resultado aparece no próprio modal, com data/hora de Brasília. “Aceito pelo servidor” exige confirmação SMTP; confira entrada e spam para confirmar recebimento. O teste não consome nem repete lembretes de férias. Aguarde ao menos um minuto entre testes concluídos. Pedidos pendentes, em envio ou incertos não podem ser substituídos pelo cliente. O servidor reserva o pedido antes do SMTP; uma interrupção/resultado incerto exige conferência administrativa, sem repetição automática.

`testes_lembretes_ferias/{uid}` só pode ser lido pelo próprio usuário autorizado; o cliente apenas solicita, nunca define o resultado. O servidor resolve o destino pela inscrição atual, sem aceitar destinatários no pedido. Contas revogadas e técnicos não recebem testes. Credenciais e endereços de terceiros nunca aparecem nos resultados.

## Falhas e conferência

`envios_lembretes_ferias` guarda o controle por endereço/saída; `caixa_lembretes_ferias` registra cada tentativa. Ambos são privados ao backend. Uma transação reserva a saída antes do SMTP, protegendo contra execuções concorrentes. A confirmação `enviado` indica aceite pelo SMTP, não comprovação de leitura ou entrega na caixa de entrada.

Uma rejeição inequívoca (`falhou`) permite nova tentativa. Timeout, interrupção do processo ou falha depois de um possível aceite (`incerto`/`em_envio`) não são reenviados automaticamente: SMTP e Firestore não oferecem uma transação única. A execução sinaliza a pendência para evitar duplicações silenciosas. Um responsável com acesso administrativo ao Firebase e ao remetente deve conferir o registro/Gmail antes de marcar como enviado ou liberar nova tentativa. Não libere uma tentativa sem confirmar que a mensagem anterior não foi aceita. Os logs do workflow mostram contagens e estados genéricos, sem endereços dos inscritos.

Os testes de seleção, conteúdo, concorrência e falhas usam transporte simulado e **não enviam e-mails reais**:

```sh
node testes/lembretes-ferias.mjs
```

Os testes de regras e navegador, incluídos no bloqueio de publicação, validam privacidade entre usuários, bloqueio de técnicos, edição, persistência, desativação e layout nos dois temas. A implantação só ocorre depois da aprovação desses testes.

O modal diferencia pedido na fila de processamento e permite abrir o workflow para que o responsável use **Run workflow** quando o agendamento atrasar. O intervalo de cinco minutos é a programação, não um prazo de entrega. As execuções registram contagens agregadas de testes/estados como anotações, sem destinatários. Recusa de destinatário e falha de autenticação mostram causas distintas, usando somente códigos SMTP permitidos; respostas brutas do servidor não são expostas.

Se o teste inicial do proprietário estava `indisponivel` (nenhuma tentativa SMTP), uma publicação com remetente habilitado pode retomá-lo. Pedidos já na fila, enviados ou incertos nunca são substituídos por essa retomada.

O rodapé mantém o resultado do teste e a resposta de cada ação junto aos botões. **Descadastrar e-mail** aparece para inscrições ativas e inativas, exclui a própria inscrição e cancela o pedido de teste ainda não reservado. Uma tentativa em processamento ou incerta é preservada para conferência; mensagens já em processamento podem concluir o envio. Para apenas pausar, desmarque a opção de receber e salve.
