"""Shared, bounded authentication request counters."""

from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RateLimit(Base):
    """Rate limit model."""

    __tablename__ = "auth_rate_limits"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)

    count: Mapped[int] = mapped_column(Integer, nullable=False)

    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
