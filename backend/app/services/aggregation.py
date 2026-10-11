"""
Aggregation service — cash flow and income rollups by month/year.

Uses pandas for the groupby/pivot logic since it keeps this much shorter
and more maintainable than hand-rolled loops over transactions.
"""
from typing import Literal

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import Transaction, TransactionType, Asset, Income
from app.services.fx import convert_to_base

Granularity = Literal["month", "year"]


def _period_key(d, granularity: Granularity) -> str:
    return d.strftime("%Y-%m") if granularity == "month" else d.strftime("%Y")


def _transactions_dataframe(db: Session) -> pd.DataFrame:
    stmt = select(Transaction).outerjoin(Asset)
    txns = db.execute(stmt).scalars().all()

    rows = []
    for t in txns:
        base_amount = None
        ticker = t.asset.ticker if t.asset else None
        # Determine the "flow" amount in native currency depending on type
        if t.transaction_type == TransactionType.BUY:
            native = -(t.quantity * t.price + (t.fees or 0.0)) if t.quantity and t.price else 0.0
        elif t.transaction_type == TransactionType.SELL:
            native = (t.quantity * t.price - (t.fees or 0.0)) if t.quantity and t.price else 0.0
        elif t.transaction_type in (TransactionType.DIVIDEND, TransactionType.COUPON):
            native = (t.amount or 0.0)
        elif t.transaction_type == TransactionType.DEPOSIT:
            native = (t.amount or 0.0)
        elif t.transaction_type == TransactionType.WITHDRAWAL:
            native = -(t.amount or 0.0)
        elif t.transaction_type in (TransactionType.FEE, TransactionType.STAMP_DUTY):
            native = -(t.amount or t.fees or 0.0)
        else:
            native = 0.0

        base_amount = convert_to_base(db, native, t.currency, t.date)
        fees_base = convert_to_base(db, t.fees or 0.0, t.currency, t.date)

        rows.append({
            "asset_id": t.asset_id,
            "ticker": ticker,
            "date": t.date,
            "type": t.transaction_type.value,
            "amount_base": base_amount,
            "fees_base": fees_base,
        })

    return pd.DataFrame(rows, columns=[
        "asset_id", "ticker", "date", "type", "amount_base", "fees_base",
    ])


def _income_entries_dataframe(db: Session) -> pd.DataFrame:
    incomes = db.execute(select(Income)).scalars().all()
    rows = [
        {
            "asset_id": None,
            "ticker": None,
            "date": income.date,
            "type": "income",
            "amount_base": convert_to_base(db, income.amount, income.currency, income.date),
            "fees_base": 0.0,
            "source": income.source,
        }
        for income in incomes
    ]
    return pd.DataFrame(rows, columns=[
        "asset_id", "ticker", "date", "type", "amount_base", "fees_base", "source",
    ])


def compute_cash_flow(db: Session, granularity: Granularity = "month") -> list[dict]:
    """Cash flow broken down by period: invested, divested, income, fees, deposits, withdrawals."""
    df = pd.concat(
        [_transactions_dataframe(db), _income_entries_dataframe(db)],
        ignore_index=True,
    )
    if df.empty:
        return []

    df.loc[:, "period"] = df["date"].apply(lambda d: _period_key(d, granularity))

    def summarize(group: pd.DataFrame) -> pd.Series:
        invested = -group.loc[group["type"] == "buy", "amount_base"].sum()
        divested = group.loc[group["type"] == "sell", "amount_base"].sum()
        income = group.loc[group["type"].isin(["dividend", "coupon", "income"]), "amount_base"].sum()
        deposits = group.loc[group["type"] == "deposit", "amount_base"].sum()
        withdrawals = -group.loc[group["type"] == "withdrawal", "amount_base"].sum()
        fees = group["fees_base"].sum() + (-group.loc[group["type"].isin(["fee", "stamp_duty"]), "amount_base"].sum())
        net_flow = group["amount_base"].sum()
        return pd.Series({
            "invested_base": invested,
            "divested_base": divested,
            "income_base": income,
            "fees_base": fees,
            "deposits_base": deposits,
            "withdrawals_base": withdrawals,
            "net_flow_base": net_flow,
        })

    result = df.groupby("period").apply(summarize).reset_index()
    result = result.sort_values("period")
    return result.to_dict(orient="records")


def compute_income_by_period(db: Session, granularity: Granularity = "month") -> list[dict]:
    """Income ledger entries and dividend/coupon income broken down by period."""
    stmt = (
        select(Transaction)
        .outerjoin(Asset)
        .where(Transaction.transaction_type.in_((TransactionType.DIVIDEND, TransactionType.COUPON)))
    )
    transactions = db.execute(stmt).scalars().all()
    incomes = db.execute(select(Income)).scalars().all()

    totals: dict[tuple[str, str, int | None, str | None, str | None], float] = {}
    for transaction in transactions:
        income_type = transaction.transaction_type.value
        period = _period_key(transaction.date, granularity)
        ticker = transaction.asset.ticker if transaction.asset else None
        key = (period, income_type, transaction.asset_id, ticker, None)
        amount_base = convert_to_base(
            db, transaction.amount or 0.0, transaction.currency, transaction.date
        )
        totals[key] = totals.get(key, 0.0) + amount_base

    for income in incomes:
        period = _period_key(income.date, granularity)
        key = (period, "income", None, None, income.source)
        amount_base = convert_to_base(db, income.amount, income.currency, income.date)
        totals[key] = totals.get(key, 0.0) + amount_base

    return [
        {
            "period": period,
            "income_type": income_type,
            "asset_id": asset_id,
            "ticker": ticker,
            "source": source,
            "income_base": amount,
        }
        for (period, income_type, asset_id, ticker, source), amount in sorted(
            totals.items(),
            key=lambda item: (
                item[0][0],
                item[0][1],
                item[0][4] or "",
                item[0][3] or "",
            ),
        )
    ]
