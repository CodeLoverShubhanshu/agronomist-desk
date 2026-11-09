"""Sample operations data for the agronomist dashboard prototype.
Everything here is example data (marked sample in the page) except the farmers from the Lens export,
whose crop, variety, sowing date, acres and purchases come from X.FM."""
import json, hashlib

X = json.load(open('data/farmers.json'))
D = json.load(open('data/pop_data.json'))

def h(s, n):
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % n

# ---------- pincodes ----------
PIN = {
 '226001': ('Lucknow', 'Lucknow GPO'), '226010': ('Lucknow', 'Gomti Nagar'), '226102': ('Lucknow', 'Malihabad'),
 '226301': ('Lucknow', 'Mohanlalganj'),
 '225001': ('Barabanki', 'Barabanki'), '225301': ('Barabanki', 'Dewa'),
 '212601': ('Fatehpur', 'Fatehpur'), '212635': ('Fatehpur', 'Bindki'),
 '241001': ('Hardoi', 'Hardoi'), '241204': ('Hardoi', 'Sandila'),
 '261001': ('Sitapur', 'Sitapur'), '261201': ('Sitapur', 'Biswan'),
 '209725': ('Kannauj', 'Kannauj'), '209801': ('Unnao', 'Unnao'),
 '262701': ('Lakhimpur Kheri', 'Lakhimpur'), '262802': ('Lakhimpur Kheri', 'Gola Gokarannath'),
 '201310': ('Gautam Buddh Nagar', 'Greater Noida'), '201301': ('Gautam Buddh Nagar', 'Noida'),
}
PREFIX = [['2097', 'Kannauj'], ['2098', 'Unnao'], ['226', 'Lucknow'], ['225', 'Barabanki'], ['212', 'Fatehpur'],
          ['241', 'Hardoi'], ['261', 'Sitapur'], ['262', 'Lakhimpur Kheri'], ['201', 'Gautam Buddh Nagar']]
STORE_OF = {'Lucknow': 'LKO', 'Unnao': 'LKO', 'Barabanki': 'BBK', 'Fatehpur': 'FTP', 'Hardoi': 'HRD', 'Kannauj': 'HRD',
            'Sitapur': 'STP', 'Lakhimpur Kheri': 'STP', 'Gautam Buddh Nagar': 'GNO'}

# ---------- example 7-day forecast (21-27 Oct) ----------
# code: 0 clear, 1 mainly clear, 2 partly cloudy, 3 overcast, 45 haze/fog, 61 light rain
DAYS = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']
BASE = {  # district: (max offset, min offset, humidity offset, profile)
 'Lucknow': (0, 0, 0, 'wind'), 'Barabanki': (0, 0, 2, 'wind'), 'Fatehpur': (1.5, 1, -6, 'dry'), 'Hardoi': (-0.5, -0.5, 4, 'rain'),
 'Sitapur': (-0.5, -0.5, 5, 'rain'), 'Kannauj': (0.5, 0, -2, 'dry'), 'Unnao': (0.5, 0.5, -1, 'dry'),
 'Lakhimpur Kheri': (-1, -1, 8, 'rain'), 'Gautam Buddh Nagar': (0, -1, -4, 'haze')}
MX = [32, 32, 31, 30, 30, 31, 31]; MN = [19, 19, 18, 18, 17, 17, 16]; HU = [62, 64, 60, 70, 72, 66, 63]; WI = [8, 9, 11, 9, 7, 6, 7]
WX = {}
for d, (mo, no, ho, prof) in BASE.items():
    rows = []
    for i, day in enumerate(DAYS):
        code, rain, pop, wind = (0 if i % 3 else 1), 0.0, 5 + h(d + day, 8), WI[i] + h(d + day + 'w', 3)
        if prof == 'wind' and i == 2: wind, code = 19, 2
        if prof == 'rain' and i in (3, 4): code, rain, pop = 61, (4.2 if i == 3 else 1.8) + (2 if d == 'Lakhimpur Kheri' else 0), 55 if i == 3 else 35
        if prof == 'rain' and i in (3, 4): wind = 13
        if prof == 'haze' and i >= 5: code = 45
        hum = HU[i] + ho + (12 if code == 61 else 0)
        rows.append({'d': day, 'max': round(MX[i] + mo), 'min': round(MN[i] + no), 'rain': round(rain, 1), 'pop': pop,
                     'hum': min(hum, 95), 'wind': wind, 'code': code})
    WX[d] = rows

