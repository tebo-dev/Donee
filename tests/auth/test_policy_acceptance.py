"""Registration must validate and atomically persist real agreement evidence."""

import importlib.util
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy import func, select

from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.models.auth.policy_acceptance import PolicyAcceptance
from app.models.auth.user import User
from app.models.workspace.workspace import Workspace


def payload():
    """Explicit current agreement, not defaulted by the server."""
    return {
        "email": "agreement@example.com",
        "username": "agreement",
        "password": "password123",
        "terms_accepted": True,
        "terms_version": "2026-10-26",
        "acceptable_use_version": "2026-10-26",
    }


@pytest.mark.parametrize(
    "field,value",
    [
        ("terms_accepted", None),
        ("terms_accepted", False),
        ("terms_accepted", "true"),
        ("terms_accepted", 1),
        ("terms_version", None),
        ("terms_version", "old"),
        ("acceptable_use_version", None),
        ("acceptable_use_version", "old"),
        ("accepted_at", "2000-01-01T00:00:00Z"),
    ],
)
def test_registration_rejects_missing_false_coerced_stale_or_forged_agreement(
    client, db_session, mailbox, field, value
):
    """Bypassing the browser cannot create an account without current assent."""
    data = payload()
    if value is None:
        data.pop(field)
    else:
        data[field] = value
    assert client.post("/auth/register", json=data).status_code == 422
    for model in (User, Workspace, PolicyAcceptance):
        assert db_session.scalar(select(func.count()).select_from(model)) == 0
    assert mailbox == []


def test_receipt_is_persisted_with_server_time_and_not_replaced_on_duplicate(
    client, db_session
):
    """One account gets one minimal receipt, with no client-provided timestamp."""
    before = datetime.now(timezone.utc).replace(microsecond=0)
    response = client.post("/auth/register", json=payload())
    assert response.status_code == 201
    user_id = UUID(response.json()["id"])
    db_session.expire_all()
    receipt = db_session.get(PolicyAcceptance, user_id)
    assert receipt.terms_version == "2026-10-26"
    assert receipt.acceptable_use_version == "2026-10-26"
    accepted_at = receipt.accepted_at.replace(tzinfo=timezone.utc)
    assert before <= accepted_at <= datetime.now(timezone.utc)
    assert client.post("/auth/register", json=payload()).status_code == 409
    db_session.expire_all()
    assert (
        db_session.get(PolicyAcceptance, user_id).accepted_at.replace(
            tzinfo=timezone.utc
        )
        == accepted_at
    )
    assert db_session.scalar(select(func.count()).select_from(PolicyAcceptance)) == 1


def test_failed_registration_rolls_back_account_workspace_and_receipt(
    client, db_session, monkeypatch
):
    """Receipt insertion is not a separate commit that can leave orphan evidence."""

    def fail(*args):
        raise RuntimeError("simulated workspace failure")

    monkeypatch.setattr(
        "app.services.auth.auth_service.create_default_workspace_for_user", fail
    )
    with pytest.raises(RuntimeError, match="simulated workspace failure"):
        client.post("/auth/register", json=payload())
    for model in (User, Workspace, PolicyAcceptance):
        assert db_session.scalar(select(func.count()).select_from(model)) == 0


def test_acceptance_migration_round_trip_and_postgresql_sql():
    """Exercise only the new migration on disposable storage, never configured DB."""

    path = (
        Path(__file__).resolve().parents[2]
        / "alembic/versions/63a9c72d8e10_registration_policy_acceptance.py"
    )
    spec = importlib.util.spec_from_file_location("acceptance_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        users = sa.Table(
            "users", sa.MetaData(), sa.Column("id", sa.Uuid(), primary_key=True)
        )
        users.create(connection)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        receipt = sa.Table(
            "policy_acceptances", sa.MetaData(), autoload_with=connection
        )
        user_id = uuid4()
        connection.execute(users.insert().values(id=user_id))
        # SQLite reflects UUID as NUMERIC; use the model's portable type for the insert.
        connection.execute(
            PolicyAcceptance.__table__.insert().values(
                user_id=user_id,
                terms_version="2026-10-26",
                acceptable_use_version="2026-10-26",
            )
        )
        assert connection.scalar(sa.select(receipt.c.accepted_at)) is not None
        connection.execute(users.delete().where(users.c.id == user_id))
        assert connection.scalar(sa.select(sa.func.count()).select_from(receipt)) == 0
        migration.downgrade()
        assert "policy_acceptances" not in sa.inspect(connection).get_table_names()
    engine.dispose()
    output = StringIO()
    migration.op = Operations(
        MigrationContext.configure(
            dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output}
        )
    )
    migration.upgrade()
    sql = output.getvalue()
    assert "TIMESTAMP WITH TIME ZONE" in sql
    assert "ON DELETE CASCADE" in sql
    assert "DEFAULT now() NOT NULL" in sql
