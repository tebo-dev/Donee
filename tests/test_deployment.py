"""Exercise deployment health and the full PostgreSQL migration entry point."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_health_needs_no_authentication_or_database():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "/health" not in app.openapi()["paths"]


@pytest.mark.parametrize("use_direct_url", [False, True])
def test_full_postgresql_migration_with_encoded_credentials(use_direct_url):
    """Compile all revisions without contacting a database."""
    url = (
        "postgresql://migration:p%40ss%25word@db.invalid/donee"
        "?sslmode=require&channel_binding=require"
    )
    env = {
        **os.environ,
        "DATABASE_URL": "invalid-runtime-url" if use_direct_url else url,
        "DATABASE_URL_UNPOOLED": url if use_direct_url else "",
        "JWT_SECRET_KEY": "deployment-test-only",
        "AWS_ACCESS_KEY_ID": "test",
        "AWS_SECRET_ACCESS_KEY": "test",
        "AWS_S3_BUCKET_NAME": "test",
        "ENVIRONMENT": "test",
        "CORS_ALLOWED_ORIGINS": "[]",
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert "CREATE TABLE users" in result.stdout
    assert "CREATE TABLE auth_sessions" in result.stdout
    assert "CREATE TABLE policy_acceptances" in result.stdout
    assert "63a9c72d8e10" in result.stdout
