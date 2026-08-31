"""Import the necessary libraries for the attachment model creation."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Attachment(Base):
    """Attachment model."""

    __tablename__ = "attachments"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE")
    )

    uploader_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    attachment_type: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
    )

    attachment_name: Mapped[str] = mapped_column(
        String(155),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(
        String(155),
        nullable=True,
    )

    storage_key: Mapped[str] = mapped_column(
        String(114),
        nullable=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(15),
        nullable=True,
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=True,
    )

    url: Mapped[str] = mapped_column(
        String(2000),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        default="uploaded",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            """status IN ('pending', 'uploaded', 'failed', 'deleted')""",
            name="tasks_status_check",
        ),
    )

    # Foreign key constraints:

    task = relationship(
        "Task", foreign_keys=[task_id], back_populates="task_attachments"
    )

    uploader = relationship(
        "User", foreign_keys=[uploader_id], back_populates="attachments_uploaded"
    )
