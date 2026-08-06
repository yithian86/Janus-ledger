"""
Currency conversion helpers.

Since FX rates are entered manually and won't exist for every single day,
conversion uses the most recent rate on or before the target date (a
standard "as of" convention for manual/sparse rate data).
"""
from datetime import date as date_type
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import FxRate

BASE_CURRENCY = "EUR"


def get_rate_to_base(db: Session, currency: str, on_date: date_type) -> float:
    """
    Return the conversion rate for `currency` -> BASE_CURRENCY as of `on_date`.
    Uses the most recent FxRate entry on or before on_date.
    Returns 1.0 if currency is already the base currency.
    Raises ValueError if no rate is available at all for that currency.
    """
    if currency == BASE_CURRENCY:
        return 1.0

    stmt = (
        select(FxRate)
        .where(FxRate.currency == currency, FxRate.date <= on_date)
        .order_by(FxRate.date.desc())
        .limit(1)
    )
    rate_row = db.execute(stmt).scalar_one_or_none()

    if rate_row is None:
        # Fall back to the earliest available rate after the date, so a single
        # missing early entry doesn't hard-fail the whole report.
        stmt_fallback = (
            select(FxRate)
            .where(FxRate.currency == currency)
            .order_by(FxRate.date.asc())
            .limit(1)
        )
        rate_row = db.execute(stmt_fallback).scalar_one_or_none()

    if rate_row is None:
        raise ValueError(
            f"No FX rate found for currency '{currency}'. "
            f"Please add at least one FX rate entry for it."
        )

    return rate_row.rate_to_base


def convert_to_base(db: Session, amount: float, currency: str, on_date: date_type) -> float:
    """Convert `amount` in `currency` to the base currency as of `on_date`."""
    return amount * get_rate_to_base(db, currency, on_date)
