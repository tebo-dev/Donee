"""Backend/frontend contracts: filtering, deletion, priority and login sessions."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import UUID, uuid4

import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.jwt_handler import create_access_token, decode_access_token
from app.core.security import hash_password
from app.db.base import Base
from app.models import (
    Attachment,
    AuthSession,
    RefreshToken,
    Task,
    TaskTag,
    User,
    Workspace,
    WorkspaceMember,
)
from app.services.auth.session_service import create_session, refresh_session
from tests.test_security_regressions import account, tag, task
from tests.utils import login_user, register_user


def auth(pair):
    return {"Authorization": "Bearer " + pair["access_token"]}


def refresh(client, pair):
    return client.post("/auth/refresh", json={"refresh_token": pair["refresh_token"]})


def test_refresh_rotation_replay_and_independent_session(client, db_session):
    register_user(client)
    first = login_user(client).json()
    second = login_user(client).json()
    assert first["expires_in"] > 0 and first["refresh_expires_in"] > first["expires_in"]
    record = db_session.scalar(select(RefreshToken))
    assert record.token_hash != first["refresh_token"] and len(record.token_hash) == 64
    rotated = refresh(client, first)
    assert rotated.status_code == 200
    assert rotated.headers["cache-control"] == "no-store"
    assert rotated.json()["refresh_token"] != first["refresh_token"]
    assert client.get("/auth/me", headers=auth(rotated.json())).status_code == 200
    # Reusing the spent secret revokes the whole family, including its new JWT.
    assert refresh(client, first).status_code == 401
    assert refresh(client, rotated.json()).status_code == 401
    assert client.get("/auth/me", headers=auth(rotated.json())).status_code == 401
    assert client.get("/auth/me", headers=auth(second)).status_code == 200


def test_logout_revokes_access_and_refresh_only_for_current_session(client):
    register_user(client)
    first, second = login_user(client).json(), login_user(client).json()
    assert client.post("/auth/logout", headers=auth(first)).status_code == 200
    assert client.get("/auth/me", headers=auth(first)).status_code == 401
    assert refresh(client, first).status_code == 401
    assert client.get("/auth/me", headers=auth(second)).status_code == 200
    assert refresh(client, second).status_code == 200


def test_logout_all_and_password_reset_revoke_refresh_credentials(client):
    register_user(client)
    first, second = login_user(client).json(), login_user(client).json()
    assert client.post("/auth/logout-all", headers=auth(first)).status_code == 200
    for pair in (first, second):
        assert client.get("/auth/me", headers=auth(pair)).status_code == 401
        assert refresh(client, pair).status_code == 401
    third = login_user(client).json()
    client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    reset = client.post(
        "/auth/reset-password",
        json={
            "email": "test@donee.com",
            "code": "123456",
            "new_password": " new-password ",
        },
    )
    assert reset.status_code == 200
    assert reset.headers["cache-control"] == "no-store"
    assert client.get("/auth/me", headers=auth(third)).status_code == 401
    assert refresh(client, third).status_code == 401
    assert refresh(client, reset.json()).status_code == 200


def test_expired_sessions_and_wrong_token_types_are_rejected(client, db_session):
    user = register_user(client).json()
    pair = login_user(client).json()
    claims = decode_access_token(pair["access_token"])
    session = db_session.get(AuthSession, UUID(claims["sid"]))
    session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    assert client.get("/auth/me", headers=auth(pair)).status_code == 401
    assert refresh(client, pair).status_code == 401
    assert refresh(client, {"refresh_token": "x" * 64}).status_code == 401
    assert (
        client.get(
            "/auth/me", headers={"Authorization": "Bearer " + pair["refresh_token"]}
        ).status_code
        == 401
    )
    legacy = create_access_token({"sub": user["id"], "ver": 0})
    assert (
        client.get(
            "/auth/me", headers={"Authorization": "Bearer " + legacy}
        ).status_code
        == 401
    )


def test_expired_access_can_refresh_and_logout_requires_auth(client):
    register_user(client)
    pair = login_user(client).json()
    claims = decode_access_token(pair["access_token"])
    expired = create_access_token(claims, expires_delta=timedelta(seconds=-1))
    assert (
        client.get(
            "/auth/me", headers={"Authorization": "Bearer " + expired}
        ).status_code
        == 401
    )
    assert refresh(client, pair).status_code == 200
    assert client.post("/auth/logout").status_code == 401
    assert client.post("/auth/logout-all").status_code == 401


def test_password_whitespace_is_preserved_and_identifiers_trimmed(client, monkeypatch):
    monkeypatch.setattr("app.core.rate_limit.time.time", lambda: 1800)
    assert (
        register_user(
            client,
            email=" test@donee.com ",
            username=" testuser ",
            password=" password123 ",
        ).status_code
        == 201
    )
    assert login_user(client, password="password123").status_code == 401
    assert (
        login_user(
            client, email=" test@donee.com ", password=" password123 "
        ).status_code
        == 200
    )
    client.post("/auth/forgot-password", json={"email": " test@donee.com "})
    result = client.post(
        "/auth/reset-password",
        json={
            "email": " test@donee.com ",
            "code": " 123456 ",
            "new_password": " newpass123 ",
        },
    )
    assert result.status_code == 200
    monkeypatch.setattr("app.core.rate_limit.time.time", lambda: 2700)
    assert login_user(client, password="newpass123").status_code == 401
    assert login_user(client, password=" newpass123 ").status_code == 200


def test_task_filters_counts_and_pagination(client):
    _, headers, ws = account(client)
    first_tag = tag(client, headers, ws, "First")
    second_tag_response = client.post(
        "/tags",
        headers=headers,
        json={"name": "Second", "color": "#654321", "workspace_id": ws["id"]},
    )
    assert second_tag_response.status_code == 201
    second_tag = second_tag_response.json()
    ids = []
    for title, status, priority, due in [
        ("Alpha report", "to do", "high", "2026-11-01"),
        ("Alpha review", "done", "low", "2026-11-02"),
        ("Beta report", "blocked", "normal", "2026-12-01"),
    ]:
        result = client.post(
            "/tasks",
            headers=headers,
            json={
                "title": title,
                "description": "",
                "priority": priority,
                "due_at": due,
                "workspace_id": ws["id"],
            },
        )
        assert result.status_code == 201
        ids.append(result.json()["id"])
        assert (
            client.patch(
                "/tasks/" + ids[-1], headers=headers, json={"status": status}
            ).status_code
            == 200
        )
    client.patch(
        "/tasks/" + ids[0],
        headers=headers,
        json={"tags": {"add_tag_ids": [first_tag["id"], second_tag["id"]]}},
    )
    client.patch(
        "/tasks/" + ids[1],
        headers=headers,
        json={"tags": {"add_tag_ids": [first_tag["id"]]}},
    )
    base = {
        "workspace_id": ws["id"],
        "search": "ALPHA",
        "limit": 1,
        "order_by": "title",
    }
    result = client.get("/tasks", headers=headers, params=base).json()
    assert result["total"] == 2 and len(result["tasks"]) == 1
    assert result["counts"] == {
        "total": 3,
        "active": 2,
        "to_do": 1,
        "in_progress": 0,
        "blocked": 1,
        "done": 1,
        "archived": 0,
    }
    page2 = client.get("/tasks", headers=headers, params={**base, "offset": 1}).json()
    assert page2["tasks"][0]["id"] != result["tasks"][0]["id"]
    params = [
        ("workspace_id", ws["id"]),
        ("tag_ids", first_tag["id"]),
        ("tag_ids", second_tag["id"]),
        ("statuses", "to do"),
        ("statuses", "blocked"),
        ("due_from", "2026-11-01"),
        ("due_to", "2026-11-01"),
    ]
    filtered = client.get("/tasks", headers=headers, params=params).json()
    assert filtered["total"] == 1 and filtered["tasks"][0]["id"] == ids[0]
    empty = client.get(
        "/tasks", headers=headers, params={**base, "tag_ids": str(uuid4())}
    ).json()
    assert (
        empty["total"] == 0 and empty["tasks"] == [] and empty["counts"]["total"] == 3
    )
    assert (
        client.get(f"/workspaces/{ws['id']}/task-counts", headers=headers).json()
        == result["counts"]
    )
    _, foreign_headers, _ = account(client, "bob")
    assert (
        client.get(
            f"/workspaces/{ws['id']}/task-counts", headers=foreign_headers
        ).status_code
        == 403
    )
    assert client.get("/tasks", headers=foreign_headers, params=base).status_code == 403


@pytest.mark.parametrize(
    "field", ["title", "due_at", "priority", "status", "created_at", "id"]
)
def test_task_sorting_is_stable_in_both_directions(client, field):
    _, headers, ws = account(client)
    for title, priority, due in [
        ("Zulu", "low", "2026-12-03"),
        ("Alpha", "high", "2026-12-01"),
        ("Middle", "normal", "2026-12-02"),
    ]:
        assert (
            client.post(
                "/tasks",
                headers=headers,
                json={
                    "title": title,
                    "description": "",
                    "priority": priority,
                    "due_at": due,
                    "workspace_id": ws["id"],
                },
            ).status_code
            == 201
        )
    params = {"workspace_id": ws["id"], "order_by": field}
    asc = client.get("/tasks", headers=headers, params=params).json()["tasks"]
    desc = client.get(
        "/tasks", headers=headers, params={**params, "direction": "desc"}
    ).json()["tasks"]
    if field in ("title", "due_at", "priority", "id"):
        assert [t["id"] for t in asc] == list(reversed([t["id"] for t in desc]))
    if field == "priority":
        assert [t["priority"] for t in asc] == ["high", "normal", "low"]
    paged = [
        client.get(
            "/tasks", headers=headers, params={**params, "limit": 1, "offset": i}
        ).json()["tasks"][0]["id"]
        for i in range(3)
    ]
    assert paged == [t["id"] for t in asc]


def test_search_is_literal_and_query_validation(client):
    _, headers, ws = account(client)
    task(client, headers, ws)
    params = {"workspace_id": ws["id"]}
    for query in ("%", "_", "\\"):
        assert (
            client.get(
                "/tasks", headers=headers, params={**params, "search": query}
            ).json()["total"]
            == 0
        )
    for extra in (
        {"direction": "sideways"},
        {"order_by": "password"},
        {"statuses": "invalid"},
        {"tag_ids": "bad"},
        {"due_from": "2026-12-02", "due_to": "2026-12-01"},
    ):
        assert (
            client.get(
                "/tasks", headers=headers, params={**params, **extra}
            ).status_code
            == 422
        )


@pytest.mark.parametrize("priority", [1, 2, 3, "urgent", "High", "", None])
def test_priority_rejected_at_api_boundary(client, priority):
    _, headers, ws = account(client)
    result = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Task",
            "description": "",
            "priority": priority,
            "due_at": "2026-12-01",
            "workspace_id": ws["id"],
        },
    )
    assert result.status_code == 422
    item = task(client, headers, ws)
    assert (
        client.patch(
            "/tasks/" + item["id"], headers=headers, json={"priority": priority}
        ).status_code
        == 422
    )


def test_priority_database_constraint(client, db_session):
    _, headers, ws = account(client)
    item = task(client, headers, ws)
    record = db_session.get(Task, UUID(item["id"]))
    record.priority = "urgent"
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_workspace_delete_cascades_and_rejects_non_owner(
    client, db_session, monkeypatch
):
    user, headers, ws = account(client)
    item = task(client, headers, ws)
    label = tag(client, headers, ws)
    client.patch(
        "/tasks/" + item["id"],
        headers=headers,
        json={"tags": {"add_tag_ids": [label["id"]]}},
    )
    db_session.add(
        Attachment(
            task_id=UUID(item["id"]),
            uploader_id=UUID(user["id"]),
            attachment_type="file",
            attachment_name="File",
            original_filename="file.pdf",
            storage_key="test-key",
            content_type="application/pdf",
            size_bytes=10,
            status="uploaded",
        )
    )
    db_session.commit()
    other, other_headers, _ = account(client, "bob")
    db_session.add(
        WorkspaceMember(
            workspace_id=UUID(ws["id"]), user_id=UUID(other["id"]), role="viewer"
        )
    )
    db_session.commit()
    remove = Mock()
    monkeypatch.setattr(
        "app.services.workspace.workspace_service.delete_s3_object", remove
    )
    assert (
        client.delete(f"/workspaces/{ws['id']}", headers=other_headers).status_code
        == 403
    )
    remove.assert_not_called()
    assert client.delete(f"/workspaces/{ws['id']}", headers=headers).status_code == 200
    remove.assert_called_once_with("test-key")
    assert db_session.get(Workspace, UUID(ws["id"])) is None
    assert db_session.get(Task, UUID(item["id"])) is None
    assert db_session.scalar(select(func.count()).select_from(TaskTag)) == 0
    assert db_session.scalar(select(func.count()).select_from(Attachment)) == 0
    assert client.get("/workspaces", headers=other_headers).json()["workspaces"]
    assert client.delete(f"/workspaces/{ws['id']}", headers=headers).status_code == 404


def test_workspace_delete_storage_failure_preserves_records_and_can_retry(
    client, db_session, monkeypatch
):
    user, headers, ws = account(client)
    item = task(client, headers, ws)
    for key in ("first", "second"):
        db_session.add(
            Attachment(
                task_id=UUID(item["id"]),
                uploader_id=UUID(user["id"]),
                attachment_type="file",
                attachment_name=key,
                original_filename=key + ".pdf",
                storage_key=key,
                content_type="application/pdf",
                size_bytes=10,
                status="pending",
            )
        )
    db_session.commit()
    remove = Mock(
        side_effect=[
            None,
            ClientError({"Error": {"Code": "AccessDenied"}}, "DeleteObject"),
        ]
    )
    monkeypatch.setattr(
        "app.services.workspace.workspace_service.delete_s3_object", remove
    )
    assert client.delete(f"/workspaces/{ws['id']}", headers=headers).status_code == 503
    assert db_session.get(Workspace, UUID(ws["id"])) is not None
    assert db_session.scalar(select(func.count()).select_from(Attachment)) == 2
    remove.side_effect = None
    assert client.delete(f"/workspaces/{ws['id']}", headers=headers).status_code == 200


def test_concurrent_refresh_replay_revokes_family(tmp_path):
    """Two workers cannot consume one secret and leave two active successors."""
    engine = create_engine(
        "sqlite:///" + str(tmp_path / "sessions.sqlite"),
        connect_args={"check_same_thread": False, "timeout": 10},
    )

    @event.listens_for(engine, "connect")
    def enable_fk(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(
            email="race@example.com",
            username="race",
            password_hash=hash_password("password123"),
            is_active=True,
        )
        db.add(user)
        db.flush()
        pair = create_session(db, user)
        db.commit()

    def consume(_):
        with Session(engine) as db:
            try:
                return refresh_session(db, pair.refresh_token)
            except HTTPException as error:
                db.rollback()
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(consume, range(2)))
    assert sum(result == 401 for result in results) == 1
    winner = next(result for result in results if result != 401)
    with Session(engine) as db:
        session = db.scalar(select(AuthSession))
        assert session.revoked_at is not None
        with pytest.raises(HTTPException) as error:
            refresh_session(db, winner.refresh_token)
        assert error.value.status_code == 401
    engine.dispose()
