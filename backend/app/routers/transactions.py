from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    asset_id: Optional[int] = None,
    transaction_type: Optional[models.TransactionType] = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Transaction)
    if asset_id is not None:
        stmt = stmt.where(models.Transaction.asset_id == asset_id)
    if transaction_type is not None:
        stmt = stmt.where(models.Transaction.transaction_type == transaction_type)
    stmt = stmt.order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    return db.execute(stmt).scalars().all()


@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    if not db.get(models.Asset, payload.asset_id):
        raise HTTPException(404, "Asset not found")
    txn = models.Transaction(**payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.patch("/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction(transaction_id: int, payload: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.get(models.Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    txn = db.get(models.Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    db.delete(txn)
    db.commit()
