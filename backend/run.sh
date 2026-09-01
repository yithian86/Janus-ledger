#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

backup_database() {
  local db_file="$ROOT_DIR/JanusLedgerDB"
  if [[ -f "${db_file}.db" ]]; then
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local backup_file="${db_file}.${timestamp}.db"
    cp --preserve=mode,timestamps "${db_file}.db" "$backup_file"
    echo "Created database backup: $backup_file"
  else
    echo "Database file not found, skipping backup: $db_file"
  fi
}

choose_python() {
  local candidates=(
    "$ROOT_DIR/.venv314/bin/python"
    "$ROOT_DIR/.venv314/Scripts/python.exe"
    "$ROOT_DIR/.venv314/Scripts/python"
    "$ROOT_DIR/venv/bin/python"
    "$ROOT_DIR/venv/Scripts/python.exe"
    "$ROOT_DIR/.venv/bin/python"
    "$ROOT_DIR/.venv/Scripts/python.exe"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  if command -v python3.14 >/dev/null 2>&1; then
    python3.14 -m venv "$ROOT_DIR/.venv314"
    echo "$ROOT_DIR/.venv314/bin/python"
    return 0
  elif command -v py >/dev/null 2>&1; then
    py -3.14 -m venv "$ROOT_DIR/.venv314"
    echo "$ROOT_DIR/.venv314/Scripts/python.exe"
    return 0
  elif command -v python >/dev/null 2>&1; then
    if python - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info[:2] == (3, 14) else 1)
PY
    then
      echo "$(command -v python)"
      return 0
    fi
  fi

  echo "Python 3.14 was not found. Install it first." >&2
  exit 1
}

backup_database
PYTHON_BIN="$(choose_python)"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Unable to find a usable Python interpreter at $PYTHON_BIN" >&2
  exit 1
fi

if "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1
import importlib
for name in ("fastapi", "uvicorn"):
    importlib.import_module(name)
PY
then
  :
else
  echo "Installing backend dependencies with $PYTHON_BIN..."
  "$PYTHON_BIN" -m pip install -r requirements.txt
fi

VENV_BIN_DIR="$(dirname "$PYTHON_BIN")"
UVICORN_BIN=""

if [[ -x "$VENV_BIN_DIR/uvicorn" ]]; then
  UVICORN_BIN="$VENV_BIN_DIR/uvicorn"
elif [[ -x "$VENV_BIN_DIR/uvicorn.exe" ]]; then
  UVICORN_BIN="$VENV_BIN_DIR/uvicorn.exe"
fi

if [[ -n "$UVICORN_BIN" ]]; then
  exec "$UVICORN_BIN" app.main:app --reload --host 0.0.0.0 --port 8000
else
  exec "$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
fi