# ---------- dark stores ----------
STORES = {
 'LKO': {'name': 'Lucknow dark store', 'load': 94, 'cap': 120, 'alt': 'BBK', 'altKm': 32},
 'BBK': {'name': 'Barabanki dark store', 'load': 61, 'cap': 80, 'alt': 'LKO', 'altKm': 32},
 'FTP': {'name': 'Fatehpur dark store', 'load': 48, 'cap': 70, 'alt': 'LKO', 'altKm': 118},
 'HRD': {'name': 'Hardoi dark store', 'load': 72, 'cap': 70, 'alt': 'STP', 'altKm': 88},
 'STP': {'name': 'Sitapur dark store', 'load': 55, 'cap': 90, 'alt': 'HRD', 'altKm': 88},
 'GNO': {'name': 'Greater Noida dark store', 'load': 40, 'cap': 60, 'alt': None, 'altKm': None},
}
PR = D['PR']
for k, s in STORES.items():
    s['stock'] = {}
    for p, v in PR.items():
        q = h(k + p, 46) - 6
        s['stock'][p] = max(0, q)
PRICE_T = {'fungicide': 420, 'insecticide': 560, 'herbicide': 480, 'nutrition': 280, 'biostimulant': 360, 'trap': 190,
           'adjuvant': 95, 'bactericide': 380, 'growth_regulator': 340}
PRICE = {}
for p, v in PR.items():
    base = PRICE_T.get(v.get('t'), 320)
    PRICE[p] = int(round(base * (0.75 + h(p, 55) / 100) / 5) * 5)

# ---------- farmers: pincode, phone, BSO, cattle, rating ----------
DIST_PINS = {}
for pin, (d, _) in PIN.items():
    DIST_PINS.setdefault(d, []).append(pin)
BSO_OF = {'Lucknow': 'B1', 'Unnao': 'B1', 'Barabanki': 'B2', 'Sitapur': 'B3', 'Lakhimpur Kheri': 'B3', 'Hardoi': 'B3',
          'Fatehpur': 'B4', 'Kannauj': 'B4'}
FARM = {}
for f in X['FM']:
    pins = sorted(DIST_PINS[f['district']])
    pin = '226102' if f['id'] == '905605' else pins[h(f['id'], len(pins))]
    FARM[f['id']] = {'pin': pin, 'phone': '9' + str(h(f['id'] + 'ph', 10 ** 9)).zfill(9), 'bso': BSO_OF[f['district']]}

CATTLE = {
 '905605': [{'d': '2026-09-28', 'cow': 2, 'buf': 1, 'breed': 'Sahiwal cross, Murrah', 'milk': 14, 'issue': 'Low milk after heat; advised mineral mixture', 'bought': ['Mineral mixture 1 kg'], 'by': 'Agronomist'}],
 '930944': [{'d': '2026-08-14', 'cow': 0, 'buf': 2, 'breed': 'Murrah', 'milk': 16, 'issue': 'Tick infestation on one buffalo', 'bought': [], 'by': 'BSO Neha'},
            {'d': '2026-10-02', 'cow': 0, 'buf': 2, 'breed': 'Murrah', 'milk': 18, 'issue': 'Recovered. Farmer asked for feed supplement price', 'bought': ['Bypass fat 1 kg'], 'by': 'Agronomist'}],
 'S-L02': [{'d': '2026-10-10', 'cow': 3, 'buf': 0, 'breed': 'HF cross', 'milk': 22, 'issue': 'One cow with mastitis signs; referred to vet', 'bought': [], 'by': 'BSO Neha'}],
 'S-L07': [{'d': '2026-09-20', 'cow': 1, 'buf': 3, 'breed': 'Murrah, desi cow', 'milk': 20, 'issue': 'Green fodder short; wants sugarcane tops advice', 'bought': ['Mineral mixture 1 kg'], 'by': 'BSO Rohit'}],
 'S-T04': [{'d': '2026-10-15', 'cow': 2, 'buf': 0, 'breed': 'Gir', 'milk': 9, 'issue': 'Repeat breeding in one cow', 'bought': [], 'by': 'Agronomist'}],
}

# rating parameters: interest, trust, responsiveness are 1-5 judged by a person; land and purchase history are computed
RATERS = {'R1': ('Pooja (intern)', 'Intern'), 'R2': ('Vikas (new joiner)', 'Junior'), 'R3': ('Shubhanshu', 'Senior'), 'R4': ('Meera', 'Senior')}
RATING = {}
for f in X['FM']:
    k = f['id']
    who = ['R1', 'R2', 'R3', 'R4'][h(k + 'r', 4)]
    RATING[k] = {'interest': 2 + h(k + 'i', 4), 'trust': 2 + h(k + 't', 4), 'resp': 1 + h(k + 's', 5), 'by': who,
                 'on': DAYS[0] if h(k, 3) else '2026-10-18', 'confirmed': RATERS[who][1] == 'Senior'}

