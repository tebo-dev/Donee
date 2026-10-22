"""Regression coverage for security controls using isolated data and fake mail/S3."""

import base64
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import UUID, uuid4

import boto3
import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.config import settings
from app.core.domain_errors.auth_domain_errors import InvalidCode
from app.core.jwt_handler import create_access_token
from app.core.rate_limit import enforce_auth_limit
from app.core.s3_client import build_attachment_storage_key, create_presigned_upload_url
from app.core.security import hash_password, hash_reset_code
from app.db.base import Base
from app.models import (
    Attachment,
    PasswordResetToken,
    Tag,
    Task,
    TaskTag,
    User,
    WorkspaceMember,
)
from app.schemas.auth.password_reset import ResetPasswordRequest, VerifyResetCodeRequest
from app.services.auth.email_service import send_email
from app.services.auth.password_reset_service import (
    reset_password_service,
    verify_reset_code_service,
)
from tests.utils import login_user, register_user


def account(client, name="alice"):
    """Create a logged-in account and return its workspace context."""

    email = f"{name}@example.com"
    result = register_user(client, email=email, username=name)
    assert result.status_code == 201, result.text
    token = login_user(client, email=email).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    workspace = client.get("/workspaces", headers=headers).json()["workspaces"][0]
    return result.json(), headers, workspace


def task(client, headers, workspace):
    """Create a task in the given workspace."""

    result = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Test task",
            "description": "safe",
            "priority": "high",
            "due_at": "2026-12-01",
            "workspace_id": workspace["id"],
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


def tag(client, headers, workspace, name="Private tag"):
    """Create a tag in the given workspace."""

    result = client.post(
        "/tags",
        headers=headers,
        json={"name": name, "color": "#123456", "workspace_id": workspace["id"]},
    )
    assert result.status_code == 201, result.text
    return result.json()


@pytest.mark.parametrize("environment", ["development", "test", "production"])
def test_recovery_never_exposes_secret(client, mailbox, monkeypatch, environment):
    """Ensure password recovery responses never reveal the reset code."""

    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    register_user(client)
    existing = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    missing = client.post("/auth/forgot-password", json={"email": "missing@donee.com"})
    assert existing.status_code == missing.status_code == 200
    assert existing.json() == missing.json()
    assert "123456" not in existing.text and "debug_code" not in existing.text
    assert "123456" in mailbox[-1]["body"]


def test_reset_revokes_old_jwt_and_consumes_code(client):
    """Ensure a successful reset invalidates old tokens and consumes the code."""

    _, headers, _ = account(client)
    client.post("/auth/forgot-password", json={"email": "alice@example.com"})
    payload = {
        "email": "alice@example.com",
        "code": "123456",
        "new_password": "new-password-123",
    }
    result = client.post("/auth/reset-password", json=payload)
    assert result.status_code == 200
    assert client.get("/auth/me", headers=headers).status_code == 401
    fresh = {"Authorization": "Bearer " + result.json()["access_token"]}
    assert client.get("/auth/me", headers=fresh).status_code == 200
    assert client.post("/auth/reset-password", json=payload).status_code == 400


def test_three_guesses_shared_between_verify_and_reset(client, db_session):
    """Ensure verification and reset share the failed-attempt limit."""

    register_user(client)
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    for endpoint in ["verify-reset-code", "reset-password", "verify-reset-code"]:
        payload = {"email": "test@donee.com", "code": "000000"}
        if endpoint == "reset-password":
            payload["new_password"] = "new-password-123"
        assert client.post(f"/auth/{endpoint}", json=payload).status_code == 400
    result = client.post(
        "/auth/reset-password",
        json={
            "email": "test@donee.com",
            "code": "123456",
            "new_password": "new-password-123",
        },
    )
    assert result.status_code == 400
    assert db_session.scalar(select(PasswordResetToken)).failed_attempts == 3
    # The challenge remains blocked independently of the HTTP window.
    with pytest.raises(InvalidCode):
        verify_reset_code_service(
            db_session,
            VerifyResetCodeRequest(email="test@donee.com", code="123456"),
        )


def test_correct_third_guess_succeeds(client):
    """Allow a correct reset code on the final permitted guess."""

    register_user(client)
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    for _ in range(2):
        response = client.post(
            "/auth/verify-reset-code",
            json={"email": "test@donee.com", "code": "000000"},
        )
        assert response.status_code == 400
    response = client.post(
        "/auth/reset-password",
        json={
            "email": "test@donee.com",
            "code": "123456",
            "new_password": "new-password-123",
        },
    )
    assert response.status_code == 200


