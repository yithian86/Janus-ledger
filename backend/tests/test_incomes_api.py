from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app

client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_function():
    Base.metadata.drop_all(bind=engine)


def test_income_create_list_update_and_delete():
    response = client.post("/incomes", json={
        "date": "2026-01-31",
        "amount": 1250.456,
        "source": "  Salary  ",
        "description": "January pay",
    })
    assert response.status_code == 201
    created = response.json()
    assert created["amount"] == 1250.46
    assert created["source"] == "Salary"
    assert created["currency"] == "EUR"

    listing = client.get("/incomes")
    assert listing.status_code == 200
    assert listing.json()[0]["id"] == created["id"]

    updated = client.patch(f"/incomes/{created['id']}", json={"source": "T-shirt shop"})
    assert updated.status_code == 200
    assert updated.json()["source"] == "T-shirt shop"

    deleted = client.delete(f"/incomes/{created['id']}")
    assert deleted.status_code == 204
    assert client.get("/incomes").json() == []


def test_income_monthly_series_clamps_to_month_end():
    response = client.post("/incomes/batch", json={
        "start_date": "2026-01-31",
        "end_date": "2026-03-31",
        "amount": 3200,
        "source": "Salary",
    })
    assert response.status_code == 201
    assert [income["date"] for income in response.json()] == [
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
    ]


def test_income_rejects_non_positive_amount_and_empty_source():
    payload = {
        "date": "2026-01-01",
        "amount": 0,
        "source": "Online shop",
    }
    assert client.post("/incomes", json=payload).status_code == 422
    payload["amount"] = 10
    payload["source"] = "  "
    assert client.post("/incomes", json=payload).status_code == 422