# ---------- orders ----------
ORDERS = [
 {'id': 'GO-48211', 'f': '930944', 'date': '2026-10-17', 'items': [['Cipro Shield GR', 2], ['JU-Zodia', 2]], 'status': 'Manifested', 'store': 'FTP', 'pref': None, 'urgent': True, 'urgentWhy': 'Sheath blight spreading, farmer needs spray this week'},
 {'id': 'GO-48230', 'f': 'S-L01', 'date': '2026-10-19', 'items': [['Masaal', 4], ['Yellow Sticky Trap', 4]], 'status': 'Confirmed', 'store': 'STP', 'pref': None, 'urgent': True, 'urgentWhy': 'Aphid confirmed on call'},
 {'id': 'GO-48244', 'f': 'S-L02', 'date': '2026-10-19', 'items': [['Masaal', 5], ['Cipro Shield GR', 5]], 'status': 'Placed', 'store': 'HRD', 'pref': '2026-11-04', 'urgent': False, 'urgentWhy': '', 'note': 'Farmer wants delivery after irrigation, around 4 Nov'},
 {'id': 'GO-48245', 'f': 'S-L02', 'date': '2026-10-20', 'items': [['Masaal', 5]], 'status': 'Placed', 'store': 'HRD', 'pref': None, 'urgent': False, 'urgentWhy': '', 'priceNote': 'Same product as GO-48244 at a different price'},
 {'id': 'GO-48190', 'f': 'S-T05', 'date': '2026-10-14', 'items': [['Masaal', 1], ['COC', 1]], 'status': 'Rescheduled', 'store': 'BBK', 'pref': '2026-10-24', 'urgent': False, 'urgentWhy': '', 'note': 'Van reassigned to a large order on 18 Oct'},
 {'id': 'GO-48102', 'f': '905605', 'date': '2026-10-09', 'items': [['Gibromax', 1], ['Gramino', 1]], 'status': 'Delivered', 'store': 'LKO', 'pref': None, 'urgent': False, 'urgentWhy': '', 'delivered': '2026-10-12'},
 {'id': 'GO-48260', 'f': 'S-L04', 'date': '2026-10-20', 'items': [['Strepto Plus', 1], ['Pheromone trap (lure)', 1]], 'status': 'Placed', 'store': 'LKO', 'pref': None, 'urgent': False, 'urgentWhy': ''},
 {'id': 'GO-48155', 'f': 'S-L07', 'date': '2026-10-11', 'items': [['Top M', 6]], 'status': 'Returned', 'store': 'STP', 'pref': None, 'urgent': False, 'urgentWhy': '', 'note': 'Returned with OTP 15 Oct: farmer had bought locally'},
 {'id': 'GO-48271', 'f': 'S-T04', 'date': '2026-10-21', 'items': [['Cipro Shield GR', 3], ['Humigra 98', 3]], 'status': 'Placed', 'store': 'FTP', 'pref': None, 'urgent': False, 'urgentWhy': ''},
]
for o in ORDERS:
    for it in o['items']:
        assert it[0] in PRICE, it[0]
# force the manifested-without-stock case from the 18 Oct review
STORES['FTP']['stock']['JU-Zodia'] = 0
STORES['LKO']['stock']['Strepto Plus'] = 0

# ---------- follow-ups ----------
FUP = [
 {'id': 'FU1', 'f': '930944', 'due': '2026-10-17', 'why': 'Check sheath blight after spray', 'by': 'Agronomist'},
 {'id': 'FU2', 'f': 'S-T01', 'due': '2026-10-18', 'why': 'Promised a call to check germination', 'by': 'BSO Rohit'},
 {'id': 'FU3', 'f': 'S-L06', 'due': '2026-10-19', 'why': 'Farmer wanted time to think about thrips spray', 'by': 'Agronomist'},
 {'id': 'FU4', 'f': 'S-L01', 'due': '2026-10-21', 'why': 'Aphid confirmed by AI call: explain spray and confirm order', 'by': 'AI calling agent'},
 {'id': 'FU5', 'f': '905605', 'due': '2026-10-21', 'why': 'Ask how fruit set is after Gibromax', 'by': 'Agronomist'},
 {'id': 'FU6', 'f': 'S-L02', 'due': '2026-10-21', 'why': 'Confirm delivery date (wants after 4 Nov)', 'by': 'Logistics'},
 {'id': 'FU7', 'f': 'S-T03', 'due': '2026-10-22', 'why': 'Garlic emergence check', 'by': 'BSO Rohit'},
 {'id': 'FU8', 'f': 'S-L04', 'due': '2026-10-23', 'why': 'Curd stage nutrition reminder', 'by': 'Agronomist'},
 {'id': 'FU9', 'f': '1284732', 'due': '2026-10-25', 'why': 'Harvest date and next crop plan', 'by': 'Agronomist'},
]

