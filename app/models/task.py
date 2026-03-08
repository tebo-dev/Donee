"""Import the necessary libraries for the task model creation."""

from datetime import date, datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Task(Base):
    """Task model."""

    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )

    title: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
    )

    status: Mapped[str] = mapped_column(String(11), server_default=sa.text("to do"))

    priority: Mapped[int] = mapped_column(
        SmallInteger(),
    )

    assignee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )

    created_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    due_at: Mapped[date] = mapped_column(
        Date,
        index=True,
    )

    start_at: Mapped[date] = mapped_column(
        Date,
    )

    completed_at: Mapped[date] = mapped_column(
        Date,
    )

    estimate_minutes: Mapped[int] = mapped_column(
        Integer,
    )

    parent_task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
    )

    recurrence_rule: Mapped[str] = mapped_column(
        Text,
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        server_default=sa.text("false"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("idx_tasks_assignee_id_status", "assignee_id", "status"),
        Index("idx_tasks_project_id_status", "project_id", "status"),
        CheckConstraint(
            """status IN ('to do', 'in_progress', 'blocked', 'done',
            'archived')""",
            name="tasks_status_check",
        ),
    )

    assignee = relationship(
        "User", foreign_keys=[assignee_id], back_populates="assigned_tasks"
    )

    creator = relationship(
        "User", foreign_keys=[created_by], back_populates="created_tasks"
    )

    parent = relationship("Task", remote_side=[id], back_populates="subtasks")

    subtasks = relationship(
        "Task", back_populates="parent", cascade="all, delete-orphan"
    )
