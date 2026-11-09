"""Sample farmers whose crop details (crop, variety, sowing date) are missing, so their POP plan can't be built yet.
They are added to data/ops_sample.json as NEWF, with their pincode, phone, BSO, rating and follow-ups."""
import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else 'data/ops_sample.json'
O = json.load(open(path))
base = dict(state='Uttar Pradesh', orders=0, value=0, lastOrder=None, lastDays=None, bought=[], lensPop=[], lensStage=None,
            queue='lead', sample=True, followUp=None, va=None, dss=None)
NEWF = [
 dict(base, id='S-N01', name='Ramkali Devi', district='Sitapur', village='Biswan', crop=None, variety=None, sow=None, acres=1.5,
      source='IVR: mustard aphid alert, pressed 1 for a call back'),
 dict(base, id='S-N02', name='Mukesh Rawat', district='Barabanki', village='Dewa', crop='Wheat', variety=None, sow=None, acres=3,
      source='Missed call. Said he grows wheat, nothing else known'),
 dict(base, id='S-N03', name='Sanjay Pal', district='Unnao', village='Unnao', crop='Potato', variety='Kufri Bahar', sow=None, acres=2,
      source='BSO visit: crop and variety noted, sowing date not asked'),
 dict(base, id='S-N04', name='Rekha Yadav', district='Hardoi', village='Sandila', crop='Strawberry', variety=None, sow=None, acres=0.5,
      source='Walk-in at Hardoi store'),
 dict(base, id='S-N05', name='Naresh Kumar', district='Fatehpur', village='Bindki', crop=None, variety=None, sow=None, acres=4,
      source='Referred by Raj Narayan Singh'),
]
PINS = {'S-N01': '261201', 'S-N02': '225301', 'S-N03': '209801', 'S-N04': '241204', 'S-N05': '212635'}
BSO = {'Sitapur': 'B3', 'Barabanki': 'B2', 'Unnao': 'B1', 'Hardoi': 'B3', 'Fatehpur': 'B4'}
for i, f in enumerate(NEWF):
    O['FARM'][f['id']] = {'pin': PINS[f['id']], 'phone': '9' + str(812345670 + i * 7919), 'bso': BSO[f['district']]}
    O['RATING'][f['id']] = {'interest': 3, 'trust': 2, 'resp': 3, 'by': 'R1', 'on': '2026-10-21', 'confirmed': False}
O['NEWF'] = NEWF
O['FUP'] = [x for x in O['FUP'] if not x['f'].startswith('S-N')] + [
 {'id': 'FU10', 'f': 'S-N01', 'due': '2026-10-23', 'why': 'IVR lead: ask crop, variety and sowing date', 'by': 'IVR'},
 {'id': 'FU11', 'f': 'S-N02', 'due': '2026-10-22', 'why': 'Get wheat variety and sowing date', 'by': 'Agronomist'},
 {'id': 'FU12', 'f': 'S-N03', 'due': '2026-10-24', 'why': 'Ask potato sowing date', 'by': 'BSO Amit'},
]
json.dump(O, open(path, 'w'), ensure_ascii=False)
print('added', len(NEWF))
