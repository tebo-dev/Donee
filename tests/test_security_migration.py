"""Validate upgrade/downgrade on synthetic data and PostgreSQL SQL generation."""

import importlib.util
import io
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from alembic.migration import MigrationContext
from alembic.operations import Operations


def migration_module():
    """Load the security migration module for validation tests."""

    path = (
        Path(__file__).resolve().parents[1]
        / "alembic/versions/a62f9d104c81_security_controls.py"
    )
    spec = importlib.util.spec_from_file_location("security_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_security_migration_preserves_users_and_invalidates_old_challenges():
    """Verify the upgrade keeps users while removing stale reset challenges."""

    engine = create_engine("sqlite://")
    module = migration_module()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)"))
        conn.execute(
            text("CREATE TABLE password_reset_tokens (id INTEGER PRIMARY KEY)")
        )
        conn.execute(text("INSERT INTO users VALUES (1, 'test@example.com')"))
        conn.execute(text("INSERT INTO password_reset_tokens VALUES (1)"))
        module.op = Operations(MigrationContext.configure(conn))
        module.upgrade()
        assert conn.execute(text("SELECT token_version FROM users")).scalar_one() == 0
        assert (
            conn.execute(
                text("SELECT count(*) FROM password_reset_tokens")
            ).scalar_one()
            == 0
        )
        assert "auth_rate_limits" in inspect(conn).get_table_names()
        module.downgrade()
        assert "auth_rate_limits" not in inspect(conn).get_table_names()
        assert (
            conn.execute(text("SELECT email FROM users")).scalar_one()
            == "test@example.com"
        )
    engine.dispose()


def test_postgresql_migration_compiles_offline():
    """Check that the PostgreSQL migration emits the expected SQL."""

    module = migration_module()
    buffer = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql", opts={"as_sql": True, "output_buffer": buffer}
    )
    module.op = Operations(context)
    module.upgrade()
    sql = buffer.getvalue()
    assert "ALTER TABLE users ADD COLUMN token_version" in sql
    assert "CREATE TABLE auth_rate_limits" in sql
