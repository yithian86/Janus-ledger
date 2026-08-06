"""
SQLAlchemy ORM models — the full data schema for the portfolio tracker.

Design notes:
- All monetary amounts are stored in the asset's / transaction's native currency.
  Conversion to the base reporting currency (EUR) happens at query/aggregation
  time using the FxRate table, never by mutating stored values. This keeps
  historical data accurate even if you change your base currency later.
- Transactions are the single source of truth. Holdings, cost basis, and
  realized gains are all *derived* from transactions (via services/fifo.py),
  never stored directly, to avoid sync bugs.
"""
import enum
from datetime import date as date_type

from sqlalchemy import (
    Column, Integer, String, Float, Date, Enum, ForeignKey, Boolean, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class AssetType(str, enum.Enum):
    STOCK = "stock"
    ETF = "etf"
    ETC = "etc"
    BOND = "bond"
    CASH = "cash"
    CRYPTO = "crypto"


class TransactionType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"
    COUPON = "coupon"
    DEPOSIT = "deposit"        # cash moved into the portfolio (funding)
    WITHDRAWAL = "withdrawal"  # cash moved out of the portfolio
    FEE = "fee"                # standalone fee not tied to a buy/sell
    STAMP_DUTY = "stamp_duty"  # stamp duty / transfer tax cost


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False)
    currency = Column(String(3), nullable=False)  # ISO 4217, e.g. "USD"
    exchange = Column(String, nullable=True)
    isin = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    archived = Column(Boolean, default=False, nullable=False)

    transactions = relationship(
        "Transaction", back_populates="asset", cascade="all, delete-orphan"
    )
    price_snapshots = relationship(
        "PriceSnapshot", back_populates="asset", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("ticker", "exchange", name="uq_ticker_exchange"),)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    date = Column(Date, nullable=False, index=True)

    # Quantity is nullable for pure cash movements (deposit/withdrawal/fee)
    quantity = Column(Float, nullable=True)
    # Price per unit, in the transaction's currency. Null for dividend/deposit/etc
    # where "amount" is what matters instead.
    price = Column(Float, nullable=True)
    # For dividend/coupon/deposit/withdrawal/fee: the total cash amount.
    # For buy/sell: leave null, amount is derived as quantity * price.
    amount = Column(Float, nullable=True)

    fees = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), nullable=False)  # currency of this transaction
    reinvested = Column(Boolean, default=False, nullable=False)  # for dividends
    notes = Column(Text, nullable=True)

    asset = relationship("Asset", back_populates="transactions")


class PriceSnapshot(Base):
    """Manually entered valuation price for an asset at a point in time."""
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    price = Column(Float, nullable=False)  # in the asset's native currency

    asset = relationship("Asset", back_populates="price_snapshots")

    __table_args__ = (UniqueConstraint("asset_id", "date", name="uq_asset_date_price"),)


class FxRate(Base):
    """
    Manually entered FX rate: 1 unit of `currency` = `rate` units of base currency (EUR).
    e.g. currency="USD", date=2026-01-15, rate=0.92  ->  1 USD = 0.92 EUR
    """
    __tablename__ = "fx_rates"

    id = Column(Integer, primary_key=True, index=True)
    currency = Column(String(3), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    rate_to_base = Column(Float, nullable=False)

    __table_args__ = (UniqueConstraint("currency", "date", name="uq_currency_date_fx"),)
