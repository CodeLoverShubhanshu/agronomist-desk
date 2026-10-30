"""Sample Lens farmer directory: farmers who exist in Lens (with crop, variety and sowing date, i.e. POP data)
but are not yet on this agronomist's list. An uploaded call list is matched against it by Lens ID or phone.
In production this lookup is a call to the Lens API."""
import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else 'data/ops_sample.json'
O = json.load(open(path))
base = dict(state='Uttar Pradesh', orders=0, value=0, lastOrder=None, lastDays=None, bought=[], lensPop=[], lensStage=None,
            queue='lead', sample=True, followUp=None, va=None, dss=None)
L = [
 ('LN-20411', 'Rameshwar Prasad', '9839011201', 'Mohanlalganj', 'Lucknow', '226301', 'Wheat', 'DBW 303', '2026-10-20', 3, 4, 6150, ['Gramozyme Plus (Packet)', 'Zinox 395']),
 ('LN-20412', 'Sarita Kushwaha', '9839011202', 'Dewa', 'Barabanki', '225301', 'Potato', 'Kufri Jyoti', '2026-10-10', 2, 2, 2400, ['Masaal']),
 ('LN-20413', 'Mohd. Salim', '9839011203', 'Biswan', 'Sitapur', '261201', 'Mustard', 'ADV 414', '2026-10-05', 5, 0, 0, []),
 ('LN-20414', 'Jagdish Yadav', '9839011204', 'Bindki', 'Fatehpur', '212635', 'Paddy', 'Arize 6444 Gold', '2026-07-01', 4, 6, 7900, ['Cipro Shield GR', 'JU-Zodia', 'Gramino']),
 ('LN-20415', 'Kiran Devi', '9839011205', 'Malihabad', 'Lucknow', '226102', 'Tomato', 'Seminis Abhilash', '2026-09-15', 1, 1, 980, ['Decigen']),
 ('LN-20416', 'Harpal Singh', '9839011206', 'Gola Gokarannath', 'Lakhimpur Kheri', '262802', 'Sugarcane', 'Co 0238 (Karan 4)', '2026-03-01', 8, 5, 11200, ['Top M', 'Cipro Shield GR']),
 ('LN-20417', 'Ankit Mishra', '9839011207', 'Sandila', 'Hardoi', '241204', 'Chilli', 'Mahyco Navtej', '2026-08-20', 1.5, 3, 3100, ['Venus', 'Blue Sticky Trap']),
 ('LN-20418', 'Phoolmati', '9839011208', 'Unnao', 'Unnao', '209801', 'Cauliflower', 'Pusa Snowball-1', '2026-09-20', 1, 0, 0, []),
 ('LN-20419', 'Devendra Pal', '9839011209', 'Kannauj', 'Kannauj', '209725', 'Garlic', 'Chesnok Red', '2026-10-08', 2, 1, 650, ['Gramino']),
 ('LN-20420', 'Rukhsana Begum', '9839011210', 'Biswan', 'Sitapur', '261201', 'Green Pea', 'Advanta GS-10', '2026-10-12', 2.5, 0, 0, []),
]
O['LENS'] = [dict(base, id=i, name=n, phone=ph, village=v, district=d, pin=pin, crop=c, variety=va, sow=s, acres=a, orders=o, value=val, bought=b, sample=True, lens=True)
             for (i, n, ph, v, d, pin, c, va, s, a, o, val, b) in L]
json.dump(O, open(path, 'w'), ensure_ascii=False)
print('lens directory', len(O['LENS']))
