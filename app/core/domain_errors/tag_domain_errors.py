"""Implement tag domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class ExistingName(DomainError):
    """Used when a tag name is already taken."""


class ExistingColor(DomainError):
    """Used when a tag color is already taken."""


class TagNotFound(DomainError):
    """Used when a tag is not found."""


class AlreadyAssigned(DomainError):
    """Used when a tag was already assigned to a task."""
