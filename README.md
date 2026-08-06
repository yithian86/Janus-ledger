# Portfolio Tracker

A local, single-user app for tracking stocks, ETFs, bonds, cash, and crypto
— transactions, dividends/coupons, multi-currency (base: EUR), FIFO
realized gains, and monthly/yearly cash flow and income reporting.

## Stack

- **Backend**: Python, FastAPI, SQLite, SQLAlchemy, pandas
- **Frontend**: Angular (standalone components), fully custom UI kit
  (no Material), Apache ECharts
- **Runs entirely locally** — no cloud services, no external API keys

## Quick start

Two terminals:

```bash
# Terminal 1 — backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend
cd frontend
npm install
npm start
```

Then open **http://localhost:4200**.

See `backend/README.md` and `frontend/README.md` for details, including a
suggested first-use walkthrough (add an asset → FX rate → transactions →
check the dashboard) to confirm everything's wired up correctly.

## Where things stand

This is a working scaffold covering the full flow: create assets, log
transactions (buy/sell/dividend/coupon/deposit/withdrawal/fee), enter
manual prices and FX rates, and view holdings, cash flow, income, and
FIFO realized gains — both as tables and ECharts visualizations.

Not yet built (see `frontend/README.md` for the full list): a dedicated
price/FX entry screen, table sorting wired into the UI, and delete
buttons in the transaction/asset lists. All straightforward extensions
of the existing patterns.

Since this was built without a live Angular/FastAPI environment to test
against, budget time for a first-run debugging pass — dependency version
mismatches or a typo are more likely here than in hand-tested code.
