from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app import models, schemas

router = APIRouter(tags=["prices"])


# ---------- Price snapshots ----------

@router.get("/prices", response_model=list[schemas.PriceSnapshotOut])
def list_prices(asset_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(models.PriceSnapshot)
    if asset_id is not None:
        stmt = stmt.where(models.PriceSnapshot.asset_id == asset_id)
    stmt = stmt.order_by(models.PriceSnapshot.date.desc())
    return db.execute(stmt).scalars().all()


@router.post("/prices", response_model=schemas.PriceSnapshotOut, status_code=201)
def create_price(payload: schemas.PriceSnapshotCreate, db: Session = Depends(get_db)):
    if not db.get(models.Asset, payload.asset_id):
        raise HTTPException(404, "Asset not found")
    # Upsert on (asset_id, date) since only one price per asset per day makes sense
    existing = db.execute(
        select(models.PriceSnapshot).where(
            models.PriceSnapshot.asset_id == payload.asset_id,
            models.PriceSnapshot.date == payload.date,
        )
    ).scalar_one_or_none()
    if existing:
        existing.price = payload.price
        db.commit()
        db.refresh(existing)
        return existing

    price = models.PriceSnapshot(**payload.model_dump())
    db.add(price)
    db.commit()
    db.refresh(price)
    return price


@router.delete("/prices/{price_id}", status_code=204)
def delete_price(price_id: int, db: Session = Depends(get_db)):
    price = db.get(models.PriceSnapshot, price_id)
    if not price:
        raise HTTPException(404, "Price snapshot not found")
    db.delete(price)
    db.commit()


# ---------- FX rates ----------

@router.get("/fx-rates", response_model=list[schemas.FxRateOut])
def list_fx_rates(currency: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.FxRate)
    if currency is not None:
        stmt = stmt.where(models.FxRate.currency == currency)
    stmt = stmt.order_by(models.FxRate.date.desc())
    return db.execute(stmt).scalars().all()


@router.post("/fx-rates", response_model=schemas.FxRateOut, status_code=201)
def create_fx_rate(payload: schemas.FxRateCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(models.FxRate).where(
            models.FxRate.currency == payload.currency,
            models.FxRate.date == payload.date,
        )
    ).scalar_one_or_none()
    if existing:
        existing.rate_to_base = payload.rate_to_base
        db.commit()
        db.refresh(existing)
        return existing

    rate = models.FxRate(**payload.model_dump())
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/fx-rates/{rate_id}", status_code=204)
def delete_fx_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.get(models.FxRate, rate_id)
    if not rate:
        raise HTTPException(404, "FX rate not found")
    db.delete(rate)
    db.commit()