def test_expired_and_superseded_codes_fail(client, db_session, monkeypatch):
    """Reject expired reset codes and codes superseded by a newer request."""

    register_user(client)
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    monkeypatch.setattr(
        "app.services.auth.password_reset_service.gen_random_code",
        lambda: "654321",
    )
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert db_session.scalar(select(func.count()).select_from(PasswordResetToken)) == 1
    response = client.post(
        "/auth/verify-reset-code",
        json={"email": "test@donee.com", "code": "123456"},
    )
    assert response.status_code == 400
    token = db_session.scalar(select(PasswordResetToken))
    token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    response = client.post(
        "/auth/verify-reset-code",
        json={"email": "test@donee.com", "code": "654321"},
    )
    assert response.status_code == 400


def test_login_rate_limit_and_recovery_separation(client):
    """Rate-limit login attempts without blocking password recovery."""

    register_user(client)
    for _ in range(3):
        assert login_user(client, password="wrong-password").status_code == 401
    assert login_user(client).status_code == 429
    response = client.post(
        "/auth/forgot-password",
        json={"email": "test@donee.com"},
    )
    assert response.status_code == 200


def test_rate_limit_is_atomic_across_sessions(tmp_path):
    """Verify concurrent login attempts share an atomic rate limit."""

    engine = create_engine(
        f"sqlite:///{tmp_path / 'limits.db'}",
        connect_args={"timeout": 30},
    )
    Base.metadata.create_all(engine)

    def attempt(_):
        """Apply one rate-limited login attempt in an isolated session."""
        with Session(engine) as db:
            request = Request({"type": "http", "client": ("127.0.0.1", 1234)})
            try:
                enforce_auth_limit(db, request, "login", "alice@example.com")
                return 200
            except HTTPException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))
    engine.dispose()
    assert results.count(200) == 3
    assert results.count(429) == 5


def test_concurrent_reset_consumes_challenge_once(tmp_path):
    """Ensure only one concurrent reset can consume a challenge."""

    engine = create_engine(
        f"sqlite:///{tmp_path / 'reset.db'}",
        connect_args={"timeout": 30},
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(
            email="alice@example.com",
            username="alice",
            password_hash=hash_password("old-password"),
        )
        db.add(user)
        db.flush()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                code_hash=hash_reset_code("123456"),
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            )
        )
        db.commit()

    def reset(_):
        """Attempt one password reset and report whether it succeeded."""

        with Session(engine) as db:
            try:
                reset_password_service(
                    db,
                    ResetPasswordRequest(
                        email="alice@example.com",
                        code="123456",
                        new_password="new-password",
                    ),
                )
                return True
            except InvalidCode:
                return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(reset, range(2))).count(True) == 1
    engine.dispose()


@pytest.mark.parametrize("field", ["workspace_id", "project_id"])
def test_task_reassignment_rejected(client, db_session, field):
    """Reject attempts to move a task into another workspace."""

    _, headers, wa = account(client)
    _, _, wb = account(client, "bob")
    item = task(client, headers, wa)
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=headers,
        json={field: wb["id"]},
    )
    assert result.status_code == 422
    assert str(db_session.get(Task, UUID(item["id"])).workspace_id) == wa["id"]


def test_tag_reassignment_rejected(client, db_session):
    """Reject attempts to move a tag into another workspace."""

    _, headers, wa = account(client)
    _, _, wb = account(client, "bob")
    item = tag(client, headers, wa)
    result = client.patch(
        f"/tags/{item['id']}",
        headers=headers,
        json={"workspace_id": wb["id"]},
    )
    assert result.status_code == 422
    assert str(db_session.get(Tag, UUID(item["id"])).workspace_id) == wa["id"]


def test_foreign_tag_batch_is_atomic_and_not_disclosed(client, db_session):
    """Reject foreign tag updates atomically and hide corrupt associations."""

    _, ha, wa = account(client)
    _, hb, wb = account(client, "bob")
    own_tag, foreign_tag = tag(client, ha, wa), tag(client, hb, wb)
    item = task(client, ha, wa)
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=ha,
        json={
            "title": "Should roll back",
            "tags": {
                "add_tag_ids": [own_tag["id"], foreign_tag["id"]],
            },
        },
    )
    assert result.status_code == 404
    assert db_session.scalar(select(func.count()).select_from(TaskTag)) == 0
    assert db_session.get(Task, UUID(item["id"])).title == "Test task"
    # Defense in depth for a corrupt legacy association.
    db_session.add(TaskTag(task_id=UUID(item["id"]), tag_id=UUID(foreign_tag["id"])))
    db_session.commit()
    result = client.get(f"/tasks/{item['id']}", headers=ha)
    assert result.json()["tags"]["tags"] == []


