"""Build index.html from src/ and data/. Run from the repo root: python3 scripts/build.py"""
import json
t = open('src/template.html').read()
eng = open('src/pop_engine.js').read()
D = json.load(open('data/pop_data.json')); X = json.load(open('data/farmers.json')); OPS = json.load(open('data/ops_sample.json'))
X2 = {k: X[k] for k in ('FM', 'FW', 'OB')}
j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
data = ('const D=' + j(D) + ';\nconst X=' + j(X2) + ';\nconst OPS=' + j(OPS) + ';').replace('</', '<\\/')
out = t.replace('/*ENGINE*/', eng).replace('/*DATA*/', data).replace('/*APP*/', open('src/app.js').read())
# standalone page: the artifact host adds this shell itself; a plain browser or GitHub Pages needs it
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n')
open('index.html', 'w').write(HEAD + out + '\n</body></html>\n')
print('index.html', len(out), 'bytes')
