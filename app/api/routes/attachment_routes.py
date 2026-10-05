"""Import necessary libraries for endpoints creation."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.task.attachment import (
    AttachmentDownloadUrlOut,
    AttachmentListOut,
    AttachmentRename,
    AttachmentUploadUrlOut,
    FileAttachmentCreate,
    LinkAttachmentCreate,
)
from app.services.task.attachment_service import (
    add_file,
    add_link,
    delete_attachment,
    file_attachment_upload_complete,
    file_attachment_upload_failed,
    get_download_url,
    get_task_attachments,
    rename_attachment,
)

router = APIRouter(tags=["attachment"])


@router.post(
    "/tasks/attachments/link",
    status_code=status.HTTP_201_CREATED,
)
def add_new_link(
    payload: LinkAttachmentCreate,
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a link attachment to a task."""

    add_link(db, user.id, task_id, payload)
    return {"message": "attachment added"}


@router.post(
    "/tasks/attachments/file",
    response_model=AttachmentUploadUrlOut,
    status_code=status.HTTP_201_CREATED,
)
def add_new_file(
    payload: FileAttachmentCreate,
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a file attachment and return its upload URL."""

    return add_file(db, user.id, task_id, payload)


@router.patch("/tasks/{task_id}/attachments/{attachment_id}/uploaded")
def attachment_upload_complete(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark a file attachment upload as complete."""

    file_attachment_upload_complete(db, user.id, task_id, attachment_id)
    return {"message": "attachment uploaded successfully"}


@router.patch("/tasks/{task_id}/attachments/{attachment_id}/failed")
def attachment_upload_failed(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark a file attachment upload as failed."""

    file_attachment_upload_failed(db, user.id, task_id, attachment_id)
    return {"message": "attachment upload failed, try again"}


@router.get(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentListOut,
)
def return_task_attachments(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a task's attachments."""

    return get_task_attachments(db, user.id, task_id)


@router.patch("/tasks/{task_id}/attachments/{attachment_id}")
def rename_task_attachment(
    task_id: UUID,
    attachment_id: UUID,
    payload: AttachmentRename,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rename an attachment."""

    rename_attachment(db, user.id, task_id, attachment_id, payload)
    return {"message": "attachment renamed successfully"}


@router.get(
    "/tasks/{task_id}/attachments/{attachment_id}/download",
    response_model=AttachmentDownloadUrlOut,
)
def download_task_attachment(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a presigned URL for downloading an attachment."""

    return get_download_url(db, user.id, task_id, attachment_id)


@router.delete("/tasks/{task_id}/attachments/{attachment_id}/")
def delete_task_attachment(
    task_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an attachment."""

    delete_attachment(db, user.id, task_id, attachment_id)
    return {"message": "attachment deleted successfully"}