def test_remove_unrelated_tag_does_not_remove_own_tag(client, db_session):
    """Ensure an unrelated tag removal leaves the task's own tag intact."""

    _, ha, wa = account(client)
    own_tag = tag(client, ha, wa)
    item = task(client, ha, wa)
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=ha,
        json={"tags": {"add_tag_ids": [own_tag["id"]]}},
    )
    assert result.status_code == 200
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=ha,
        json={"tags": {"remove_tag_ids": [str(uuid4())]}},
    )
    assert result.status_code == 404
    assert db_session.scalar(select(func.count()).select_from(TaskTag)) == 1
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=ha,
        json={"tags": {"remove_tag_ids": [own_tag["id"]]}},
    )
    assert result.status_code == 200
    assert db_session.scalar(select(func.count()).select_from(TaskTag)) == 0


def test_viewer_cannot_mutate_own_task_or_attachments(client, db_session):
    """Restrict viewers from changing tasks or creating attachments."""

    user, headers, ws = account(client)
    item = task(client, headers, ws)
    member = db_session.get(WorkspaceMember, (UUID(ws["id"]), UUID(user["id"])))
    member.role = "viewer"
    db_session.commit()
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=headers,
        json={"title": "No access"},
    )
    assert result.status_code == 403
    assert client.delete(f"/tasks/{item['id']}", headers=headers).status_code == 403
    result = client.post(
        f"/tasks/attachments/link?task_id={item['id']}",
        headers=headers,
        json={"url": "https://example.com", "attachment_name": "No access"},
    )
    assert result.status_code == 403
    assert client.get(f"/tasks/{item['id']}", headers=headers).status_code == 200


