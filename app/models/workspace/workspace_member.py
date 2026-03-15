"""Import the necessary libraries for the workspace member model creation."""

from datetime import date
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkspaceMember(Base):
    """Workspace member model."""

    __tablename__ = "workspace_members"

    workspace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(50),
    )

    added_at: Mapped[date] = mapped_column(
        Date,
        server_default=sa.text("CURRENT_DATE"),
    )

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'admin', 'member', 'viewer')"),
    )

    # Foreign key constraints:

    member = relationship(
        "User", foreign_keys=[user_id], back_populates="workspace_member"
    )

    workspace = relationship(
        "Workspace", foreign_keys=[workspace_id], back_populates="workspace_members"
    )
