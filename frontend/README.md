# Janus Ledger — Frontend

Angular app, no Material/component library — fully custom components themed
via CSS design tokens. Charts via Apache ECharts.

## Setup

```bash
cd frontend
npm install
```

Requires Node.js 18+ (works fine on the Node 22 most people have installed
in 2026). Angular CLI is a devDependency, so no global install needed.

## Run

```bash
npm start
```

This runs `ng serve` on **http://localhost:4200**. Make sure the backend is
also running on `http://localhost:8000` (see `../backend/README.md`) —
CORS is already configured for this origin.

## Project structure

```
src/app/
  core/
    models/       TypeScript interfaces mirroring the backend Pydantic schemas
    services/      ApiService (HTTP base) + one service per resource
                    (Asset, Transaction, Price, Report), using RxJS
                    BehaviorSubjects for shared state — no NgRx
  shared/
    components/    Custom UI kit: Button, Input, Select, Table, Modal, Badge
                    — all styled purely from CSS custom properties in
                    src/styles/tokens.scss, no external component library
  layout/
    shell.component.ts   Sidebar nav + content outlet
  features/
    dashboard/      Summary cards, allocation pie charts, holdings table
    transactions/    Transaction ledger (custom table) + entry/edit modal
    assets/          Asset list + entry/edit modal
    reports/         Cash flow / income / realized gains, tabbed views
src/styles/
  tokens.scss        The entire visual theme as CSS custom properties —
                       change values here to re-theme the whole app
  global.scss         Resets, base typography, and the .num / .delta
                       "ledger number" utility classes used everywhere
                       a financial figure is displayed
```

## Design system notes

- **No component library.** Every UI element (`pt-button`, `pt-input`,
  `pt-select`, `pt-table`, `pt-modal`, `pt-badge`) is hand-built and lives
  under `src/app/shared/components/`.
- **Theming is centralized** in `tokens.scss` via CSS custom properties
  (`--color-*`, `--space-*`, `--font-*`, etc). To add dark mode later,
  wrap an alternate token set under a `[data-theme="dark"]` selector and
  toggle the attribute on `<body>` — no component code needs to change.
- **The `.num` class** is the signature visual element: every financial
  figure in the app (prices, quantities, gains) should carry this class.
  It sets `font-variant-numeric: tabular-nums` in a monospace face so
  decimal points align vertically in columns, like a real paper ledger.
  Use `.num--gain` / `.num--loss` for color-coded amounts.
- **The custom `pt-table` component** supports two rendering modes: pass
  just `[columns]` and `[rows]` for a plain table, or project an
  `<ng-template let-row let-column="column">` inside `<pt-table>` to fully
  customize how each cell renders (used for badges, bold tickers, etc —
  see `assets.component.ts` or `transactions.component.ts` for examples).

## What's not wired up yet (left for you to extend)

- **Price snapshot & FX rate entry UI** — the backend endpoints and
  `PriceService` exist, but there's no dedicated form/page yet. Easiest
  path: copy the pattern from `assets.component.ts` (list + modal form).
  Worth adding to the Assets page as an expandable row, or as its own
  "Prices & FX" nav item.
- **Table sorting wiring** — `pt-table` emits `sortChange` events and
  supports `sortable: true` per column, but no feature component
  currently listens to it and re-sorts `rows`. Trivial to add: subscribe
  to `(sortChange)` and sort the array before passing it back in.
  Currently the reports realized-gains table would benefit most (usually
  needed by-year).
- **Confirm year-selector for realized gains** — the backend's
  `/reports/realized-gains?year=` param isn't used by the frontend yet;
  the table always shows all years.
- **Deleting** assets/transactions — services support `.delete()`, but no
  delete button/confirmation is wired into the UI yet (only create/edit).

None of these block getting the app running end-to-end — they're the
natural next increments once you're using it day to day.
