"""Past orders per farmer. Products, number of orders, total value and last order date are real Lens figures;
how products split across orders, order dates before the last one, and per-line amounts are reconstructed."""
import json, hashlib, datetime as dt
X = json.load(open('data/farmers.json')); O = json.load(open('data/ops_sample.json')); D = json.load(open('data/pop_data.json'))
h = lambda s, n: int(hashlib.md5(s.encode()).hexdigest(), 16) % n
def kind(p):
    n = p.lower()
    if 'seed' in n or 'paddy' in n and 'pretila' not in n: return 'Seed'
    if any(k in n for k in ('cattle', 'animal', 'mineral')): return 'Cattle'
    t = (D['PR'].get(p) or {}).get('t')
    return {'fungicide': 'Fungicide', 'insecticide': 'Insecticide', 'herbicide': 'Herbicide', 'nutrition': 'Nutrition', 'biostimulant': 'Biostimulant', 'trap': 'Trap', 'adjuvant': 'Adjuvant', 'bactericide': 'Bactericide'}.get(t, 'Other')
HIST = {}
for f in X['FM']:
    n, B = f.get('orders') or 0, f.get('bought') or []
    if not n or not B: continue
    last = dt.date.fromisoformat(f['lastOrder']) if f.get('lastOrder') else dt.date(2026, 10, 21) - dt.timedelta(days=f.get('lastDays') or 30)
    dates = [last]
    for i in range(1, n): dates.append(dates[-1] - dt.timedelta(days=6 + h(f['id'] + str(i), 9)))
    dates.reverse()
    orders = [[] for _ in range(n)]
    for i, p in enumerate(B): orders[i % n].append(p)
    for i in range(len(B), n): orders[i].append(B[h(f['id'] + 'r' + str(i), len(B))])   # repeat buys
    w = [[(p, (O['PRICE'].get(p) or 450) * (1 + h(p + f['id'] + str(i), 2))) for p in ps] for i, ps in enumerate(orders)]
    tot = sum(v for o in w for _, v in o); sc = f['value'] / tot
    H = []
    for i, o in enumerate(w):
        lines = [{'p': p, 'q': 1 + h(p + str(i), 2), 'amt': round(v * sc), 'kind': kind(p)} for p, v in o]
        H.append({'id': 'LN-' + f['id'][-4:] + '-' + str(i + 1).zfill(2), 'date': dates[i].isoformat(), 'lines': lines, 'status': 'Delivered'})
    # make the rounding land exactly on the Lens total
    H[-1]['lines'][-1]['amt'] += round(f['value']) - sum(l['amt'] for o in H for l in o['lines'])
    HIST[f['id']] = H
O['HIST'] = HIST
O.pop('DISPUTES', None)
json.dump(O, open('data/ops_sample.json', 'w'), ensure_ascii=False)
print({k: (len(v), sum(l['amt'] for o in v for l in o['lines'])) for k, v in HIST.items()})
