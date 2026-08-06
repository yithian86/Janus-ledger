#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

choose_python() {
  if [[ -x "$ROOT_DIR/.venv311/bin/python" ]]; then
    echo "$ROOT_DIR/.venv311/bin/python"
  elif [[ -x "$ROOT_DIR/venv/bin/python" ]]; then
    echo "$ROOT_DIR/venv/bin/python"
  elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    echo "$ROOT_DIR/.venv/bin/python"
  elif command -v python3.11 >/dev/null 2>&1; then
    python3.11 -m venv "$ROOT_DIR/.venv311"
    echo "$ROOT_DIR/.venv311/bin/python"
  else
    echo "Python 3.11 was not found. Install it first." >&2
    exit 1
  fi
}

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

exec "$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
