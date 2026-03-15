"""Import the necessary libraries for the workspace model creation."""

from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Workspace(Base):
    """Workspace model."""

    __tablename__ = "workspaces"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    owner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    is_personal: Mapped[bool] = mapped_column(
        Boolean,
        server_default=sa.text("true"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Foreign key constraints:

    owner = relationship(
        "User", foreign_keys=[owner_id], back_populates="workspaces_owned"
    )

    # Referenced by:

    workspace_members = relationship(
        "WorkspaceMember",
        foreign_keys="WorkspaceMember.workspace_id",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )

    workspace_tags = relationship(
        "Tag",
        foreign_keys="Tag.workspace_id",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
