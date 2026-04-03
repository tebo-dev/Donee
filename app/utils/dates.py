"""Useful functions for date formatting."""

from datetime import datetime, timezone


def normalize_utc(dt: datetime) -> datetime:
    """Ensure DB datetime is timezone-aware UTC."""

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
