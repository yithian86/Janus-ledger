from typing import Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app import models, schemas
from app.services import fifo, aggregation

router = APIRouter(prefix="/reports", tags=["reports"])


def _latest_prices(db: Session) -> dict[int, float]:
    """Get the most recent price snapshot per asset."""
    subq = (
        select(
            models.PriceSnapshot.asset_id,
            func.max(models.PriceSnapshot.date).label("max_date"),
        )
        .group_by(models.PriceSnapshot.asset_id)
        .subquery()
    )
    stmt = select(models.PriceSnapshot).join(
        subq,
        (models.PriceSnapshot.asset_id == subq.c.asset_id)
        & (models.PriceSnapshot.date == subq.c.max_date),
    )
    rows = db.execute(stmt).scalars().all()
    return {r.asset_id: r.price for r in rows}


@router.get("/holdings", response_model=list[schemas.HoldingOut])
def holdings(db: Session = Depends(get_db)):
    latest_prices = _latest_prices(db)
    return fifo.compute_holdings(db, latest_prices)


@router.get("/realized-gains", response_model=list[schemas.RealizedGainOut])
def realized_gains(year: Optional[int] = None, db: Session = Depends(get_db)):
    return fifo.compute_realized_gains(db, year=year)


@router.get("/cash-flow", response_model=list[schemas.CashFlowPeriodOut])
def cash_flow(granularity: Literal["month", "year"] = "month", db: Session = Depends(get_db)):
    return aggregation.compute_cash_flow(db, granularity=granularity)


@router.get("/income", response_model=list[schemas.IncomeByPeriodOut])
def income_by_period(granularity: Literal["month", "year"] = "month", db: Session = Depends(get_db)):
    return aggregation.compute_income_by_period(db, granularity=granularity)
