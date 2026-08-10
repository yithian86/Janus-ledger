"""
High-level Market Data Service manager.

Coordinates fetching prices and FX rates from the configured external provider
and integrating them with the backend database and report services.
"""
from datetime import date
from typing import Dict, List, Optional, Type
from sqlalchemy.orm import Session
from sqlalchemy import select

from app import models
from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.yahoo_provider import YahooMarketDataProvider

# Active provider class can be configured or swapped here
_ACTIVE_PROVIDER_CLASS: Type[BaseMarketDataProvider] = YahooMarketDataProvider


def get_market_data_provider() -> BaseMarketDataProvider:
    """Factory function returning an instance of the active market data provider."""
    return _ACTIVE_PROVIDER_CLASS()


class MarketDataService:
    def __init__(self, provider: Optional[BaseMarketDataProvider] = None):
        self.provider = provider or get_market_data_provider()

    def sync_fx_rates_to_db(self, db: Session, currencies: list[str]) -> Dict[str, float]:
        """
        Fetch current FX rates for given currencies to EUR base and update database FxRate entries for today.
        """
        fx_rates = self.provider.fetch_fx_rates(currencies, base_currency="EUR")
        today = date.today()
        saved_rates: Dict[str, float] = {}

        for currency, rate in fx_rates.items():
            if rate is None or rate <= 0:
                continue

            saved_rates[currency] = rate

            # Upsert into FxRate for today's date
            existing = db.execute(
                select(models.FxRate).where(
                    models.FxRate.currency == currency,
                    models.FxRate.date == today,
                )
            ).scalar_one_or_none()

            if existing:
                existing.rate_to_base = rate
            else:
                db.add(models.FxRate(currency=currency, date=today, rate_to_base=rate))

        db.commit()
        return saved_rates

    def _generate_candidate_tickers(self, asset: models.Asset) -> List[str]:
        ticker = (asset.ticker or "").strip()
        if not ticker:
            return []

        # If ticker explicitly specifies exchange suffix or pair (e.g. VWCE.DE, BTC-USD)
        if "." in ticker or "-" in ticker:
            return [ticker]

        candidates: List[str] = []
        if asset.exchange:
            ex = asset.exchange.strip().upper()
            if ex in ("XETRA", "GER", "DE", "FRA", "FRANKFURT"):
                candidates.append(f"{ticker}.DE")
            elif ex in ("MILAN", "MI", "BIT"):
                candidates.append(f"{ticker}.MI")
            elif ex in ("PARIS", "PA"):
                candidates.append(f"{ticker}.PA")
            elif ex in ("LONDON", "L", "LSE"):
                candidates.append(f"{ticker}.L")
            elif ex in ("AMSTERDAM", "AS"):
                candidates.append(f"{ticker}.AS")

        if ticker not in candidates:
            candidates.append(ticker)

        # Common fallback for European assets denominated in EUR (Xetra .DE is primary)
        if asset.currency == "EUR" and f"{ticker}.DE" not in candidates:
            candidates.append(f"{ticker}.DE")

        return candidates

    def fetch_live_prices_for_assets(
        self, db: Session, update_fx: bool = True
    ) -> Dict[int, float]:
        """
        Fetch current live prices for all non-archived assets from external provider.
        Optionally updates current FX rates in the database.
        Returns dict mapping asset_id -> live_price_native.
        """
        assets = db.execute(
            select(models.Asset).where(models.Asset.archived == False)  # noqa: E712
        ).scalars().all()

        if not assets:
            return {}

        currencies = list({asset.currency for asset in assets if asset.currency})

        if update_fx and currencies:
            self.sync_fx_rates_to_db(db, currencies)

        asset_prices: Dict[int, float] = {}

        for asset in assets:
            if asset.asset_type == models.AssetType.CASH:
                asset_prices[asset.id] = 1.0
                continue

            candidates = self._generate_candidate_tickers(asset)
            if not candidates:
                continue

            prices_by_ticker = self.provider.fetch_current_prices(candidates)
            for cand in candidates:
                price = prices_by_ticker.get(cand)
                if price is not None:
                    asset_prices[asset.id] = price
                    break

        return asset_prices


# Module instance
market_data_service = MarketDataService()
