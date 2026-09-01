"""Yahoo Finance data provider using direct HTTP requests.

This avoids the unstable yfinance Python bindings that can segfault on some
Windows/Python builds while keeping the same external service contract the app
expects.
"""
import json
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import requests

from app.services.market_data.base import BaseMarketDataProvider

logger = logging.getLogger(__name__)


class YahooMarketDataProvider(BaseMarketDataProvider):
    """Market data provider backed by Yahoo Finance's public chart API."""

    _REQUEST_TIMEOUT_SECONDS = 20
    _USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )

    def _get_json(self, url: str) -> Optional[dict]:
        try:
            resp = requests.get(
                url,
                timeout=self._REQUEST_TIMEOUT_SECONDS,
                headers={"User-Agent": self._USER_AGENT, "Accept": "application/json"},
            )
            if resp.status_code == 429:
                logger.warning("Yahoo Finance rate-limited: %s", url)
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.debug("Yahoo request failed for %s: %s", url, exc)
            return None

    def _extract_regular_market_price(self, payload: Optional[dict]) -> Optional[float]:
        if not payload:
            return None
        try:
            result = payload.get("chart", {}).get("result") or []
            if not result:
                return None
            meta = result[0].get("meta") or {}
            value = meta.get("regularMarketPrice")
            if value is not None:
                return float(value)
            value = meta.get("previousClose")
            if value is not None:
                return float(value)
        except Exception:
            return None
        return None

    def _extract_last_close(self, payload: Optional[dict]) -> Optional[float]:
        if not payload:
            return None
        try:
            result = payload.get("chart", {}).get("result") or []
            if not result:
                return None
            quote = (result[0].get("indicators") or {}).get("quote") or []
            if not quote:
                return None
            closes = quote[0].get("close") or []
            for value in reversed(closes):
                if value is not None:
                    return float(value)
        except Exception:
            return None
        return None

    def fetch_current_prices(self, tickers: List[str]) -> Dict[str, Optional[float]]:
        results: Dict[str, Optional[float]] = {}
        valid_tickers = [t.strip() for t in tickers if t and t.strip()]

        for ticker_symbol in valid_tickers:
            url = (
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                f"{ticker_symbol}?range=5d&interval=1d"
            )
            payload = self._get_json(url)
            price = self._extract_regular_market_price(payload)
            if price is None:
                price = self._extract_last_close(payload)
            results[ticker_symbol] = price

        return results

    def fetch_historical_prices(
        self, ticker_dates: List[Tuple[str, date]]
    ) -> Dict[Tuple[str, date], Optional[float]]:
        results: Dict[Tuple[str, date], Optional[float]] = {}

        for ticker_symbol, target_date in ticker_dates:
            start = target_date.isoformat()
            end = (target_date + timedelta(days=5)).isoformat()
            url = (
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                f"{ticker_symbol}?interval=1d&range=5d"
            )
            payload = self._get_json(url)
            price = self._extract_last_close(payload)
            if price is not None:
                results[(ticker_symbol, target_date)] = price
            else:
                results[(ticker_symbol, target_date)] = None

        return results

    def fetch_fx_rates(
        self, currencies: List[str], base_currency: str = "EUR"
    ) -> Dict[str, Optional[float]]:
        results: Dict[str, Optional[float]] = {}

        for curr in currencies:
            curr_clean = curr.strip().upper()
            if curr_clean == base_currency.upper():
                results[curr_clean] = 1.0
                continue

            ticker_symbol = f"{curr_clean}{base_currency.upper()}=X"
            url = (
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                f"{ticker_symbol}?range=5d&interval=1d"
            )
            payload = self._get_json(url)
            price = self._extract_regular_market_price(payload)
            if price is None:
                price = self._extract_last_close(payload)
            results[curr_clean] = price

        return results
