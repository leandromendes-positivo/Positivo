# Bibliotecas para exportar relatórios

Distribuições oficiais do registro npm, servidas pelo próprio painel e carregadas
somente ao exportar. Não há envio de dados a um serviço de conversão.

| Pacote | Versão | Arquivo original no pacote | SHA-256 do arquivo distribuído |
| --- | --- | --- | --- |
| exceljs | 4.4.0 | dist/exceljs.min.js | 7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9 |
| jspdf | 4.2.1 | dist/jspdf.umd.min.js | e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54 |

As licenças originais acompanham os arquivos. ExcelJS escreve células, estilos,
tabelas e imagens dos gráficos, sem edição manual do pacote XML. As cores usam
ARGB de oito dígitos. As imagens usam duas âncoras, compatíveis com o atributo
`editAs` do padrão OOXML. jsPDF produz um resumo de duas páginas com indicadores,
gráficos e prioridades, sem anexar milhares de linhas de inventário.

Para atualizar, obtenha o pacote oficial com `npm pack pacote@versão`, confira a
licença e o hash da distribuição, atualize os nomes em `68-exportar-relatorios.js`
e execute os testes de relatório. Nunca altere o conteúdo minificado manualmente.

O build copia esta pasta para `dist/site/vendor` e `dist/vendor`. Ao hospedar o
HTML fora do GitHub Pages, mantenha a pasta `vendor` ao lado do documento para
preservar as exportações.
