# Portfolio Tracker — Backend

FastAPI + SQLite backend for the personal portfolio tracker.

## Setup

Option A — system Python 3.11 (recommended on Ubuntu/Debian)

```bash
# install Python 3.11 (one-time, requires sudo)
sudo apt-get update
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip

# create and activate a 3.11 virtual environment
python3.11 -m venv .venv311
source .venv311/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Option B — using `pyenv` (no sudo)

```bash
# install pyenv per its docs, then:
pyenv install 3.11.15
pyenv virtualenv 3.11.15 .venv311
pyenv activate .venv311
pip install -r requirements.txt
```

Option C — Windows environment
```
# Install Python 3.11 (one-time)

# Create and activate a virtual environment
python -m venv .venv311
.venv311\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Run

From the backend folder, use the launcher script:

```bash
cd /home/yithian/Workspace/Janus-ledger/backend
./run.sh
```

- API docs (Swagger UI): http://localhost:8000/docs
- Health check: http://localhost:8000/health

The SQLite database file `portfolio.db` is created automatically in the
`backend/` folder on first run. To reset all data, just delete this file
and restart the server.

## Suggested first steps to sanity-check it

1. Go to `/docs`, create an asset via `POST /assets` (e.g. an ETF in USD).
2. Add an FX rate via `POST /fx-rates` for USD -> EUR on a relevant date
   (required before any USD transaction can be converted to your base
   currency, EUR).
3. Add a `buy` transaction via `POST /transactions`.
4. Add a price snapshot via `POST /prices`.
5. Check `GET /reports/holdings` — you should see the position with
   unrealized gain computed.
6. Add a `sell` transaction for part of the position, then check
   `GET /reports/realized-gains` — FIFO gain should show up.
7. Check `GET /reports/cash-flow?granularity=month` and
   `GET /reports/income?granularity=month`.

## Notes on the design

- **Nothing is precomputed/stored** — holdings, realized gains, and cash
  flow are all derived from the `transactions` table at query time
  (see `app/services/fifo.py` and `app/services/aggregation.py`). This
  avoids sync bugs between stored and derived data, at the cost of
  recomputing on each report request (fine at personal-portfolio scale).
- **FX rates are "as of"**: if you don't have an exact FX rate for a given
  date, the most recent earlier rate is used. Add rates periodically
  (e.g. monthly) rather than for every single day.
- **Schema changes**: this uses `Base.metadata.create_all()`, which
  creates tables if missing but won't alter existing ones. If you change
  `models.py` after already having data, either delete `portfolio.db` and
  restart (loses data) or introduce Alembic migrations.