def test_s3_policy_enforces_exact_size_without_network(monkeypatch):
    """Ensure S3 upload policies enforce exact size and content type."""

    s3 = boto3.client(
        "s3",
        region_name="us-east-2",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    monkeypatch.setattr("app.core.s3_client.get_s3_client", lambda: s3)
    upload, _ = create_presigned_upload_url("test-key", "application/pdf", 1024)
    policy = json.loads(base64.b64decode(upload["fields"]["policy"]))
    assert ["content-length-range", 1024, 1024] in policy["conditions"]
    assert {"Content-Type": "application/pdf"} in policy["conditions"]
    with pytest.raises(ValueError):
        create_presigned_upload_url(
            "test-key",
            "application/pdf",
            10 * 1024 * 1024 + 1,
        )


@pytest.mark.parametrize(
    "metadata",
    [
        {"ContentLength": 11 * 1024 * 1024, "ContentType": "application/pdf"},
        {"ContentLength": 1024, "ContentType": "text/html"},
    ],
)
def test_upload_finalization_rejects_tampering(
    client,
    db_session,
    monkeypatch,
    metadata,
):
    """Reject upload finalization when stored object metadata is tampered with."""

    _, headers, ws = account(client)
    item = task(client, headers, ws)
    monkeypatch.setattr(
        "app.services.task.attachment_service.create_presigned_upload_url",
        lambda *args: (
            {"url": "https://s3.example", "fields": {"key": "test"}},
            300,
        ),
    )
    upload = client.post(
        f"/tasks/attachments/file?task_id={item['id']}",
        headers=headers,
        json={
            "original_filename": "file.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024,
        },
    )
    assert upload.status_code == 201
    assert upload.json()["upload_method"] == "POST"
    attachment_id = upload.json()["attachment_id"]
    monkeypatch.setattr(
        "app.services.task.attachment_service.get_s3_object_metadata",
        lambda _: metadata,
    )
    delete = Mock()
    monkeypatch.setattr(
        "app.services.task.attachment_service.delete_s3_object",
        delete,
    )
    result = client.patch(
        f"/tasks/{item['id']}/attachments/{attachment_id}/uploaded",
        headers=headers,
    )
    assert result.status_code == 400
    delete.assert_called_once()
    assert db_session.get(Attachment, UUID(attachment_id)).status == "failed"
    result = client.get(
        f"/tasks/{item['id']}/attachments/{attachment_id}/download",
        headers=headers,
    )
    assert result.status_code == 409


def test_mailgun_uses_test_recipient_and_hides_provider_errors(monkeypatch):
    """Route development emails to the test recipient and hide provider errors."""

    monkeypatch.setattr(settings, "MAILGUN_API_KEY", SecretStr("test-secret"))
    monkeypatch.setattr(settings, "MAILGUN_DOMAIN", "mail.example.com")
    monkeypatch.setattr(settings, "MAILGUN_FROM", "donee@example.com")
    monkeypatch.setattr(settings, "DEVELOPMENT_EMAIL", "developer@example.com")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    post = Mock(
        return_value=httpx.Response(
            200,
            request=httpx.Request("POST", "https://api.mailgun.net"),
        )
    )
    monkeypatch.setattr("app.services.auth.email_service.httpx.post", post)
    send_email("victim@example.com", "Reset", "test-code")
    assert post.call_args.kwargs["files"]["to"] == (None, "developer@example.com")
    post.side_effect = httpx.ConnectError("sensitive-provider-information")
    with pytest.raises(HTTPException) as error:
        send_email("victim@example.com", "Reset", "test-code")
    assert error.value.status_code == 503
    assert "sensitive" not in error.value.detail


def test_registration_mail_failure_rolls_back_account(client, db_session, monkeypatch):
    """Roll back account creation when its registration email cannot be sent."""

    def fail(*args):
        """Simulate a mail provider failure."""
        raise HTTPException(503, "Email unavailable")

    monkeypatch.setattr("app.services.auth.auth_service.send_email", fail)
    assert register_user(client).status_code == 503
    assert db_session.scalar(select(func.count()).select_from(User)) == 0


def test_malformed_signed_subject_is_401(client):
    """Reject a signed access token with a malformed subject."""

    token = create_access_token({"sub": "not-a-uuid", "ver": 0})
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_limits_and_pagination(client):
    """Enforce task pagination and request-size limits."""

    _, headers, ws = account(client)
    for _ in range(3):
        task(client, headers, ws)
    result = client.get(
        f"/tasks?workspace_id={ws['id']}&limit=1&offset=1",
        headers=headers,
    )
    assert result.status_code == 200
    assert len(result.json()["tasks"]) == 1 and result.json()["total"] == 3
    oversized_page = client.get(
        f"/tasks?workspace_id={ws['id']}&limit=1000",
        headers=headers,
    )
    assert oversized_page.status_code == 422
    response = client.post("/tasks", headers=headers, content=b"x" * 65537)
    assert response.status_code == 413
    item = result.json()["tasks"][0]
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=headers,
        json={"description": "x" * 10001},
    )
    assert result.status_code == 422
    result = client.patch(
        f"/tasks/{item['id']}",
        headers=headers,
        json={"tags": {"add_tag_ids": [str(uuid4()) for _ in range(51)]}},
    )
    assert result.status_code == 422


def test_rate_limit_window_expires_without_permanent_lockout(client, monkeypatch):
    """Allow login attempts again after the rate-limit window expires."""

    monkeypatch.setattr("app.core.rate_limit.time.time", lambda: 1800)
    register_user(client)
    for _ in range(3):
        assert login_user(client, password="wrong-password").status_code == 401
    assert login_user(client).status_code == 429
    monkeypatch.setattr("app.core.rate_limit.time.time", lambda: 2700)
    assert login_user(client).status_code == 200


def test_source_limit_prevents_unlimited_account_spraying(db_session):
    """Limit login attempts from one source across many account names."""

    request = Request({"type": "http", "client": ("127.0.0.1", 1234)})
    for number in range(30):
        enforce_auth_limit(db_session, request, "login", f"user{number}@example.com")
    with pytest.raises(HTTPException) as error:
        enforce_auth_limit(db_session, request, "login", "one-more@example.com")
    assert error.value.status_code == 429


def test_failed_mail_does_not_replace_valid_challenge(client, db_session, monkeypatch):
    """Keep an existing reset challenge when sending a replacement email fails."""

    register_user(client)
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    previous_id = db_session.scalar(select(PasswordResetToken.id))

    def fail(*args):
        """Simulate a mail provider failure."""
        raise HTTPException(503, "Email unavailable")

    monkeypatch.setattr("app.services.auth.password_reset_service.send_email", fail)
    response = client.post(
        "/auth/forgot-password",
        json={"email": "test@donee.com"},
    )
    assert response.status_code == 503
    assert db_session.scalar(select(PasswordResetToken.id)) == previous_id


