"""
Yahoo Finance market data provider implementation using `yfinance`.
"""
import io
import logging
import sys
from contextlib import contextmanager
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
import yfinance as yf

from app.services.market_data.base import BaseMarketDataProvider

logger = logging.getLogger(__name__)

# Suppress internal yfinance loggers to avoid stdout/stderr noise
for logger_name in ("yfinance", "peewee", "urllib3"):
    logging.getLogger(logger_name).setLevel(logging.CRITICAL)


@contextmanager
def quiet_yfinance_call():
    """Context manager to suppress stdout and stderr during yfinance operations."""
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = io.StringIO(), io.StringIO()
    try:
        yield
    finally:
        sys.stdout, sys.stderr = old_stdout, old_stderr


class YahooMarketDataProvider(BaseMarketDataProvider):
    """Cost-free market data provider leveraging Yahoo Finance."""

    def fetch_current_prices(self, tickers: List[str]) -> Dict[str, Optional[float]]:
        results: Dict[str, Optional[float]] = {}
        valid_tickers = [t.strip() for t in tickers if t and t.strip()]

        if not valid_tickers:
            return results

        for ticker_symbol in valid_tickers:
            price = None
            try:
                with quiet_yfinance_call():
                    ticker = yf.Ticker(ticker_symbol)

                    # Try fast_info first
                    if hasattr(ticker, "fast_info"):
                        try:
                            fast = ticker.fast_info
                            price = fast.get("lastPrice") or fast.get("previousClose")
                        except Exception:
                            price = None

                    # Fallback to history if fast_info didn't yield a valid number
                    if price is None or (isinstance(price, float) and price != price):
                        hist = ticker.history(period="5d")
                        if not hist.empty and "Close" in hist:
                            val = float(hist["Close"].iloc[-1])
                            if val == val:
                                price = val

                if price is not None and not (isinstance(price, float) and price != price):
                    results[ticker_symbol] = float(price)
                else:
                    results[ticker_symbol] = None
            except Exception as e:
                logger.debug(f"Could not retrieve price for {ticker_symbol}: {e}")
                results[ticker_symbol] = None

        return results

    def fetch_historical_prices(
        self, ticker_dates: List[Tuple[str, date]]
    ) -> Dict[Tuple[str, date], Optional[float]]:
        results: Dict[Tuple[str, date], Optional[float]] = {}

        for ticker_symbol, target_date in ticker_dates:
            try:
                with quiet_yfinance_call():
                    ticker = yf.Ticker(ticker_symbol)
                    start_str = target_date.isoformat()
                    end_date = target_date + timedelta(days=5)
                    end_str = end_date.isoformat()

                    hist = ticker.history(start=start_str, end=end_str)
                    if not hist.empty and "Close" in hist:
                        val = float(hist["Close"].iloc[0])
                        if val == val:
                            results[(ticker_symbol, target_date)] = val
                        else:
                            results[(ticker_symbol, target_date)] = None
                    else:
                        results[(ticker_symbol, target_date)] = None
            except Exception as e:
                logger.debug(f"Error fetching historical price for {ticker_symbol} on {target_date}: {e}")
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

            fx_ticker_symbol = f"{curr_clean}{base_currency.upper()}=X"
            rate = None
            try:
                with quiet_yfinance_call():
                    ticker = yf.Ticker(fx_ticker_symbol)

                    if hasattr(ticker, "fast_info"):
                        try:
                            fast = ticker.fast_info
                            rate = fast.get("lastPrice") or fast.get("previousClose")
                        except Exception:
                            rate = None

                    if rate is None or (isinstance(rate, float) and rate != rate):
                        hist = ticker.history(period="5d")
                        if not hist.empty and "Close" in hist:
                            val = float(hist["Close"].iloc[-1])
                            if val == val:
                                rate = val

                if rate is not None and not (isinstance(rate, float) and rate != rate):
                    results[curr_clean] = float(rate)
                else:
                    results[curr_clean] = None
            except Exception as e:
                logger.debug(f"Error fetching FX rate for {fx_ticker_symbol}: {e}")
                results[curr_clean] = None

        return results
