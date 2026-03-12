"""Import the necessary libraries for the attachment model creation."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, func
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

    filename: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    storage_key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        Text,
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Foreign key constraints:

    task = relationship(
        "Task", foreign_keys=[task_id], back_populates="task_attachments"
    )

    uploader = relationship(
        "User", foreign_keys=[uploader_id], back_populates="attachments_uploaded"
    )
