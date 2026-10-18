import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)

    def isolated_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = isolated_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_new_expense_categories_are_supported_by_create_batch_and_update(client):
    learning = client.post("/expenses", json={
        "date": "2026-01-15",
        "amount": 45,
        "category": "education",
    })
    assert learning.status_code == 201
    assert learning.json()["category"] == "education"

    donation = client.patch(
        f"/expenses/{learning.json()['id']}",
        json={"category": "donations"},
    )
    assert donation.status_code == 200
    assert donation.json()["category"] == "donations"

    monthly_learning = client.post("/expenses/batch", json={
        "start_date": "2026-02-01",
        "end_date": "2026-03-01",
        "amount": 20,
        "category": "education",
    })
    assert monthly_learning.status_code == 201
    assert [expense["category"] for expense in monthly_learning.json()] == [
        "education",
        "education",
    ]
