"""Implement domain errors for better exception handling."""


class DomainError(Exception):
    """Base class for domain-level errors."""


class ExistingEmail(DomainError):
    """Used when registering an existing email."""


class UsernameTaken(DomainError):
    """Used when registering an existing username."""


class InvalidCredentials(DomainError):
    """Used when the user enters invalid credentials."""


class NotFound(DomainError):
    """Used when a resource is not found."""


class InvalidCode(DomainError):
    """Used when entering incorrect code in password reset."""
