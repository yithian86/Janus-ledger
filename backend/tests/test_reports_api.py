from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Asset, AssetType, FxRate, Income, Transaction, TransactionType

client = TestClient(app)
test_engine = None
TestSessionLocal = None


def setup_function():
    global test_engine, TestSessionLocal
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db():
        with TestSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db


def teardown_function():
    app.dependency_overrides.clear()
    test_engine.dispose()


def test_income_report_includes_ledger_and_investment_income():
    db = TestSessionLocal()
    try:
        asset = Asset(
            ticker="ACME",
            name="Acme Corp",
            asset_type=AssetType.STOCK,
            currency="EUR",
        )
        db.add(asset)
        db.flush()
        db.add_all([
            Income(
                date=date(2026, 1, 15),
                amount=1200,
                currency="EUR",
                source="Salary",
            ),
            Income(
                date=date(2026, 1, 20),
                amount=300,
                currency="USD",
                source="Freelance",
            ),
            FxRate(currency="USD", date=date(2026, 1, 1), rate_to_base=0.9),
            Transaction(
                asset_id=asset.id,
                transaction_type=TransactionType.DIVIDEND,
                date=date(2026, 1, 25),
                amount=10,
                currency="EUR",
            ),
        ])
        db.commit()
    finally:
        db.close()

    report = client.get("/reports/income", params={"granularity": "month"})
    assert report.status_code == 200
    rows = report.json()
    assert {(row["income_type"], row["source"], row["ticker"], row["income_base"]) for row in rows} == {
        ("income", "Salary", None, 1200),
        ("income", "Freelance", None, 270),
        ("dividend", None, "ACME", 10),
    }

    cash_flow = client.get("/reports/cash-flow", params={"granularity": "month"})
    assert cash_flow.status_code == 200
    assert cash_flow.json() == [{
        "period": "2026-01",
        "invested_base": 0,
        "divested_base": 0,
        "income_base": 1480,
        "fees_base": 0,
        "deposits_base": 0,
        "withdrawals_base": 0,
        "net_flow_base": 1480,
    }]
