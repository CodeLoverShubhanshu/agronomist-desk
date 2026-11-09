"""Sample orders created by the signed-in agronomist, plus calls and POP entries, for the My profile page.
Dates are stored as days before today (dAgo) so Today / 7 days / 30 days always have data."""
import json, sys, hashlib
path = sys.argv[1] if len(sys.argv) > 1 else 'data/ops_sample.json'
O = json.load(open(path)); X = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'data/farmers.json'))
h = lambda s, n: int(hashlib.md5(s.encode()).hexdigest(), 16) % n
FARMERS = [f['id'] for f in X['FM']] + [f['id'] for f in O.get('NEWF', [])]
EXTRA = [('Kisan Seva Kendra, Sandila', 'RETAILER'), ('Om Agro Traders, Biswan', 'RETAILER'), ('Bhola Prasad', 'FARMER'), ('Kalawati', 'FARMER'),
         ('Ramesh Chandra Verma', 'FARMER'), ('Guddu Yadav', 'FARMER'), ('Shyam Lal Kushwaha', 'FARMER'), ('Jai Kisan Krishi Kendra, Dewa', 'RETAILER')]
PRODS = [p for p in O['PRICE'] if O['PRICE'][p] and h(p, 3)]
SOURCES = ['EXOTEL_OUTGOING'] * 5 + ['EXOTEL_INCOMING'] * 3 + ['RCS'] * 2 + ['WHATSAPP'] * 2 + ['FIELD_VISIT']
FLOW = ['Placed', 'Confirmed', 'Manifested', 'Out for delivery', 'Delivered']
DISPUTE = ['Product leaking on delivery', 'Wrong product delivered', 'Farmer says price was quoted lower', 'Delivered late, farmer refused part of order']
CANCEL = ['Farmer bought from local shop', 'Duplicate order', 'Farmer not reachable for delivery', 'Price too high']
orders = []
for i in range(46):
    k = 'm' + str(i)
    d = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 38, 41, 44, 47, 50, 53, 56, 60][i]
    if h(k, 10) < 6:
        fid = FARMERS[h(k + 'f', len(FARMERS))]; name, kind = None, 'FARMER'
    else:
        fid = None; name, kind = EXTRA[h(k + 'e', len(EXTRA))]
    n = 1 + h(k + 'n', 3) + (1 if kind == 'RETAILER' else 0)
    items = []
    for j in range(n):
        p = PRODS[h(k + 'p' + str(j), len(PRODS))]
        if p not in [x[0] for x in items]: items.append([p, (1 + h(k + 'q' + str(j), 3)) * (4 if kind == 'RETAILER' else 1)])
    r = h(k + 's', 100)
    if d <= 0: st = FLOW[min(2, h(k + 't', 3))]
    elif d <= 2: st = FLOW[1 + h(k + 't', 3)]
    elif d <= 4: st = FLOW[2 + h(k + 't', 3)]
    else: st = 'Delivered'
    if r < 11 and d > 0: st = 'Cancelled'
    elif r < 18 and d > 3: st = 'Returned'
    elif r < 40 and 0 < d < 9: st = 'Rescheduled'
    o = {'id': 'AGRI' + str(10 ** 12 + h(k + 'id', 9 * 10 ** 12)), 'fid': fid, 'name': name, 'kind': kind, 'items': items, 'dAgo': d,
         'time': '%02d:%02d' % (9 + h(k + 'h', 9), h(k + 'mi', 60)), 'source': SOURCES[h(k + 'src', len(SOURCES))], 'status': st}
    o['pay'] = 'Paid' if st == 'Delivered' and h(k + 'pay', 10) < 7 else 'Partly paid' if st == 'Delivered' else 'Refunded' if st == 'Returned' and h(k, 2) else 'Unpaid'
    if st == 'Cancelled': o['reason'] = CANCEL[h(k + 'c', len(CANCEL))]
    if st == 'Rescheduled': o['reason'] = 'New date ' + ['tomorrow', 'in 2 days', 'farmer asked after irrigation'][h(k + 'r', 3)]
    if st in ('Delivered', 'Returned') and h(k + 'd', 100) < 12 or (st == 'Delivered' and i in (4, 9)):
        o['dispute'] = DISPUTE[h(k + 'dd', len(DISPUTE))]
    orders.append(o)
# activity: calls and POP created (days ago)
act = []
# calls: about 22-33 a day on past working days (none on Sundays, counted from today), today's are spread by hour in the page
for d in range(1, 31):
    for i in range(22 + h('day' + str(d), 12)):
        act.append({'dAgo': d, 'kind': 'call'})
HRS = [9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14, 14, 14, 15, 15, 16, 16, 17]
OUTS = ['Connected'] * 23 + ['No answer'] * 4 + ['Busy'] * 2 + ['Switched off']
TOPICS = ['Pest & disease'] * 9 + ['Fertiliser & nutrition'] * 6 + ['Order & delivery'] * 4 + ['Sowing & seed'] * 3 + ['Cattle']
for i in range(30):
    out = OUTS[(i * 7) % len(OUTS)]
    act.append({'dAgo': 0, 'kind': 'call', 'hr': HRS[i], 'out': out, 'topic': TOPICS[i % len(TOPICS)] if out == 'Connected' else None,
                'secs': 150 + h('s' + str(i), 260) if out == 'Connected' else 0})
for i in range(29):
    act.append({'dAgo': [0, 1, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29][i], 'kind': 'pop'})
O['ME'] = {'name': 'Shubhanshu Singh', 'role': 'Agronomist', 'hub': 'Lucknow hub', 'since': '2026-04-01', 'shift': [9, 18], 'target': {'orders': 60, 'revenue': 60000, 'pop': 40, 'calls': 40}}
# follow-ups relative to today (dueIn days), a few with a booked call-back time
REL = {'FU1': (-6, None), 'FU2': (-5, None), 'FU3': (-2, None), 'FU4': (0, '4:30 PM'), 'FU5': (0, None), 'FU6': (0, '5:15 PM'), 'FU7': (1, None), 'FU8': (2, None), 'FU9': (4, None),
       'FU10': (0, '5:45 PM'), 'FU11': (-1, None), 'FU12': (1, None)}
for x in O['FUP']:
    if x['id'] in REL:
        x.pop('due', None); x['dueIn'], t = REL[x['id']]
        if t: x['time'] = t
# calls already completed today (shown under Completed)
O['DONE_TODAY'] = [{'f': '1284732', 'at': '2:40 PM', 'talk': '4m 30s', 'out': 'Product recommended', 'note': 'Harvest in 10 days; asked about wheat seed'},
                   {'f': 'S-T03', 'at': '2:22 PM', 'talk': '6m 05s', 'out': 'Resolved', 'note': 'Garlic emergence good, no issue'},
                   {'f': '934141', 'at': '11:10 AM', 'talk': '3m 40s', 'out': 'Not interested', 'note': 'Maize harvested, will call for rabi'}]
O['MYORD'] = orders; O['MYACT'] = act
json.dump(O, open(path, 'w'), ensure_ascii=False)
from collections import Counter
print(Counter(o['status'] for o in orders), sum(1 for o in orders if o.get('dispute')), Counter(o['dAgo'] == 0 for o in orders))
