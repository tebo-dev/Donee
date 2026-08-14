"""Implement tag domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class AlreadyUploaded(DomainError):
    """Used when an attachment is already uploaded."""


class AttachmentNotFound(DomainError):
    """Used when an attachment is not found."""
