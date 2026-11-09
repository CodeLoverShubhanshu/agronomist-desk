# Gramik Agronomist Desk

Prototype dashboard for Gramik agronomists. Open `index.html` in a browser; it is one self-contained file and needs no server. Navigation (Today, Farmers, After calls, My profile) sits in the green top bar.

## What it does

- **Today** (call target dashboard). The calling flow: **call queue → call brief → farmer profile (on call) → Complete call → interaction and rating → back to the queue**.
  - The call queue holds two kinds of calls: **From list** (today's call list, uploaded lists, undecided farmers coming back round) and **Callback** (overdue ones first). Tabs: All (still to call), From list, Callbacks, Completed. Each row's button is **Call** (it opens the farmer profile with the call running).
  - The call brief has one button: **Call <farmer>** (it reads **Back to call** while that call is on). Pressing it starts the call (number copied) and shows a sticky "On call with …" bar with **Copy number** and **Complete call**. Only one call at a time.
  - **Complete call** opens the form: 1 · Interaction — **Order placed** needs no input (goes straight to Rating; the service team confirms products); **Callback** asks for a callback reason (Not ordered yet, Busy, Waiting for money …), a date from a calendar that shows how many callbacks are already set each day, a time (Any time or 9:30 AM–7:30 PM; past times hidden for today, booked times marked), and what to talk about next time; **Undecided** asks why undecided (Price feels high, Buys from the local shop …) and when it comes back to the queue, then 2 · Rating (Interest, Trust in Gramik). **Save and complete call** ends the call: it leaves All, moves to **Completed**, and you are back in the queue where you left it. **Busy · call again today** (replaces "Farmer didn't pick up") asks what happened (Busy, Didn't pick up, Switched off, Call cut) and a time later today (9:30 AM to 7:30 PM, past times hidden, booked times marked; tomorrow morning when no time is left). The farmer stays in the queue as a callback at that time; no rating needed.
  - Tiles: Connected, Pending calls, Orders from calls, Callbacks due, Undecided (each opens its list), Avg talk time.
- **Dark stores** (beside Today): one card per dark store with its capacity today (% full and room left). Click a card to see its stock split into In stock and Out of stock, with a search box. Stock and capacity are example data; store IDs come from `data/stores.json` (the dark store sheet).
- **After calls**: where every call ends up. **Orders** (handled by the service team), **Callbacks** (yours; due ones can be called from here; **Reschedule** opens a calendar with the count of callbacks under each date and that day's list, you pick a date and time and confirm, and both dates' counts update) and **Undecided** (closed for now, back in the call queue after 2–14 days).
- **Upload list** (Today header and Farmers page): upload an Excel (.xlsx) or CSV call list. Each row is matched by Lens ID or phone: already your farmer, found in Lens (crop, variety and sowing date fetched, so the POP plan is ready), or new (crop from the file if given, otherwise filled on the call). Rows with no or wrong phone numbers and duplicates are skipped. A preview shows every row before you add them; added farmers join today's call queue under an **Uploaded** tab. `lensLookup()` in `src/app.js` is the one function to point at the real Lens API. Try `samples/sample-call-list.xlsx`.
- **Farmers**: searchable list with crop stage, rating, last order and next follow-up. Filter by POP filled / Needs crop details / From uploaded lists. An **Uploaded call lists** card shows each list (date, your farmers / found in Lens / new, how many called) with Show farmers and Remove from queue.
- **Farmers without POP**: farmers whose crop, variety or sowing date is missing (or whose crop has no POP). Their profile opens a "Fill crop details" form with Hindi questions to ask on the call; the sowing date can be a date or the stage the farmer describes. Saving builds the POP plan straight away.
- **Farmer profile**
  - Weather for the farmer's pincode, read against the crop stage: spray / avoid days and advice cards (when, check, do, products), with a Hindi WhatsApp message.
  - Crop plan: clickable stage band. Tap a past or current stage to see the orders placed in it and its top 3 recommended products (bought, bought in another stage, missed, due now). Upcoming stages stay blank.
  - Disease, pest, weed and must-do nutrition cards, with a "Seen in field" tick that moves the cure product to the top of Products.
  - Weather and crop advice is closed by default (one line: today's weather, spray days, advice count); click it to open the 7-day forecast and advice.
  - Diseases, Pests, Weeds and Other problems show this stage's list first. **More diseases (n)** / **More pests (n)** under each section opens the crop's other problems (lower on this stage's list, or expected in other stages, with the stage named), each with cure product and Seen in field. A ticked one stays on top.
  - Tabs: Crop plan, Orders, Cattle. Interactions and rating are captured in the call outcome form, not as profile tabs.
  - The How to use panel opens as a short call script in **English, हिंदी or Hinglish** (Hinglish by default, choice remembered): a one-line summary, numbered steps (each spray with one 15 L pump recipe and pumps for the field, soil, seed, traps), what not to mix, when to spray and 3 safety points, with a WhatsApp copy in the same language. **Full detail** below opens the technical version.
  - In the Products cart (where discounts show), one **How to use these N products together** button under the cart lines shows how all cart products are used on this crop: which products share a spray tank and which go in a separate spray (5–7 days apart) based on the compatibility data, mixing order per 15 L pump with per-pump amounts, herbicides in their own sprayer, soil application, seed treatment, traps, why products are split, good spray days, product cautions and safety measures, with a Hindi copy for WhatsApp.
- **My profile** (bottom of the left menu): the signed-in agronomist's numbers for Today / 7 days / 30 days / All time: orders created, net orders, today's orders and revenue, cancelled or returned, POP created, calls, disputed, payment pending. Each tile filters the order list. **My orders** lists every order with status filters (Placed, Confirmed, Manifested, Out for delivery, Delivered, Rescheduled, Cancelled, Returned, Disputed), search, payment / source / customer-type filters, a progress bar per order, an expandable tracking timeline, and CSV export. **Overview** shows monthly targets, orders by status, order sources and top products.
- **Product catalog** (button beside Products (Lens) on the farmer profile): the 116 products of the Gramik catalog export (from the POP page), with photo, brand, technical, category, crops, benefits and every pack with SKU, MRP and price. Search, category chips and a Gramik-brand filter; products recommended for the farmer come first. Products the desk sells can be added to the cart from here.
- **Product photos**: real packshots on the Products list and in the cart (same 52 px tile; 28 px in the cart lines). Built by `scripts/make_catalog.py` into `data/catalog.json`.
- **Products drawer** (Gramik Lens pop-up): recommended vs in-stock products, price, stock at the serving dark store, past purchases, quantity, rule-based discount, add to an open order.

## Data

| File | Source |
|---|---|
| `data/pop_data.json` | POP data: stages, issues, products, nutrition, weather and weed options. Taken from the POP Intelligence stage page (24 Oct 2026 update: 64 products) |
| `data/farmers.json` | Farmers from the Lens export (IDs without `S-`) plus sample farmers (`S-` IDs) |
| `data/catalog.json` | Product catalog from the POP page's catalog export (29 Oct 2026): 116 products, packs and prices, 113 photos (240 px), and the link from desk product names to catalog products |
| `data/stores.json` | Gramik dark stores from the dark store sheet (30 Oct 2026): IDs, names and which ones the desk is linked to |
| `data/ops_sample.json` | **Example data**: pincodes, 7-day forecast, dark-store stock and load, prices, orders, follow-ups, cattle, ratings, order history |

For Lens farmers, products bought, order count, total spent and last order date are real. How products split across orders and earlier order dates are reconstructed (`scripts/make_hist.py`) until Lens shares order lines. The forecast is example data; `forecast()` in `src/app.js` is the one place to connect a live pincode feed.

Changes made on the page (crop details, follow-ups, logs, cattle, ratings, new orders) are saved only in the viewer's browser (localStorage).

## Layout

```
index.html              built page (open this)
src/template.html       page shell and CSS
src/app.js              dashboard code
src/pop_engine.js       POP Intelligence engine (shared with the stage finder and admin dashboard)
data/                   data bundles (see above)
scripts/make_ops.py     regenerates data/ops_sample.json
scripts/make_hist.py    adds order history to data/ops_sample.json (run after make_ops.py)
scripts/add_nopop.py    adds sample farmers without crop details (run after make_hist.py)
scripts/add_myorders.py adds the agronomist's own sample orders and activity (run after add_nopop.py)
scripts/add_lens.py     adds the sample Lens farmer directory that uploaded lists are matched against (run last)
samples/                sample call lists (.xlsx and .csv) to try the upload
scripts/build.py        builds index.html from src/ and data/
```

## Rebuild

From the repo root:

```
python3 scripts/make_ops.py      # only if you change the sample data
python3 scripts/make_hist.py     # only after make_ops.py
python3 scripts/add_nopop.py     # only after make_hist.py
python3 scripts/add_myorders.py  # only after add_nopop.py
python3 scripts/add_lens.py      # last
python3 scripts/build.py
```

## Updating the POP data

When the POP Intelligence page changes, copy its `const D = {...}` data into `data/pop_data.json`, then run all five data scripts in order (`make_ops.py`, `make_hist.py`, `add_nopop.py`, `add_myorders.py`, `add_lens.py`) so new products get sample prices and stock, and finally `build.py`.
