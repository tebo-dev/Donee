"""Import the necessary libraries for the reminder model creation."""

from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Reminder(Base):
    """Reminder model."""

    __tablename__ = "reminders"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE")
    )

    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    channel: Mapped[str] = mapped_column(
        String(5),
        server_default=sa.text("inapp"),
    )

    status: Mapped[str] = mapped_column(String(8), server_default=sa.text("pending"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_reminders_remind_at_status", "remind_at", "status"),
        CheckConstraint("channel IN ('inapp', 'email', 'push')"),
        CheckConstraint("status IN ('pending', 'sent', 'canceled')"),
    )

    # Foreign key constraints:

    task = relationship("Task", foreign_keys=[task_id], back_populates="task_reminders")
