# Importação de RMDF

Em **Importar planilhas**, selecione os relatórios de novas, usadas e RMDF. É possível enviar os três juntos, usando, por exemplo, `PR Novas.csv`, `PR Usadas.csv` e `PR RMDF.csv`. O nome RMDF tem prioridade sobre as colunas, pois esse relatório usa o mesmo cabeçalho das usadas. Se o arquivo tiver outro nome, selecione o tipo e a UF na conferência.

Um lote com RMDF fica aguardando confirmação. Arquivos sem uma categoria reconhecida no nome também ficam para conferência; o aviso explica que Usadas e RMDF compartilham as colunas. Confira os tipos e as UFs e clique em **Importar**. Cada categoria substitui apenas a própria foto naquela UF. A importação seguinte não acumula as quantidades da anterior. Não envie duas relações RMDF da mesma UF no mesmo lote.

## O que a relação representa

O formato recebido contém Técnico, Nota Fiscal, Remessa, Material Solicitado, Material Enviado, descrições, Chamado, Data FT e Qtd. Não contém situação, protocolo ou aprovação do RMDF. Portanto:

- RMDF fica separado dos saldos de novas e usadas e das respectivas cobranças;
- não se soma um total físico entre as três categorias, que podem conter a mesma peça;
- a importação não marca RMDF aplicado, aprovação ou devolução, nem desconta quantidades dos outros relatórios;
- desaparecer da próxima relação RMDF não gera devolução ou saída de novas;
- referências iguais em usadas são sinalizadas para conferência; em novas, a relação é apenas por técnico, UF e material, porque esse estoque é agregado e não comprova a identidade da peça.

Em **Relação RMDF**, consulte os registros por técnico e UF, busque material, NF, remessa ou chamado e exporte o recorte para Excel. A exportação completa também inclui uma aba própria. A indicação de técnico/UF não usa o e-mail de contato como autorização.

## Portal e segurança

Os registros RMDF são publicados com identificadores próprios, separados de novas e usadas. Cada técnico vê apenas os registros do seu vínculo técnico/UF, somente para consulta. As regras do banco impedem usar essa relação importada como uma declaração de devolução ou alteração de saldo. O fluxo existente para informar RMDF previsto/aplicado em peças novas continua separado.

A importação é exclusiva de administradores. Quantidade ausente, fracionada, inválida ou não positiva, ou falta de técnico/material, interrompe a leitura RMDF antes de atualizar a relação. Um arquivo com cabeçalho e nenhuma linha representa uma relação vazia e passa pela confirmação. **Desfazer** restaura a foto anterior usando o mesmo mecanismo das outras planilhas.

Amostra fornecida validada localmente, sem gravar em produção: 3.368 linhas, 3.519 peças, 32 técnicos. O arquivo não é incluído no repositório.
