"""Session revocation, reset attempt limits, and shared request counters."""

import sqlalchemy as sa

from alembic import op

revision = "a62f9d104c81"
down_revision = "bed977772460"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "password_reset_tokens",
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute("DELETE FROM password_reset_tokens")
    op.create_table(
        "auth_rate_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
    )
    op.create_index(
        "ix_auth_rate_limits_expires_at", "auth_rate_limits", ["expires_at"]
    )


def downgrade():
    op.drop_table("auth_rate_limits")
    op.drop_column("password_reset_tokens", "failed_attempts")
    op.drop_column("users", "token_version")
