"""Implement project domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class ProjectNotFound(DomainError):
    """Used when a project is not found."""
