"""Import the necessary libraries for the task tag model creation."""

from uuid import UUID

from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaskTag(Base):
    """Task tag model."""

    __tablename__ = "task_tags"

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )

    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )

    # Foreign key constraints:

    task = relationship("Task", foreign_keys=[task_id], back_populates="task_tags")

    tag = relationship("Tag", foreign_keys=[tag_id], back_populates="task_tags")
