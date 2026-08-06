from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[schemas.AssetOut])
def list_assets(include_archived: bool = False, db: Session = Depends(get_db)):
    stmt = select(models.Asset)
    if not include_archived:
        stmt = stmt.where(models.Asset.archived == False)  # noqa: E712
    return db.execute(stmt).scalars().all()


@router.post("", response_model=schemas.AssetOut, status_code=201)
def create_asset(payload: schemas.AssetCreate, db: Session = Depends(get_db)):
    asset = models.Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    return asset


@router.patch("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(asset_id: int, payload: schemas.AssetUpdate, db: Session = Depends(get_db)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.commit()
