"""Import the necessary libraries for the user model creation."""

from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    """User model."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default=sa.text("true"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Referenced by:

    reset_tokens = relationship(
        "PasswordResetToken",
        foreign_keys="PasswordResetToken.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    assigned_tasks = relationship(
        "Task",
        foreign_keys="Task.assignee_id",
        back_populates="assignee",
        cascade="all, delete-orphan",
    )

    created_tasks = relationship(
        "Task",
        foreign_keys="Task.created_by",
        back_populates="creator",
        cascade="all, delete-orphan",
    )

    attachments_uploaded = relationship(
        "Attachment",
        foreign_keys="Attachment.uploader_id",
        back_populates="uploader",
        cascade="all, delete-orphan",
    )

    comments_posted = relationship(
        "Comment",
        foreign_keys="Comment.author_id",
        back_populates="author",
        cascade="all, delete-orphan",
    )

    workspaces_owned = relationship(
        "Workspace",
        foreign_keys="Workspace.owner_id",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    workspace_member = relationship(
        "WorkspaceMember",
        foreign_keys="WorkspaceMember.user_id",
        back_populates="member",
        cascade="all, delete-orphan",
    )
