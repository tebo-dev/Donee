"""Import the necessary libraries for the tag model creation."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tag(Base):
    """Tag model."""

    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    color: Mapped[str] = mapped_column(
        String(7),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="unique_workspace_tag_name"),
    )

    # Foreign key constraints:

    workspace = relationship(
        "Workspace", foreign_keys=[workspace_id], back_populates="workspace_tags"
    )

    # Referenced by:

    task_tags = relationship(
        "TaskTag",
        foreign_keys="TaskTag.tag_id",
        back_populates="tag",
        cascade="all, delete-orphan",
    )
