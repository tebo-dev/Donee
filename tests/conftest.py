"""Isolated test database and mail capture; never use developer secrets/services."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

os.environ.update(
    DATABASE_URL="sqlite://",
    JWT_SECRET_KEY="test-key-for-security-regressions-only",
    AWS_ACCESS_KEY_ID="test",
    AWS_SECRET_ACCESS_KEY="test",
    AWS_S3_BUCKET_NAME="test",
    ENVIRONMENT="test",
)


@pytest.fixture
def db_session():
    """Create and yield sqlite session."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def enable_fk(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture(autouse=True)
def mailbox(monkeypatch):
    """Mailbox for testing."""

    messages = []

    def send(recipient, subject, body):
        messages.append({"recipient": recipient, "subject": subject, "body": body})

    monkeypatch.setattr("app.services.auth.auth_service.send_email", send)
    monkeypatch.setattr("app.services.auth.password_reset_service.send_email", send)
    monkeypatch.setattr(
        "app.services.auth.password_reset_service.gen_random_code", lambda: "123456"
    )
    return messages


@pytest.fixture
def client(db_session):
    """Client for testing."""

    def override_db():
        try:
            yield db_session
        except Exception:
            db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
