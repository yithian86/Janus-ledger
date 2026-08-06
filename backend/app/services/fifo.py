"""
FIFO cost-basis engine.

Holdings and realized gains are never stored — they're always derived from
the transaction ledger. This module is the single source of truth for that
derivation, kept independent of FastAPI so the logic is portable/testable
(and reusable if this ever gets ported to another backend/language).

Approach:
- For each asset, walk buy/sell transactions in date order.
- Each BUY creates a "lot": quantity + cost per unit (in both native currency
  and base currency, since fees and FX both affect true cost).
- Each SELL consumes the oldest lots first (FIFO), producing a realized gain
  record per sale: proceeds (base) - cost basis of the consumed lots (base).
- Whatever lots remain at the end represent current holdings.
"""
from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import Transaction, TransactionType, Asset
from app.services.fx import convert_to_base


@dataclass
class Lot:
    quantity: float
    cost_per_unit_native: float
    cost_per_unit_base: float
    date: date_type


@dataclass
class RealizedGainEvent:
    asset_id: int
    sell_date: date_type
    quantity: float
    proceeds_base: float
    cost_basis_base: float
    fees_base: float
    realized_gain_base: float

    @property
    def year(self) -> int:
        return self.sell_date.year


@dataclass
class AssetFifoResult:
    remaining_lots: list = field(default_factory=list)
    realized_events: list = field(default_factory=list)


def _asset_transactions(db: Session, asset_id: int):
    stmt = (
        select(Transaction)
        .where(
            Transaction.asset_id == asset_id,
            Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.SELL]),
        )
        .order_by(Transaction.date.asc(), Transaction.id.asc())
    )
    return db.execute(stmt).scalars().all()


def compute_fifo_for_asset(db: Session, asset_id: int) -> AssetFifoResult:
    """Run the FIFO walk for a single asset and return remaining lots + realized events."""
    txns = _asset_transactions(db, asset_id)
    lots: list[Lot] = []
    realized: list[RealizedGainEvent] = []

    for txn in txns:
        if txn.transaction_type == TransactionType.BUY:
            if not txn.quantity or txn.quantity <= 0 or txn.price is None:
                continue  # skip malformed rows rather than crash the whole report
            total_cost_native = txn.quantity * txn.price + (txn.fees or 0.0)
            total_cost_base = convert_to_base(db, total_cost_native, txn.currency, txn.date)
            lots.append(
                Lot(
                    quantity=txn.quantity,
                    cost_per_unit_native=total_cost_native / txn.quantity,
                    cost_per_unit_base=total_cost_base / txn.quantity,
                    date=txn.date,
                )
            )

        elif txn.transaction_type == TransactionType.SELL:
            if not txn.quantity or txn.quantity <= 0 or txn.price is None:
                continue
            sell_qty_remaining = txn.quantity
            cost_basis_base_consumed = 0.0

            while sell_qty_remaining > 1e-9 and lots:
                lot = lots[0]
                take = min(lot.quantity, sell_qty_remaining)
                cost_basis_base_consumed += take * lot.cost_per_unit_base
                lot.quantity -= take
                sell_qty_remaining -= take
                if lot.quantity <= 1e-9:
                    lots.pop(0)

            # If sell_qty_remaining > 0 here, the ledger has a sell exceeding
            # recorded buys (e.g. missing historical transactions). We still
            # report what we can compute rather than failing the whole report.
            gross_proceeds_native = txn.quantity * txn.price
            proceeds_base = convert_to_base(db, gross_proceeds_native, txn.currency, txn.date)
            fees_base = convert_to_base(db, txn.fees or 0.0, txn.currency, txn.date)
            proceeds_base_net = proceeds_base - fees_base

            realized.append(
                RealizedGainEvent(
                    asset_id=asset_id,
                    sell_date=txn.date,
                    quantity=txn.quantity,
                    proceeds_base=proceeds_base_net,
                    cost_basis_base=cost_basis_base_consumed,
                    fees_base=fees_base,
                    realized_gain_base=proceeds_base_net - cost_basis_base_consumed,
                )
            )

    return AssetFifoResult(remaining_lots=lots, realized_events=realized)


def compute_holdings(db: Session, latest_prices: dict[int, float]) -> list[dict]:
    """
    Compute current holdings for every non-archived asset.
    `latest_prices` maps asset_id -> most recent manual price snapshot (native currency).
    """
    assets = db.execute(select(Asset).where(Asset.archived == False)).scalars().all()  # noqa: E712
    holdings = []

    for asset in assets:
        result = compute_fifo_for_asset(db, asset.id)
        quantity = sum(lot.quantity for lot in result.remaining_lots)
        if quantity <= 1e-9:
            continue  # fully sold or never bought — not a current holding

        cost_basis_base = sum(lot.quantity * lot.cost_per_unit_base for lot in result.remaining_lots)
        cost_basis_native = sum(lot.quantity * lot.cost_per_unit_native for lot in result.remaining_lots)
        avg_cost_native = cost_basis_native / quantity

        current_price = latest_prices.get(asset.id)
        market_value_base = None
        unrealized_gain_base = None
        if current_price is not None:
            market_value_base = convert_to_base(db, quantity * current_price, asset.currency, date_type.today())
            unrealized_gain_base = market_value_base - cost_basis_base

        holdings.append({
            "asset_id": asset.id,
            "ticker": asset.ticker,
            "name": asset.name,
            "asset_type": asset.asset_type,
            "currency": asset.currency,
            "quantity": quantity,
            "avg_cost": avg_cost_native,
            "cost_basis_base": cost_basis_base,
            "current_price": current_price,
            "market_value_base": market_value_base,
            "unrealized_gain_base": unrealized_gain_base,
        })

    return holdings


def compute_realized_gains(db: Session, year: Optional[int] = None) -> list[dict]:
    """Compute realized gains for every asset, grouped by asset + year."""
    assets = db.execute(select(Asset)).scalars().all()
    grouped: dict[tuple[int, int], dict] = {}

    for asset in assets:
        result = compute_fifo_for_asset(db, asset.id)
        for event in result.realized_events:
            if year is not None and event.year != year:
                continue
            key = (asset.id, event.year)
            if key not in grouped:
                grouped[key] = {
                    "year": event.year,
                    "asset_id": asset.id,
                    "ticker": asset.ticker,
                    "proceeds_base": 0.0,
                    "cost_basis_base": 0.0,
                    "fees_base": 0.0,
                    "realized_gain_base": 0.0,
                }
            grouped[key]["proceeds_base"] += event.proceeds_base
            grouped[key]["cost_basis_base"] += event.cost_basis_base
            grouped[key]["fees_base"] += event.fees_base
            grouped[key]["realized_gain_base"] += event.realized_gain_base

    return sorted(grouped.values(), key=lambda r: (r["year"], r["ticker"]))
