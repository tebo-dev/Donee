"""Implement tag domain errors for better exception handling."""

from app.core.domain_errors.base import DomainError


class AlreadyUploaded(DomainError):
    """Used when an attachment is already uploaded."""


class AttachmentNameTaken(DomainError):
    """Used when an attachment name is already taken."""


class AttachmentNotFound(DomainError):
    """Used when an attachment is not found."""


class InvalidAttachmentStatus(DomainError):
    """Used when trying to edit an attachment status that was already updated."""


class AttachmentNotInBucket(DomainError):
    """Used when an attachment failed to be uploaded to S3."""


class AttachmentInBucket(DomainError):
    """Used when attempting to mark an attachment upload as failed
    when the attachment is on S3."""
