"""Inspect PostgreSQL migration SQL without connecting to or migrating a database."""

import importlib.util
import io
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations


def migration_sql(direction):
    path = next(
        (Path(__file__).resolve().parents[1] / "alembic/versions").glob("27429857847c*")
    )
    spec = importlib.util.spec_from_file_location("backend_contracts_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    buffer = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql", opts={"as_sql": True, "output_buffer": buffer}
    )
    module.op = Operations(context)
    getattr(module, direction)()
    return buffer.getvalue()


def test_postgresql_upgrade_guards_custom_priorities_before_conversion():
    sql = migration_sql("upgrade")
    guard = sql.index("ADD CONSTRAINT tasks_priority_legacy_check")
    drop = sql.index("DROP CONSTRAINT tasks_priority_legacy_check")
    conversion = sql.index("ALTER COLUMN priority TYPE VARCHAR(6)")
    assert guard < drop < conversion
    assert "priority IN (1, 2, 3)" in sql
    assert "WHEN 1 THEN 'high' WHEN 2 THEN 'normal' WHEN 3 THEN 'low'" in sql
    assert (
        "ADD CONSTRAINT tasks_priority_check "
        "CHECK (priority IN ('high', 'normal', 'low'))" in sql
    )
    assert "CREATE TABLE auth_sessions" in sql
    assert "CREATE TABLE auth_refresh_tokens" in sql
    assert "ON DELETE CASCADE" in sql


def test_postgresql_downgrade_restores_integer_mapping():
    sql = migration_sql("downgrade")
    assert sql.index("DROP TABLE auth_refresh_tokens") < sql.index(
        "DROP TABLE auth_sessions"
    )
    assert "ALTER COLUMN priority TYPE SMALLINT" in sql
    assert "WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3" in sql
