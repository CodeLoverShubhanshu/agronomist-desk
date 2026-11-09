"""Build data/catalog.json from the POP page's product catalog (CAT) and its first product photos.
Usage: python3 scripts/make_catalog.py raw.json img_dir
Photos are shrunk to 240px JPEG and stored as data URIs, so the one-file dashboard keeps working offline."""
import json, sys, re, io, base64, os
from PIL import Image
raw = json.load(open(sys.argv[1])); img_dir = sys.argv[2]
R = os.path.dirname(os.path.abspath(__file__)) + '/../'
POP = json.load(open(R + 'data/pop_data.json')); OPS = json.load(open(R + 'data/ops_sample.json'))
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower().replace('ju-', '').replace('(packet)', ''))
def thumb(path):
    im = Image.open(path).convert('RGB'); im.thumbnail((240, 240))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=74, optimize=True); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
cat, imgs = [], {}
for c in raw['CAT']:
    if c.get('stat') not in (None, 'ACTIVE'): continue
    im = c.get('im') or []
    if im and os.path.exists(os.path.join(img_dir, im[0])): imgs[c['id']] = thumb(os.path.join(img_dir, im[0]))
    cat.append({'id': c['id'], 'n': c['n'], 'b': c['b'], 'gk': bool(c['hb']), 'c': c['c'], 'r': c['r'], 'tech': c['tech'], 'sd': c.get('sd') or '', 'tag': c.get('tag') or '',
                'ben': c.get('ben') or [], 'crops': c.get('crops') or [], 'dose': c.get('dt') or '', 'rate': c.get('rate') or '',
                'pk': [{'pk': p['pk'], 'sku': p['sku'], 'mrp': p['fp'], 'sp': p['sp']} for p in c.get('pk', [])], 'upd': c.get('upd', '')})
ids = {c['id'] for c in cat}; byn = {norm(c['n']): c['id'] for c in cat}
names = set(POP['PR']) | set(OPS.get('PRICE', {}))
link = {}
for p in names:
    cid = raw['PRCID'].get(p)
    if cid not in ids: cid = byn.get(norm(p))
    if cid is None:
        m = [c['id'] for c in cat if norm(p) and (norm(p) in norm(c['n']) or norm(c['n']) in norm(p)) and min(len(norm(p)), len(norm(c['n']))) >= 4]
        cid = m[0] if len(m) == 1 else None
    tech = norm((POP['PR'].get(p) or {}).get('tech', '')) or norm(p)
    if cid in ids and next(c for c in cat if c['id'] == cid)['r'] in ('cattle_feed', 'seed', 'equipment'): cid = None  # a crop input never maps to feed, seed or tools
    if cid in ids and cid != raw['PRCID'].get(p) and byn.get(norm(p)) != cid and tech[:6] not in norm(next(c for c in cat if c['id'] == cid)['tech']): cid = None
    if cid in ids: link[p] = cid
json.dump({'meta': raw['CATMETA'], 'cat': cat, 'img': imgs, 'link': link}, open(R + 'data/catalog.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(cat), 'products,', len(imgs), 'photos,', len(link), 'of', len(names), 'desk products linked')
print('not linked:', sorted(names - set(link)))
print('size KB', os.path.getsize(R + 'data/catalog.json') // 1024)
