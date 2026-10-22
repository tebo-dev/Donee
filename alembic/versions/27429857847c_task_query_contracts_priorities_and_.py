"""Task priorities, revocable sessions and refresh rotation.

Revision ID: 27429857847c
Revises: a62f9d104c81
"""

import sqlalchemy as sa

from alembic import op

revision = "27429857847c"
down_revision = "a62f9d104c81"
branch_labels = None
depends_on = None


def upgrade():
    """Convert known priorities; refuse custom integers rather than lose meaning."""
    # PostgreSQL raises before conversion for any unmapped integer. This also
    # compiles offline; no migration-time Python query or production connection.
    op.create_check_constraint(
        "tasks_priority_legacy_check", "tasks", "priority IN (1, 2, 3)"
    )
    op.drop_constraint("tasks_priority_legacy_check", "tasks", type_="check")
    op.alter_column(
        "tasks",
        "priority",
        existing_type=sa.SmallInteger(),
        type_=sa.String(6),
        existing_nullable=False,
        postgresql_using=(
            "CASE priority WHEN 1 THEN 'high' "
            "WHEN 2 THEN 'normal' WHEN 3 THEN 'low' END"
        ),
    )
    op.create_check_constraint(
        "tasks_priority_check", "tasks", "priority IN ('high', 'normal', 'low')"
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_table(
        "auth_refresh_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("auth_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_auth_refresh_tokens_session_id", "auth_refresh_tokens", ["session_id"]
    )


def downgrade():
    """Restore the numeric contract; all new-format sessions are discarded."""
    op.drop_table("auth_refresh_tokens")
    op.drop_table("auth_sessions")
    op.drop_constraint("tasks_priority_check", "tasks", type_="check")
    op.alter_column(
        "tasks",
        "priority",
        existing_type=sa.String(6),
        type_=sa.SmallInteger(),
        existing_nullable=False,
        postgresql_using=(
            "CASE priority WHEN 'high' THEN 1 "
            "WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END"
        ),
    )