def test_task_quota_prevents_additional_creation(client, db_session):
    """Prevent creating tasks after the workspace quota is reached."""

    user, headers, ws = account(client)
    db_session.add_all(
        [
            Task(
                workspace_id=UUID(ws["id"]),
                created_by=UUID(user["id"]),
                title=f"Task {number}",
                description="test",
                priority="high",
                due_at=date.today(),
            )
            for number in range(1000)
        ]
    )
    db_session.commit()
    result = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Over quota",
            "description": "test",
            "priority": "high",
            "due_at": "2026-12-01",
            "workspace_id": ws["id"],
        },
    )
    assert result.status_code == 409
    assert db_session.scalar(select(func.count()).select_from(Task)) == 1000


def test_pending_uploads_reserve_workspace_storage(client, db_session, monkeypatch):
    """Count pending attachments against the workspace storage quota."""

    user, headers, ws = account(client)
    item = task(client, headers, ws)
    db_session.add_all(
        [
            Attachment(
                task_id=UUID(item["id"]),
                uploader_id=UUID(user["id"]),
                attachment_type="file",
                attachment_name=f"Pending {number}",
                original_filename=f"{number}.pdf",
                content_type="application/pdf",
                size_bytes=10 * 1024 * 1024,
                status="pending",
            )
            for number in range(10)
        ]
    )
    db_session.commit()
    presign = Mock()
    monkeypatch.setattr(
        "app.services.task.attachment_service.create_presigned_upload_url",
        presign,
    )
    result = client.post(
        f"/tasks/attachments/file?task_id={item['id']}",
        headers=headers,
        json={
            "original_filename": "extra.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1,
        },
    )
    assert result.status_code == 409
    presign.assert_not_called()


def test_task_delete_cleans_files_before_releasing_records(
    client,
    db_session,
    monkeypatch,
):
    """Delete stored files before removing task attachment records."""

    user, headers, ws = account(client)
    item = task(client, headers, ws)
    db_session.add(
        Attachment(
            task_id=UUID(item["id"]),
            uploader_id=UUID(user["id"]),
            attachment_type="file",
            attachment_name="File",
            original_filename="file.pdf",
            storage_key="test-key",
            content_type="application/pdf",
            size_bytes=1024,
            status="uploaded",
        )
    )
    db_session.commit()
    remove = Mock()
    monkeypatch.setattr("app.services.task.task_service.delete_s3_object", remove)
    assert client.delete(f"/tasks/{item['id']}", headers=headers).status_code == 200
    remove.assert_called_once_with("test-key")
    assert db_session.scalar(select(func.count()).select_from(Attachment)) == 0


def test_mailgun_production_uses_actual_recipient(monkeypatch):
    """Send production emails to their intended recipient."""

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MAILGUN_API_KEY", SecretStr("test-key"))
    monkeypatch.setattr(settings, "MAILGUN_DOMAIN", "mg.example.com")
    monkeypatch.setattr(settings, "MAILGUN_FROM", "donee@example.com")
    post = Mock(
        return_value=httpx.Response(
            200,
            request=httpx.Request("POST", "https://api.mailgun.net"),
        )
    )
    monkeypatch.setattr("app.services.auth.email_service.httpx.post", post)
    send_email("alice@example.com", "Welcome", "Hello")
    assert post.call_args.kwargs["files"]["to"] == (None, "alice@example.com")


def test_correct_third_verification_can_be_followed_by_reset(client):
    """Allow password reset after code verification uses the final guess."""

    register_user(client)
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    for _ in range(2):
        response = client.post(
            "/auth/verify-reset-code",
            json={"email": "test@donee.com", "code": "000000"},
        )
        assert response.status_code == 400
    response = client.post(
        "/auth/verify-reset-code",
        json={"email": "test@donee.com", "code": "123456"},
    )
    assert response.status_code == 200
    response = client.post(
        "/auth/reset-password",
        json={
            "email": "test@donee.com",
            "code": "123456",
            "new_password": "new-password-123",
        },
    )
    assert response.status_code == 200


def test_storage_keys_fit_database_column_and_ignore_filename():
    """Ensure generated storage keys fit the database column."""

    user, attachment = uuid4(), uuid4()
    key = build_attachment_storage_key(user, attachment)
    assert len(key) <= Attachment.__table__.c.storage_key.type.length
