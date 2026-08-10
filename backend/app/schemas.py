"""
Pydantic schemas — API request/response shapes, decoupled from the ORM models.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models import AssetType, TransactionType


# ---------- Asset ----------

class AssetBase(BaseModel):
    ticker: str
    name: str
    asset_type: AssetType
    currency: str
    exchange: Optional[str] = None
    isin: Optional[str] = None
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    ticker: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[AssetType] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None
    isin: Optional[str] = None
    notes: Optional[str] = None
    archived: Optional[bool] = None


class AssetOut(AssetBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    archived: bool


# ---------- Transaction ----------

class TransactionBase(BaseModel):
    asset_id: Optional[int] = None
    transaction_type: TransactionType
    date: date_type
    quantity: Optional[float] = None
    price: Optional[float] = None
    amount: Optional[float] = None
    fees: float = 0.0
    currency: str
    reinvested: bool = False
    notes: Optional[str] = None

    @field_validator("amount", mode="before")
    def round_amount_input(cls, value):
        if value is None:
            return None
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return value

    @field_validator("amount", mode="after")
    def round_amount_output(cls, value):
        if value is None:
            return None
        return round(value, 2)


class TransactionCreate(TransactionBase):
    @model_validator(mode="after")
    def validate_asset_id(self):
        if self.transaction_type not in (TransactionType.FEE, TransactionType.STAMP_DUTY) and self.asset_id is None:
            raise ValueError(
                "asset_id is required for all transaction types except fee and stamp_duty"
            )
        return self


class TransactionUpdate(BaseModel):
    transaction_type: Optional[TransactionType] = None
    date: Optional[date_type] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    amount: Optional[float] = None
    fees: Optional[float] = None
    currency: Optional[str] = None
    reinvested: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("amount", mode="before")
    def round_amount_input(cls, value):
        if value is None:
            return None
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return value


class TransactionOut(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

    @model_validator(mode="after")
    def derive_amount_for_traded_assets(self):
        if self.amount is None and self.transaction_type in (TransactionType.BUY, TransactionType.SELL):
            if self.quantity is not None and self.price is not None:
                self.amount = round(self.quantity * self.price, 2)
        return self


# ---------- PriceSnapshot ----------

class PriceSnapshotBase(BaseModel):
    asset_id: int
    date: date_type
    price: float


class PriceSnapshotCreate(PriceSnapshotBase):
    pass


class PriceSnapshotOut(PriceSnapshotBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- FxRate ----------

class FxRateBase(BaseModel):
    currency: str
    date: date_type
    rate_to_base: float


class FxRateCreate(FxRateBase):
    pass


class FxRateOut(FxRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Reports ----------

class HoldingOut(BaseModel):
    asset_id: int
    ticker: str
    name: str
    asset_type: AssetType
    currency: str
    quantity: float
    avg_cost: float               # in asset's native currency
    cost_basis_base: float        # total cost basis converted to base currency
    current_price: Optional[float] = None
    market_value_base: Optional[float] = None
    unrealized_gain_base: Optional[float] = None
    unrealized_gain_percentage: Optional[float] = None


class RealizedGainOut(BaseModel):
    year: int
    asset_id: int
    ticker: str
    proceeds_base: float
    cost_basis_base: float
    fees_base: float
    realized_gain_base: float


class CashFlowPeriodOut(BaseModel):
    period: str  # "2026-01" or "2026"
    invested_base: float     # buys
    divested_base: float     # sells (proceeds)
    income_base: float       # dividends + coupons
    fees_base: float
    deposits_base: float
    withdrawals_base: float
    net_flow_base: float


class IncomeByPeriodOut(BaseModel):
    period: str
    asset_id: int
    ticker: str
    income_base: float


# ---------- Market Data Sync ----------

class MarketDataSyncOut(BaseModel):
    prices: dict[int, float]
    fx_rates: dict[str, float]

