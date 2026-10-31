"""Store explicit registration agreement receipts.

Revision ID: 63a9c72d8e10
Revises: 27429857847c
"""

import sqlalchemy as sa

from alembic import op

revision = "63a9c72d8e10"
down_revision = "27429857847c"
branch_labels = None
depends_on = None


def upgrade():
    """Create receipts without inventing acceptance for existing accounts."""
    op.create_table(
        "policy_acceptances",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("terms_version", sa.String(40), nullable=False),
        sa.Column("acceptable_use_version", sa.String(40), nullable=False),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade():
    """Remove receipt storage; this discards acceptance evidence."""
    op.drop_table("policy_acceptances")
