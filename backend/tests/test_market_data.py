import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import Base, engine
from app.models import Asset, Transaction, TransactionType
from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.service import MarketDataService, market_data_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    session = Session(bind=engine)
    try:
        yield session
    finally:
        session.close()


class DummyMarketDataProvider(BaseMarketDataProvider):
    """Mock provider for unit testing abstraction wrapper."""

    def fetch_current_prices(self, tickers: list[str]) -> dict[str, float | None]:
        return {
            "AAPL": 220.50,
            "MSFT": 415.00,
            "BTC-USD": 60000.0,
        }

    def fetch_historical_prices(self, ticker_dates: list[tuple[str, date]]) -> dict[tuple[str, date], float | None]:
        results = {}
        for ticker, target_date in ticker_dates:
            results[(ticker, target_date)] = 100.0
        return results

    def fetch_fx_rates(self, currencies: list[str], base_currency: str = "EUR") -> dict[str, float | None]:
        return {
            "USD": 0.90,
            "EUR": 1.0,
        }


def test_market_data_service_mock_provider(db_session: Session):
    mock_provider = DummyMarketDataProvider()
    service = MarketDataService(provider=mock_provider)

    prices = mock_provider.fetch_current_prices(["AAPL", "BTC-USD"])
    assert prices["AAPL"] == 220.50
    assert prices["BTC-USD"] == 60000.0

    fx = mock_provider.fetch_fx_rates(["USD", "EUR"])
    assert fx["USD"] == 0.90
    assert fx["EUR"] == 1.0


def test_holdings_default_does_not_refresh_live_market_data(db_session: Session):
    asset = Asset(ticker="AAPL", name="Apple Inc", asset_type="stock", currency="USD")
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    txn = Transaction(
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        date=date(2026, 1, 1),
        quantity=10.0,
        price=150.0,
        amount=None,
        fees=0.0,
        currency="USD",
    )
    db_session.add(txn)
    db_session.commit()

    original = market_data_service.fetch_live_prices_for_assets
    called = {"value": False}

    def boom(*args, **kwargs):
        called["value"] = True
        raise AssertionError("live refresh should not run by default")

    market_data_service.fetch_live_prices_for_assets = boom
    try:
        response = client.get("/reports/holdings")
        assert response.status_code == 200
        assert called["value"] is False
        assert len(response.json()) == 1
    finally:
        market_data_service.fetch_live_prices_for_assets = original


def test_holdings_with_market_data_integration(db_session: Session):
    # Inject dummy provider into market_data_service
    market_data_service.provider = DummyMarketDataProvider()

    asset = Asset(ticker="AAPL", name="Apple Inc", asset_type="stock", currency="USD")
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    txn = Transaction(
        asset_id=asset.id,
        transaction_type=TransactionType.BUY,
        date=date(2026, 1, 1),
        quantity=10.0,
        price=150.0,
        amount=None,
        fees=0.0,
        currency="USD",
    )
    db_session.add(txn)
    db_session.commit()

    response = client.get("/reports/holdings?refresh_market_data=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    holding = data[0]
    assert holding["ticker"] == "AAPL"
    assert holding["current_price"] == 220.50
    # 10 shares * 220.50 USD * 0.90 EUR/USD = 1984.50 EUR
    assert pytest.approx(holding["market_value_base"], 0.01) == 1984.50
    assert pytest.approx(holding["unrealized_gain_percentage"], 0.01) == 47.0
