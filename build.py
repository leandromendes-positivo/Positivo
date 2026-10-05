#!/usr/bin/env python3
"""Monta o painel a partir de src/.

    python3 build.py

Gera:
  dist/site/index.html          o site (GitHub Pages): documento completo, com a configuração
                                do Firebase de firebase-config.json embutida, se existir
  dist/controle-de-pecas.html   versão para publicar no Claude (sem <html>/<head>: o Claude envolve)
  dist/pagina-completa.html     documento completo sem Firebase embutido (abre em qualquer navegador;
                                sem banco, usa memória ou a configuração colada em Configurações)
"""

import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent
SRC = RAIZ / "src"
DIST = RAIZ / "dist"
CONFIG_FIREBASE = RAIZ / "firebase-config.json"

RESET = (
    "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);"
    "padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;"
    "background:#fafaf8}img{max-width:100%}[hidden]{display:none!important}</style>"
)
# o mesmo "esqueleto" que o Claude coloca em volta da página publicada
ESQUELETO = (
    "<!doctype html><html><head><meta charset=utf8>"
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + RESET + "</head><body>{conteudo}</body></html>"
)
ICONE = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E"
    "%3Crect width='24' height='24' rx='6' fill='%230a6a84'/%3E%3Cg fill='none' stroke='white' "
    "stroke-width='1.8' stroke-linejoin='round'%3E%3Cpath d='M19 8.5 12 4.6 5 8.5v7l7 3.9 7-3.9z'/%3E"
    "%3Cpath d='m5 8.5 7 3.9 7-3.9M12 12.4v7'/%3E%3C/g%3E%3C/svg%3E"
)
SITE = (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<meta name="robots" content="noindex,nofollow">'
    '<meta name="theme-color" content="#0d1820">'
    '<link rel="icon" href="' + ICONE + '">'
    + RESET + "{config}</head><body>{conteudo}</body></html>"
)


def config_firebase() -> str:
    """Script com a configuração do Firebase (ou vazio se ainda não houver)."""
    if not CONFIG_FIREBASE.exists():
        return ""
    dados = json.loads(CONFIG_FIREBASE.read_text(encoding="utf-8"))
    if not (dados.get("apiKey") and dados.get("projectId")):
        return ""
    campos = {k: v for k, v in dados.items() if isinstance(v, str) and v}
    return "<script>window.CP_FIREBASE = " + json.dumps(campos, ensure_ascii=False) + ";</script>"


def main() -> int:
    css = (SRC / "estilos.css").read_text(encoding="utf-8")
    js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))
    if re.search(r"</script", js, re.IGNORECASE):
        print("ERRO: o JavaScript contém '</script'; escreva '<\\/script'.", file=sys.stderr)
        return 1
    pagina = (SRC / "pagina.html").read_text(encoding="utf-8")
    pagina = pagina.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
    config = config_firebase()
    (DIST / "site").mkdir(parents=True, exist_ok=True)
    (DIST / "site" / "index.html").write_text(SITE.replace("{config}", config).replace("{conteudo}", pagina), encoding="utf-8")
    (DIST / "controle-de-pecas.html").write_text(pagina, encoding="utf-8")
    (DIST / "pagina-completa.html").write_text(ESQUELETO.replace("{conteudo}", pagina), encoding="utf-8")
    print(f"ok: dist/site/index.html ({'com' if config else 'sem'} Firebase), dist/controle-de-pecas.html "
          f"e dist/pagina-completa.html ({len(pagina.encode('utf-8')) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
