# Importação de RMDF

Em **Importar planilhas**, selecione os relatórios de novas, usadas e RMDF. É possível enviar os três juntos, usando, por exemplo, `PR Novas.csv`, `PR Usadas.csv` e `PR RMDF.csv`. O nome RMDF tem prioridade sobre as colunas, pois esse relatório usa o mesmo cabeçalho das usadas. Se o arquivo tiver outro nome, selecione o tipo e a UF na conferência.

Um lote com RMDF fica aguardando confirmação. Arquivos sem uma categoria reconhecida no nome também ficam para conferência; o aviso explica que Usadas e RMDF compartilham as colunas. Confira os tipos e as UFs e clique em **Importar**. Cada categoria substitui apenas a própria foto naquela UF. A importação seguinte não acumula as quantidades da anterior. Não envie duas relações RMDF da mesma UF no mesmo lote.

## O que o RMDF representa

RMDF é uma peça recebida como nova que apresentou defeito ao ser utilizada no atendimento. O estoque possui três categorias: **novas, usadas e RMDF**. O total físico soma as três; uma peça RMDF não faz parte do saldo de novas aptas nem do limite de novas.

- Dias, prazo, atraso, cobrança, previsão e devolução de RMDF seguem as regras de usadas. A Data FT é a referência; sem ela, vale a primeira observação. Reimportar mantém essa data inicial enquanto a peça permanece no saldo.
- O prazo geral de devolução e o prazo personalizado de usadas também valem para RMDF. A mudança do prazo não altera uma devolução já encerrada.
- A redução ou saída de RMDF na próxima planilha registra a quantidade devolvida, sem alterar usadas ou novas. Devolução parcial mantém o restante com o técnico. O histórico conserva a categoria RMDF, a quantidade, o prazo aplicado e a data observada.
- Na mesma importação, uma redução de novas acompanhada de aumento de RMDF do mesmo técnico, UF e material é registrada como reclassificação, até a quantidade correspondente. Não conta como devolução nem uso em atendimento; eventual saída excedente permanece a classificar.
- Categorias não são confundidas por terem o mesmo material, NF ou chamado. RMDF tem identidade de acompanhamento própria, inclusive quando a chave de origem coincide com usadas.

Em **Peças RMDF**, consulte o saldo e as devoluções, filtre a situação/UF, busque material, NF, remessa ou chamado e exporte para Excel. É possível preparar a cobrança e registrar previsão formalizada por e-mail. Cobranças, agenda, indicadores, mapa, ficha do técnico, consulta, inventário, rankings e relatórios consideram a categoria. RMDF não entra no indicador de uso de peças aptas.

O PDF individual exibe novas, usadas e RMDF, soma as três categorias e mostra os dias e as referências de cada peça. Sem importação de uma categoria, o saldo não é tratado como zero confirmado. Todas as três planilhas participam da indicação de atualização da base.

## Portal e segurança

Os registros RMDF são publicados com identificadores próprios. Cada técnico vê apenas o estoque do seu vínculo técnico/UF e pode informar a quantidade e a previsão de devolução do RMDF. A declaração não altera o saldo oficial. As regras do banco verificam autoria, vínculo, versão atual, categoria e quantidade; o técnico não pode consultar outro estoque nem alterar o saldo.

O fluxo para informar RMDF previsto/aplicado em uma peça ainda listada como nova continua disponível. Isso não transforma automaticamente uma promessa em peça devolvida; a planilha define o estoque e a classificação define o destino de uma saída de novas.

A importação é exclusiva de administradores. Quantidade ausente, fracionada, inválida ou não positiva, ou falta de técnico/material, interrompe a leitura RMDF antes de atualizar o saldo. Um arquivo com cabeçalho e nenhuma linha representa estoque RMDF zerado e passa pela confirmação. **Desfazer** restaura a foto anterior e remove as saídas geradas pelo lote, usando o mesmo mecanismo das outras planilhas.

Amostra fornecida validada localmente, sem gravar em produção: 3.368 linhas, 3.519 peças, 32 técnicos. O arquivo não é incluído no repositório.
