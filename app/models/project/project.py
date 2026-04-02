"""Import the necessary libraries for the project model creation."""

from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Project(Base):
    """Project model."""

    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    created_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    color: Mapped[str] = mapped_column(
        String(7),
    )

    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        server_default=sa.text("false"),
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
    )

    created_at = Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("idx_projects_created_by", "created_by"),
        Index("idx_projects_workspace_id_is_archived", "workspace_id", "is_archived"),
        Index("idx_projects_workspace_id_sort_order", "workspace_id", "sort_order"),
    )

    # Foreign key constraints:

    creator = relationship(
        "User", foreign_keys=[created_by], back_populates="created_projects"
    )

    workspace = relationship(
        "Workspace",
        foreign_keys=[workspace_id],
        back_populates="workspace_projects",
    )

    # Referenced by:

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
