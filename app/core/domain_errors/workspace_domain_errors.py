"""Implement workspace domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class ExistingWorkspaceName(DomainError):
    """Used when creating a workspace with the name of an existing one."""


class NotOwned(DomainError):
    """Used when an users tries to edit a not-owned workspace"""


class WorkspaceNotFound(DomainError):
    """Used when a workspace is not found."""
