# Lembretes de férias

Em **Férias da equipe → Lembretes por e-mail**, cada usuário com acesso à gestão de férias cadastra um endereço, altera sua preferência ou desativa os lembretes. A inscrição é privada e vinculada à conta autenticada. O perfil técnico não acessa inscrições nem recebe dados de férias da equipe. A desativação do usuário ou a mudança para perfil técnico também o exclui dos próximos envios.

O workflow **Lembretes de férias** verifica diariamente às **7h55 de Brasília**, inclusive aos fins de semana. GitHub Actions pode atrasar execuções; por isso, saídas ainda futuras na janela de 1 a 10 dias são recuperadas na próxima execução. Quem se inscrever depois do horário de processamento ou já dentro da janela recebe o aviso na próxima verificação, antes da saída. O e-mail informa a antecedência real, o nome, a UF, a situação (planejado/confirmado), o período e o retorno ajustado cadastrado, sem observações internas ou matrícula.

Cada início de período gera um aviso por endereço destinatário. Vários períodos são tratados separadamente; saídas próximas são reunidas na mensagem. Inscrições diferentes no mesmo endereço são agrupadas e não expõem outros destinatários em CC/BCC. Mudar a saída gera uma nova referência; editar observações, reordenar os períodos ou executar novamente o job não repete um aviso já aceito pelo SMTP. Férias canceladas, cadastros retirados/excluídos e inscrições desativadas são ignorados. Mudanças após uma mensagem já enviada não recolhem esse e-mail; o link permite consultar a programação atual.

## Configuração

Reaproveita os Secrets já usados no aviso diário de peças: `FIREBASE_SERVICE_ACCOUNT`, `GMAIL_USUARIO` (endereço completo) e `GMAIL_SENHA_APP`. Não usa `EMAIL_PARA` nem um destinatário padrão: apenas inscrições ativas e autorizadas recebem mensagens.

A publicação valida o projeto da credencial e a autenticação SMTP **sem enviar e-mails**. O resultado é registrado em `servicos/lembretes-ferias`, sem credenciais ou endereço do remetente. Se a configuração estiver ausente ou indisponível, o formulário informa que as inscrições aguardam a disponibilidade do serviço. Preencha/corrija os Secrets nas configurações seguras do GitHub e execute **Publicar painel** novamente; nunca coloque senhas no código ou em mensagens. O job diário também reconfere a disponibilidade.

## Falhas e conferência

`envios_lembretes_ferias` guarda o controle por endereço/saída; `caixa_lembretes_ferias` registra cada tentativa. Ambos são privados ao backend. Uma transação reserva a saída antes do SMTP, protegendo contra execuções concorrentes. A confirmação `enviado` indica aceite pelo SMTP, não comprovação de leitura ou entrega na caixa de entrada.

Uma rejeição inequívoca (`falhou`) permite nova tentativa. Timeout, interrupção do processo ou falha depois de um possível aceite (`incerto`/`em_envio`) não são reenviados automaticamente: SMTP e Firestore não oferecem uma transação única. A execução sinaliza a pendência para evitar duplicações silenciosas. Um responsável com acesso administrativo ao Firebase e ao remetente deve conferir o registro/Gmail antes de marcar como enviado ou liberar nova tentativa. Não libere uma tentativa sem confirmar que a mensagem anterior não foi aceita. Os logs do workflow mostram contagens e estados genéricos, sem endereços dos inscritos.

Os testes de seleção, conteúdo, concorrência e falhas usam transporte simulado e **não enviam e-mails reais**:

```sh
node testes/lembretes-ferias.mjs
```

Os testes de regras e navegador, incluídos no bloqueio de publicação, validam privacidade entre usuários, bloqueio de técnicos, edição, persistência, desativação e layout nos dois temas. A implantação só ocorre depois da aprovação desses testes.
