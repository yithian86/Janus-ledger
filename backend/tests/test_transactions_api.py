from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, get_db
from app.models import Asset, Transaction, TransactionType
from sqlalchemy.orm import Session

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

@pytest.mark.parametrize("transaction_type,quantity,price,expected_amount", [
    (TransactionType.BUY, 10.0, 5.0, 50.0),
    (TransactionType.SELL, 12.5, 4.0, 50.0),
])
def test_transaction_list_returns_derived_amount(transaction_type, quantity, price, expected_amount, db_session: Session):
    asset = Asset(ticker="TEST", name="Test Asset", asset_type="stock", currency="USD")
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    txn = Transaction(
        asset_id=asset.id,
        transaction_type=transaction_type,
        date=date(2026, 1, 1),
        quantity=quantity,
        price=price,
        amount=None,
        fees=0.0,
        currency="USD",
    )
    db_session.add(txn)
    db_session.commit()
    db_session.refresh(txn)

    response = client.get("/transactions")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["amount"] == expected_amount
