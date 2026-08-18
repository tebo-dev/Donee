"""Import the necessary libraries for tasks schemas implementation."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

# Requests


class LinkAttachmentCreate(BaseModel):
    """Schema for creating link-type attachments."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    attachment_name: str = Field(default="Untitled link", max_length=155)
    url: HttpUrl = Field(max_length=2000)
    task_id: UUID


class FileAttachmentCreate(BaseModel):
    """Schema for creating file-type attachments."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    attachment_name: str | None = Field(default=None, max_length=155)
    original_filename: str = Field(min_length=1, max_length=155)
    content_type: str
    syze_bytes: int = Field(gt=0, le=10 * 1024 * 1024)
    task_id: UUID

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        """Validates that the uploaded file is within the supported formats."""

        supported_types = {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "text/plain",
        }

        if value not in supported_types:
            raise ValueError("Unsupported file type.")

        return value


# Responses


class LinkAttachmentOut(BaseModel):
    """Schema for returning link-type attachments."""

    id: UUID
    attachment_type: str
    attachment_name: str
    url: HttpUrl
    created_at: datetime


class FileAttachmentOut(BaseModel):
    """Schema for returning file-type attachments."""

    id: UUID
    attachment_type: str
    attachment_name: str
    original_filename: str
    content_type: str
    size_bytes: int
    status: str
    created_at: datetime


AttachmentOut = Annotated[
    LinkAttachmentOut | FileAttachmentOut,
    Field(discriminator="type"),
]


class AttachmentListOut(BaseModel):
    """Schema for returning all the attachments from a taks."""

    attachments: list[AttachmentOut]


class AttachmentUploadUrlOut(BaseModel):
    """Schema for returning a S3 upload url."""

    upload_url: str
    expires_in_seconds: int


class AttachmentDownloadUrlOut(BaseModel):
    """Schema for returning a S3 download url."""

    download_url: str
    expires_in_seconds: int
