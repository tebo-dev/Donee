"""Minimal registration agreement evidence, stored with the account."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PolicyAcceptance(Base):
    """One registration receipt; no inferred acceptance for legacy accounts."""

    __tablename__ = "policy_acceptances"

    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    terms_version: Mapped[str] = mapped_column(String(40), nullable=False)
    acceptable_use_version: Mapped[str] = mapped_column(String(40), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
