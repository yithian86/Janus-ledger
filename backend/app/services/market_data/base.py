"""
Abstract Base Class for Market Data Providers.

Allows swapping external market data providers (e.g. Yahoo Finance, CoinGecko, AlphaVantage)
behind a clean internal API interface.
"""
from abc import ABC, abstractmethod
from datetime import date
from typing import Dict, List, Optional, Tuple


class BaseMarketDataProvider(ABC):
    """Abstract interface for external financial market data providers."""

    @abstractmethod
    def fetch_current_prices(self, tickers: List[str]) -> Dict[str, Optional[float]]:
        """
        Fetch current market prices for a list of asset tickers.
        Returns dict mapping ticker -> price in native currency.
        """
        pass

    @abstractmethod
    def fetch_historical_prices(
        self, ticker_dates: List[Tuple[str, date]]
    ) -> Dict[Tuple[str, date], Optional[float]]:
        """
        Fetch historical prices for specific (ticker, date) pairs.
        Returns dict mapping (ticker, date) -> price in native currency.
        """
        pass

    @abstractmethod
    def fetch_fx_rates(
        self, currencies: List[str], base_currency: str = "EUR"
    ) -> Dict[str, Optional[float]]:
        """
        Fetch current exchange rates: 1 unit of currency = rate_to_base units of base_currency.
        Returns dict mapping currency (e.g. 'USD') -> rate_to_base (e.g. 0.92).
        """
        pass
