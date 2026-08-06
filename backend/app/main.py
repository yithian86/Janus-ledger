from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import assets, transactions, prices, reports

# Creates portfolio.db and all tables on first run if they don't exist yet.
# For schema changes later, consider adding Alembic migrations rather than
# relying on this (it won't alter existing tables).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Tracker API", version="0.1.0")

# Local Angular dev server origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)
app.include_router(transactions.router)
app.include_router(prices.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
