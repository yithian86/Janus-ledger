"""
Database engine and session configuration.

Uses SQLite for a local, single-user, file-based database.
The DB file will be created at backend/portfolio.db on first run.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./portfolio.db"

# check_same_thread=False is required for SQLite when used with FastAPI's
# threaded request handling. Safe here since this is a local single-user app.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and ensures it's closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
