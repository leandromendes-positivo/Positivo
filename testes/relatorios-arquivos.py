"""Verifica os arquivos reais gerados por relatorios-e2e.mjs.

Requer openpyxl e PyMuPDF. Executar depois do teste de navegador.
"""
import pathlib
import warnings
import zipfile
import xml.etree.ElementTree as ET

import fitz
import openpyxl

PASTA = pathlib.Path(__file__).resolve().parents[1] / 'capturas' / 'relatorios'
NS = {'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart'}

for nome in ('vazio', 'relatorio', 'filtrado'):
    with warnings.catch_warnings(record=True) as alertas:
        livro = openpyxl.load_workbook(PASTA / f'{nome}.xlsx')
    assert not alertas, [str(a.message) for a in alertas]
    assert livro.sheetnames == ['Resumo', 'Técnicos', 'Inventário atual', 'Movimentações', 'Materiais', 'Dados dos gráficos', 'Critérios']
    assert len(livro['Resumo']._charts) == 4
    assert [type(g).__name__ for g in livro['Resumo']._charts] == ['DoughnutChart', 'BarChart', 'LineChart', 'BarChart']
    assert livro['Resumo']['A1'].font.bold
    assert livro['Resumo']['A11'].number_format == '0.0%'
    assert livro['Técnicos'].freeze_panes == 'A7'
    assert len(livro['Inventário atual'].tables) == 1
    with zipfile.ZipFile(PASTA / f'{nome}.xlsx') as arquivo:
        for caminho in arquivo.namelist():
            if caminho.endswith(('.xml', '.rels')):
                ET.fromstring(arquivo.read(caminho))
        for n in range(1, 5):
            grafico = ET.fromstring(arquivo.read(f'xl/charts/relatorio{n}.xml'))
            for ref in grafico.findall('.//c:f', NS):
                assert ref.text.startswith("'Dados dos gráficos'!$")
            for cache in grafico.findall('.//c:numCache', NS):
                assert int(cache.find('c:ptCount', NS).attrib['val']) == len(cache.findall('c:pt', NS))
    pdf = fitz.open(PASTA / f'{nome}.pdf')
    texto = '\n'.join(p.get_text() for p in pdf)
    assert 'Relatório gerencial' in texto and 'Critérios e origem dos dados' in texto
    assert 'Todas as localidades' in texto if nome != 'filtrado' else 'Interior' in texto
    assert len(pdf[1].get_image_info()) == 4, 'quatro gráficos, mesmo quando imagens vazias são deduplicadas'
    for p in pdf:
        assert f'{p.number + 1} / {len(pdf)}' in p.get_text()
        # Rodapés, cabeçalhos e texto das tabelas permanecem dentro da folha.
        for bloco in p.get_text('blocks'):
            assert bloco[0] >= 0 and bloco[1] >= 0
            assert bloco[2] <= p.rect.width + 1 and bloco[3] <= p.rect.height + 1
        for imagem in p.get_images():
            for rect in p.get_image_rects(imagem[0]):
                assert rect.y1 < p.rect.height - 35, 'gráficos não invadem o rodapé'
    if nome == 'relatorio':
        assert [livro['Resumo'][c].value for c in ['A7', 'E7', 'I7', 'A11', 'E11', 'I11']] == [33, 8, 12, 1/3, 2, 3]
        assert livro['Técnicos'].max_row == 33, '27 técnicos, além da paginação da tela'
        assert livro['Inventário atual']['E7'].value == '000123'
        assert livro['Inventário atual']['E7'].data_type == 's'
        assert any(c.data_type == 's' and str(c.value).startswith('=HYPERLINK') for row in livro['Inventário atual'] for c in row), 'texto com = não se transforma em fórmula'
        assert livro['Inventário atual']['G7'].data_type == 'n'
        assert livro['Movimentações']['A7'].data_type == 'd'
        assert 'Técnico sem peças 24' in texto, 'último técnico está no PDF'
        assert 'BASE EXCLUIR' not in texto and 'IGNORADO EXCLUIR' not in texto
        assert '000789' in texto and 'Leandro' in texto
        assert livro['Inventário atual'].max_row == 11, 'todas as 5 linhas do estoque'
        assert livro['Movimentações'].max_row == 12, '6 saídas no período'
        for pagina in (0, 1, 2):
            pdf[pagina].get_pixmap(matrix=fitz.Matrix(1.6, 1.6)).save(PASTA / f'pdf-pagina-{pagina + 1}.png')
    elif nome == 'filtrado':
        assert livro['Resumo']['A7'].value == 6
        assert livro['Técnicos'].max_row == 7
        assert livro['Técnicos']['A7'].value == 'Bruno Exemplo'
        assert 'Ana Exemplo' not in texto
        assert 'Uso em atendimento' in texto or 'Usada em atendimento' in texto
    print(f'OK: {nome}.xlsx e {nome}.pdf — gráficos, formatação, tipos, filtros e conteúdo completo ({len(pdf)} páginas).')
