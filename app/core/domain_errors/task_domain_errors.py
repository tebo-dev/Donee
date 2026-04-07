"""Implement task domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class TaskNotFound(DomainError):
    """Used when a task is not found."""


class InvalidOrderParameter(DomainError):
    """Used when an invalid order parameter is passed."""
