import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=list[schemas.ExpenseOut])
def list_expenses(category: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(models.Expense)
    if category:
        stmt = stmt.where(models.Expense.category == category)
    stmt = stmt.order_by(models.Expense.date.desc(), models.Expense.id.desc())
    return db.execute(stmt).scalars().all()


@router.post("", response_model=schemas.ExpenseOut, status_code=201)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    expense = models.Expense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/batch", response_model=list[schemas.ExpenseOut], status_code=201)
def create_expense_batch(payload: schemas.ExpenseBatchCreate, db: Session = Depends(get_db)):
    """Create one expense per calendar month, using the start date's day."""
    expenses = []
    month = payload.start_date.month
    year = payload.start_date.year
    day = payload.start_date.day

    while date(year, month, 1) <= payload.end_date:
        expense_date = date(year, month, min(day, calendar.monthrange(year, month)[1]))
        if expense_date > payload.end_date:
            break
        expenses.append(
            models.Expense(
                date=expense_date,
                amount=payload.amount,
                currency=payload.currency,
                category=payload.category,
                subcategory=payload.subcategory,
                description=payload.description,
            )
        )
        month += 1
        if month == 13:
            month = 1
            year += 1

    db.add_all(expenses)
    db.commit()
    for expense in expenses:
        db.refresh(expense)
    return expenses


@router.patch("/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, payload: schemas.ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.get(models.Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.get(models.Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    db.delete(expense)
    db.commit()