LOG = [
 {'f': '930944', 'd': '2026-10-16', 'ch': 'WhatsApp', 'topic': 'Crop problem', 'out': 'Product recommended', 'note': 'Photo showed sheath blight lesions. Recommended JU-Zodia + Cipro Shield GR.', 'by': 'Agronomist'},
 {'f': 'S-L02', 'd': '2026-10-19', 'ch': 'Call', 'topic': 'Delivery', 'out': 'Follow-up needed', 'note': 'Will irrigate first, wants products after 4 Nov.', 'by': 'Agronomist'},
 {'f': 'S-T05', 'd': '2026-10-18', 'ch': 'WhatsApp', 'topic': 'Delivery', 'out': 'Follow-up needed', 'note': 'Asked why delivery moved. Told new date 24 Oct.', 'by': 'Sales rep'},
 {'f': '905605', 'd': '2026-10-12', 'ch': 'Visit', 'topic': 'Order', 'out': 'Ordered', 'note': 'Delivered Gibromax and Gramino. Farmer happy with plant growth.', 'by': 'BSO Amit'},
]
IVR = {'905605': ['Rabi seed treatment (Oct)'], 'S-L01': ['Mustard aphid alert (Oct)'], 'S-T01': ['Mustard aphid alert (Oct)'], 'S-L02': ['Potato late blight (Oct)']}
DUP = {'S-T02': {'id': '1093321', 'why': 'Same mobile number, name spelt "Vinod Katiyaar"'}}

BSOS = [
 {'id': 'B1', 'name': 'Amit Shukla', 'area': 'Lucknow, Unnao', 'plan': 18, 'done': 15, 'sched': 16, 'orders': 6, 'demos': 2, 'missed': 1, 'last': 'Visit to Insan Ali: delivered, farmer satisfied'},
 {'id': 'B2', 'name': 'Pradeep Yadav', 'area': 'Barabanki', 'plan': 14, 'done': 8, 'sched': 6, 'orders': 2, 'demos': 1, 'missed': 3, 'last': 'Two visits logged only on WhatsApp'},
 {'id': 'B3', 'name': 'Rohit Mishra', 'area': 'Sitapur, Lakhimpur, Hardoi', 'plan': 20, 'done': 17, 'sched': 19, 'orders': 7, 'demos': 3, 'missed': 1, 'last': 'Mustard aphid demo at Sitapur'},
 {'id': 'B4', 'name': 'Neha Verma', 'area': 'Fatehpur, Kannauj', 'plan': 15, 'done': 12, 'sched': 9, 'orders': 4, 'demos': 2, 'missed': 2, 'last': 'Paddy sheath blight photo check'},
]
DISPUTES = [
 {'id': 'DS-311', 'f': 'S-T05', 'order': 'GO-48190', 'issue': 'Delivery moved twice without a message', 'raised': '2026-10-19', 'owner': 'Sales rep'},
 {'id': 'DS-305', 'f': 'S-L07', 'order': 'GO-48155', 'issue': 'Refund of delivery charge after return', 'raised': '2026-10-16', 'owner': 'Sales rep'},
 {'id': 'DS-298', 'f': '905605', 'order': 'GO-48102', 'issue': 'One Gramino bottle leaking', 'raised': '2026-10-13', 'owner': 'Dispute desk'},
]

OPS = dict(PIN=PIN, PREFIX=PREFIX, STORE_OF=STORE_OF, WX=WX, STORES=STORES, PRICE=PRICE, FARM=FARM, CATTLE=CATTLE,
           RATERS=RATERS, RATING=RATING, ORDERS=ORDERS, FUP=FUP, LOG=LOG, IVR=IVR, DUP=DUP, BSOS=BSOS, DISPUTES=DISPUTES)
json.dump(OPS, open('data/ops_sample.json', 'w'), ensure_ascii=False)
print('ok', len(json.dumps(OPS)))
