"""CORS configuration parsing and browser preflight regression tests."""

import json

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.main import app


def load_settings():
    return Settings(
        _env_file=None,
        DATABASE_URL="sqlite://",
        JWT_SECRET_KEY="test-only",
        AWS_ACCESS_KEY_ID="test",
        AWS_SECRET_ACCESS_KEY="test",
        AWS_S3_BUCKET_NAME="test",
    )


def test_origins_are_loaded_from_environment(monkeypatch):
    origins = ["https://frontend.example.com", "http://localhost:5173"]
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", json.dumps(origins))
    assert load_settings().CORS_ALLOWED_ORIGINS == origins
    configured = next(
        item for item in app.user_middleware if item.cls is CORSMiddleware
    )
    assert configured.kwargs["allow_origins"] == settings.CORS_ALLOWED_ORIGINS


def test_origins_default_to_empty(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert load_settings().CORS_ALLOWED_ORIGINS == []


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "null",
        "https://*.example.com",
        "https://example.com/",
        "https://example.com/path",
        "https://example.com?query=1",
        "https://example.com#fragment",
        "https://user:pass@example.com",
        "example.com",
        "ftp://example.com",
        "https://example.com:99999",
    ],
)
def test_invalid_origins_are_rejected(monkeypatch, origin):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", json.dumps([origin]))
    with pytest.raises(ValidationError):
        load_settings()


@pytest.fixture
def cors_client():
    configured = next(
        item for item in app.user_middleware if item.cls is CORSMiddleware
    )
    test_app = FastAPI()
    test_app.add_middleware(
        configured.cls,
        **{**configured.kwargs, "allow_origins": ["https://frontend.example.com"]},
    )

    @test_app.get("/probe")
    def probe():
        return {"ok": True}

    with TestClient(test_app) as client:
        yield client


def test_allowed_preflight_supports_bearer_json_requests(cors_client):
    response = cors_client.options(
        "/probe",
        headers={
            "Origin": "https://frontend.example.com",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "https://frontend.example.com"
    )
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize(
    "origin",
    ["https://unlisted.example.com", "https://frontend.example.com.attacker.test"],
)
def test_unlisted_origins_are_rejected(cors_client, origin):
    response = cors_client.options(
        "/probe",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    response = cors_client.get("/probe", headers={"Origin": origin})
    assert "access-control-allow-origin" not in response.headers


def test_unapproved_methods_and_headers_are_rejected(cors_client):
    for method, header in [("PUT", "Content-Type"), ("GET", "X-Unapproved")]:
        response = cors_client.options(
            "/probe",
            headers={
                "Origin": "https://frontend.example.com",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": header,
            },
        )
        assert response.status_code == 400


def test_non_cors_requests_still_work(cors_client):
    assert cors_client.get("/probe").status_code == 200
