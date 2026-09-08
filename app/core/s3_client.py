"""Import the necessary libraries for S3 client set up."""

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_s3_client() -> BaseClient:
    """Create and cache an S3 client."""

    s3_client = boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY.get_secret_value(),
    )
    return s3_client


UPLOAD_URL_EXPIRES_IN_SECONDS = 300
ACCESS_URL_EXPIRES_IN_SECONDS = 300

PREVIEWABLE_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}


def build_attachment_storage_key(
    user_id: UUID, task_id: UUID, attachment_id: UUID, original_filename: str
) -> str:
    """Build the S3 object name for a task attachment."""

    extension = Path(original_filename).suffix.lower()

    return f"attachments/users/{user_id}/tasks/{task_id}/{attachment_id}{extension}"


def build_content_disposition(disposition_type: str, filename: str) -> str:
    """Build a safe Content-Disposition header value"""

    safe_fallback = filename.replace('"', "").replace("\\", "")
    encoded_filename = quote(filename)

    return (
        f"{disposition_type}; "
        f"filename={safe_fallback}; "
        f"filename*=UTF-8''{encoded_filename}"
    )


def check_s3_object_exists(storage_key: str) -> bool:
    """Check if an S3 object exists."""

    s3 = get_s3_client()

    try:
        s3.head_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=storage_key)
        return True
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            return False
        raise


def create_presigned_upload_url(
    storage_key: str, content_type: str, expires_in: int = UPLOAD_URL_EXPIRES_IN_SECONDS
) -> str:
    """Create a pre signed URL to upload a file to S3 bucket."""

    s3 = get_s3_client()

    return (
        s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.AWS_S3_BUCKET_NAME,
                "Key": storage_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        ),
        expires_in,
    )


def create_presigned_access_url(
    storage_key: str,
    content_type: str,
    original_filename: str,
    mode: str,
    expires_in: int = UPLOAD_URL_EXPIRES_IN_SECONDS,
) -> str:
    """Create a pre signed URL to upload a file to S3 bucket."""

    if mode == "preview" and content_type not in PREVIEWABLE_CONTENT_TYPES:
        raise ValueError("This file type cannot be previewed.")

    disposition_type = "inline" if mode == "preview" else "attachment"

    s3 = get_s3_client()

    return (
        s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": settings.AWS_S3_BUCKET_NAME,
                "Key": storage_key,
                "ResponseContentType": content_type,
                "ResponseContentDisposition": build_content_disposition(
                    disposition_type=disposition_type,
                    filename=original_filename,
                ),
            },
            ExpiresIn=expires_in,
            HttpMethod="GET",
        ),
        expires_in,
    )


def delete_s3_object(storage_key: str) -> None:
    """Delete an object from S3 bucket."""

    s3 = get_s3_client()

    s3.delete_object(
        Bucket=settings.AWS_S3_BUCKET_NAME,
        Key=storage_key,
    )
