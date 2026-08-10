"""
High-level Market Data Service manager with in-memory TTL caching.

Coordinates fetching prices and FX rates from the configured external provider,
caching results to avoid repetitive API hits, and updating database tables.
"""
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple, Type
from sqlalchemy.orm import Session
from sqlalchemy import select

from app import models
from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.yahoo_provider import YahooMarketDataProvider

# Active provider class can be configured or swapped here
_ACTIVE_PROVIDER_CLASS: Type[BaseMarketDataProvider] = YahooMarketDataProvider

CACHE_TTL_SECONDS = 900  # 15 minutes default cache TTL


def get_market_data_provider() -> BaseMarketDataProvider:
    """Factory function returning an instance of the active market data provider."""
    return _ACTIVE_PROVIDER_CLASS()


class MarketDataService:
    def __init__(
        self,
        provider: Optional[BaseMarketDataProvider] = None,
        ttl_seconds: int = CACHE_TTL_SECONDS,
    ):
        self.provider = provider or get_market_data_provider()
        self.ttl_seconds = ttl_seconds
        # In-memory caches: id/currency -> (value, fetched_at_datetime)
        self._price_cache: Dict[int, Tuple[float, datetime]] = {}
        self._fx_cache: Dict[str, Tuple[float, datetime]] = {}

    def clear_cache(self) -> None:
        """Manually invalidate all cached prices and FX rates."""
        self._price_cache.clear()
        self._fx_cache.clear()

    def sync_fx_rates_to_db(
        self, db: Session, currencies: list[str], force_fetch: bool = False
    ) -> Dict[str, float]:
        """
        Fetch current FX rates for given currencies to EUR base and update database FxRate entries for today.
        Uses in-memory cache unless force_fetch is True or cache is expired.
        """
        now = datetime.now()
        missing_or_expired: List[str] = []

        if not force_fetch:
            for curr in currencies:
                cached = self._fx_cache.get(curr)
                if not cached or (now - cached[1]).total_seconds() > self.ttl_seconds:
                    missing_or_expired.append(curr)
        else:
            missing_or_expired = list(currencies)

        if missing_or_expired:
            fx_rates = self.provider.fetch_fx_rates(missing_or_expired, base_currency="EUR")
            today = date.today()
            for currency, rate in fx_rates.items():
                if rate is None or rate <= 0:
                    continue
                self._fx_cache[currency] = (rate, now)
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

        return {curr: self._fx_cache[curr][0] for curr in currencies if curr in self._fx_cache}

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
        self, db: Session, update_fx: bool = True, force_fetch: bool = False
    ) -> Dict[int, float]:
        """
        Fetch current live prices for all non-archived assets from external provider.
        Uses in-memory TTL cache unless force_fetch is True.
        Returns dict mapping asset_id -> live_price_native.
        """
        assets = db.execute(
            select(models.Asset).where(models.Asset.archived == False)  # noqa: E712
        ).scalars().all()

        if not assets:
            return {}

        now = datetime.now()
        currencies = list({asset.currency for asset in assets if asset.currency})

        if update_fx and currencies:
            self.sync_fx_rates_to_db(db, currencies, force_fetch=force_fetch)

        asset_prices: Dict[int, float] = {}
        assets_to_fetch: List[models.Asset] = []

        for asset in assets:
            if asset.asset_type == models.AssetType.CASH:
                asset_prices[asset.id] = 1.0
                continue

            if not force_fetch:
                cached = self._price_cache.get(asset.id)
                if cached and (now - cached[1]).total_seconds() <= self.ttl_seconds:
                    asset_prices[asset.id] = cached[0]
                    continue

            assets_to_fetch.append(asset)

        for asset in assets_to_fetch:
            candidates = self._generate_candidate_tickers(asset)
            if not candidates:
                continue

            prices_by_ticker = self.provider.fetch_current_prices(candidates)
            for cand in candidates:
                price = prices_by_ticker.get(cand)
                if price is not None:
                    asset_prices[asset.id] = price
                    self._price_cache[asset.id] = (price, now)
                    break

        return asset_prices


# Module instance
market_data_service = MarketDataService()
