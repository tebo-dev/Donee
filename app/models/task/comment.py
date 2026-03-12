"""Import the necessary libraries for the comment model creation."""

from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Comment(Base):
    """Comment model."""

    __tablename__ = "comments"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
    )

    author_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_edited: Mapped[bool] = mapped_column(
        Boolean,
        server_default=sa.text("false"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = Index("idx_comments_task_id_created_at", "task_id", "created_at")

    # Foreign key constraints:

    author = relationship(
        "User", foreign_keys=[author_id], back_populates="comments_posted"
    )

    task = relationship("Task", foreign_keys=[task_id], back_populates="task_comments")
