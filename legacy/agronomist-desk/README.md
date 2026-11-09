# Gramik Agronomist Desk

Prototype dashboard for Gramik agronomists. Open `index.html` in a browser; it is one self-contained file and needs no server.

## What it does

- **Today**: follow-up queue. Overdue follow-ups stay red until they are closed with an outcome or rescheduled with a reason. Also lists orders that need attention.
- **Farmers**: searchable list with crop stage, rating, last order and next follow-up.
- **Farmer profile**
  - Weather for the farmer's pincode, read against the crop stage: spray / avoid days and advice cards (when, check, do, products), with a Hindi WhatsApp message.
  - Crop plan: clickable stage band. Tap a past or current stage to see the orders placed in it and its top 3 recommended products (bought, bought in another stage, missed, due now). Upcoming stages stay blank.
  - Disease, pest, weed and must-do nutrition cards, with a "Seen in field" tick that moves the cure product to the top of Products.
  - Orders (current orders, order history, products bought), Cattle history, Interactions (WhatsApp / call / visit outcomes), Rating (defined parameters, senior confirmation).
- **Products drawer** (Gramik Lens pop-up): recommended vs in-stock products, price, stock at the serving dark store, past purchases, quantity, rule-based discount, add to an open order.
- **Orders**: delivery priority, dark-store capacity and routing, stock and duplicate-order flags.

## Data

| File | Source |
|---|---|
| `data/pop_data.json` | POP data: stages, issues, products, nutrition, weather and weed options |
| `data/farmers.json` | Farmers from the Lens export (IDs without `S-`) plus sample farmers (`S-` IDs) |
| `data/ops_sample.json` | **Example data**: pincodes, 7-day forecast, dark-store stock and load, prices, orders, follow-ups, cattle, ratings, order history |

For Lens farmers, products bought, order count, total spent and last order date are real. How products split across orders and earlier order dates are reconstructed (`scripts/make_hist.py`) until Lens shares order lines. The forecast is example data; `forecast()` in `src/app.js` is the one place to connect a live pincode feed.

Changes made on the page (follow-ups, logs, cattle, ratings, new orders) are saved only in the viewer's browser (localStorage).

## Layout

```
index.html              built page (open this)
src/template.html       page shell and CSS
src/app.js              dashboard code
src/pop_engine.js       POP Intelligence engine (shared with the stage finder and admin dashboard)
data/                   data bundles (see above)
scripts/make_ops.py     regenerates data/ops_sample.json
scripts/make_hist.py    adds order history to data/ops_sample.json (run after make_ops.py)
scripts/build.py        builds index.html from src/ and data/
```

## Rebuild

From the repo root:

```
python3 scripts/make_ops.py      # only if you change the sample data
python3 scripts/make_hist.py     # only after make_ops.py
python3 scripts/build.py
```
