import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/incomes", tags=["incomes"])


@router.get("", response_model=list[schemas.IncomeOut])
def list_incomes(source: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(models.Income)
    if source:
        stmt = stmt.where(models.Income.source == source)
    stmt = stmt.order_by(models.Income.date.desc(), models.Income.id.desc())
    return db.execute(stmt).scalars().all()


@router.post("", response_model=schemas.IncomeOut, status_code=201)
def create_income(payload: schemas.IncomeCreate, db: Session = Depends(get_db)):
    income = models.Income(**payload.model_dump())
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.post("/batch", response_model=list[schemas.IncomeOut], status_code=201)
def create_income_batch(payload: schemas.IncomeBatchCreate, db: Session = Depends(get_db)):
    """Create one income entry per calendar month, using the start date's day."""
    incomes = []
    month = payload.start_date.month
    year = payload.start_date.year
    day = payload.start_date.day

    while date(year, month, 1) <= payload.end_date:
        income_date = date(year, month, min(day, calendar.monthrange(year, month)[1]))
        if income_date > payload.end_date:
            break
        incomes.append(
            models.Income(
                date=income_date,
                amount=payload.amount,
                currency=payload.currency,
                source=payload.source,
                description=payload.description,
            )
        )
        month += 1
        if month == 13:
            month = 1
            year += 1

    db.add_all(incomes)
    db.commit()
    for income in incomes:
        db.refresh(income)
    return incomes


@router.patch("/{income_id}", response_model=schemas.IncomeOut)
def update_income(income_id: int, payload: schemas.IncomeUpdate, db: Session = Depends(get_db)):
    income = db.get(models.Income, income_id)
    if not income:
        raise HTTPException(404, "Income not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(income, field, value)
    db.commit()
    db.refresh(income)
    return income


@router.delete("/{income_id}", status_code=204)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    income = db.get(models.Income, income_id)
    if not income:
        raise HTTPException(404, "Income not found")
    db.delete(income)
    db.commit()
