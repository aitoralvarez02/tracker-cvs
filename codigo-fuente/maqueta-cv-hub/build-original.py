#!/usr/bin/env python3
"""Genera los HTML autocontenidos de las dos herramientas a partir de src/ (sin dependencias)."""
import base64, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'out')
ASSETS = os.environ.get('CV_ASSETS', '/mnt/user-data/uploads/Editor-Propuestas/assets')


def leer(p, modo='r'):
    with open(p, modo, **({} if 'b' in modo else {'encoding': 'utf-8'})) as f:
        return f.read()


def b64(p):
    return base64.b64encode(leer(p, 'rb')).decode()


def fuente():
    f = os.path.join(ASSETS, 'fonts', 'open-sans-latin.woff2')
    return ("@font-face{font-family:'Open Sans';font-style:normal;font-weight:400 700;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');}" % b64(f))


def logo():
    return 'data:image/png;base64,' + b64(os.path.join(ASSETS, 'fotos', 'logo', 'Logo_KPMG.png'))


def construir(plantilla, app_js, css_extra, salida):
    h = leer(os.path.join(SRC, plantilla))
    rep = {
        '/*FONT*/': fuente(),
        '/*APP_CSS*/': leer(os.path.join(SRC, 'app.css')),
        '/*CV_CSS*/': leer(os.path.join(SRC, 'cv.css')),
        '/*EDITOR_CSS*/': leer(os.path.join(SRC, 'editor.css')) if css_extra == 'editor' else '',
        '/*VISOR_CSS*/': leer(os.path.join(SRC, 'visor.css')) if css_extra == 'visor' else '',
        '/*LOGO*/': logo(),
        '/*CORE_JS*/': leer(os.path.join(SRC, 'core.js')),
        '/*APP_JS*/': leer(os.path.join(SRC, app_js)),
    }
    for k, v in rep.items():
        h = h.replace(k, v)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, salida)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(h)
    return p


if __name__ == '__main__':
    print(construir('editor.html', 'editor.js', 'editor', 'cv-maker.html'))
    if os.path.exists(os.path.join(SRC, 'visor.html')):
        print(construir('visor.html', 'visor.js', 'visor', 'cv-hub.html'))
