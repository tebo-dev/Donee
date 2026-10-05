"""Import necessary libraries for attachment services."""

from uuid import UUID, uuid4

from sqlalchemy import delete, exists, select, update
from sqlalchemy.orm import Session

from app.core.domain_errors.attachment_domain_errors import (
    AlreadyUploaded,
    AttachmentInBucket,
    AttachmentNameTaken,
    AttachmentNotFound,
    AttachmentNotInBucket,
    InvalidAttachmentStatus,
)
from app.core.domain_errors.workspace_domain_errors import NotAuthorized
from app.core.permissions import (
    can_add_attachment,
    can_delete_attachment,
    can_download_attachment,
    can_edit_attachment_name,
    can_view_attachment,
)
from app.core.s3_client import (
    build_attachment_storage_key,
    check_s3_object_exists,
    create_presigned_access_url,
    create_presigned_upload_url,
    delete_s3_object,
)
from app.models.task.attachment import Attachment
from app.models.task.task import Task
from app.schemas.task.attachment import (
    AttachmentDownloadUrlOut,
    AttachmentListOut,
    AttachmentRename,
    AttachmentUploadUrlOut,
    FileAttachmentCreate,
    FileAttachmentOut,
    LinkAttachmentCreate,
    LinkAttachmentOut,
)
from app.services.task.task_service import get_member

# Helpers


def get_workspace_id(db: Session, task_id: UUID) -> UUID | None:
    """Return the current workspace id."""

    stmt = select(Task.workspace_id).where(Task.id == task_id)
    return db.execute(stmt).scalar()


def get_storage_key(db: Session, task_id: UUID, attachment_id: UUID) -> str | None:
    """Return the storage key from an attachment."""

    stmt = select(Attachment.storage_key).where(
        Attachment.id == attachment_id, Attachment.task_id == task_id
    )
    return db.execute(stmt).scalar()


def get_attachment_status(
    db: Session, task_id: UUID, attachment_id: UUID
) -> str | None:
    """Return attachment status."""

    stmt = select(Attachment.status).where(
        Attachment.id == attachment_id, Attachment.task_id == task_id
    )
    return db.execute(stmt).scalar()


def validate_attachment_existence(
    db: Session, task_id: UUID, attachment_id: UUID
) -> bool:
    """Check whether an attachment exists."""

    stmt = select(
        exists().where(
            Attachment.task_id == task_id,
            Attachment.id == attachment_id,
        )
    )
    return bool(db.execute(stmt).scalar())


def validate_attachment_name(db: Session, task_id: UUID, attachment_name: str) -> bool:
    """Check whether a user already has an attachment with this name."""

    stmt = select(
        exists().where(
            Attachment.task_id == task_id,
            Attachment.attachment_name == attachment_name,
        )
    )
    return bool(db.execute(stmt).scalar())


def validate_link_url(db: Session, task_id: UUID, url: str) -> bool:
    """Check whether a user already has an attachment with this URL."""

    stmt = select(
        exists().where(
            Attachment.task_id == task_id,
            Attachment.attachment_type == "link",
            Attachment.url == url,
        )
    )
    return bool(db.execute(stmt).scalar())


def validate_file_original_name(
    db: Session, task_id: UUID, original_filename: str
) -> bool:
    """Check whether a user already has a file with this original filename."""

    stmt = select(
        exists().where(
            Attachment.task_id == task_id,
            Attachment.attachment_type == "file",
            Attachment.original_filename == original_filename,
        )
    )
    return bool(db.execute(stmt).scalar())


def _get_task_and_member(db: Session, user_id: UUID, task_id: UUID):
    """Return the task and current workspace member."""

    workspace_id = get_workspace_id(db, task_id)
    if workspace_id is None:
        raise NotAuthorized()

    task = db.execute(select(Task).where(Task.id == task_id)).scalars().first()
    curr_member = get_member(db, user_id, workspace_id)
    if not curr_member or not task:
        raise NotAuthorized()

    return task, curr_member


def _validate_permission(
    curr_member,
    task: Task,
    user_id: UUID,
    permission,
) -> None:
    """Validate a member's task-specific attachment permission."""

    if not permission(curr_member.role, task.created_by, task.assignee_id, user_id):
        raise NotAuthorized()


# Main services


def add_link(
    db: Session, user_id: UUID, task_id: UUID, link_data: LinkAttachmentCreate
) -> None:
    """Add a link attachment to a task."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_add_attachment)

    if validate_attachment_name(db, task_id, link_data.attachment_name):
        raise AttachmentNameTaken()
    if validate_link_url(db, task_id, str(link_data.url)):
        raise AlreadyUploaded()

    new_link = Attachment(
        task_id=task_id,
        uploader_id=user_id,
        attachment_type="link",
        attachment_name=link_data.attachment_name,
        url=str(link_data.url),
        status="uploaded",
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)


def add_file(
    db: Session, user_id: UUID, task_id: UUID, file_data: FileAttachmentCreate
) -> AttachmentUploadUrlOut:
    """Create a pending file attachment and return its upload URL."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_add_attachment)

    attachment_name = file_data.attachment_name or file_data.original_filename
    if validate_attachment_name(db, task_id, attachment_name):
        raise AttachmentNameTaken()
    if validate_file_original_name(db, task_id, file_data.original_filename):
        raise AlreadyUploaded()

    attachment_id = uuid4()
    storage_key = build_attachment_storage_key(
        user_id, task_id, attachment_id, file_data.original_filename
    )
    new_file = Attachment(
        id=attachment_id,
        task_id=task_id,
        uploader_id=user_id,
        attachment_type="file",
        attachment_name=attachment_name,
        original_filename=file_data.original_filename,
        storage_key=storage_key,
        content_type=file_data.content_type,
        size_bytes=file_data.size_bytes,
        status="pending",
    )
    db.add(new_file)
    db.commit()

    upload_url, expires_in = create_presigned_upload_url(
        storage_key, file_data.content_type
    )
    return AttachmentUploadUrlOut(
        attachment_id=attachment_id,
        upload_url=upload_url,
        expires_in_seconds=expires_in,
    )


def file_attachment_upload_complete(
    db: Session, user_id: UUID, task_id: UUID, attachment_id: UUID
) -> None:
    """Mark a pending file attachment as uploaded."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_edit_attachment_name)

    storage_key = get_storage_key(db, task_id, attachment_id)
    if not storage_key:
        raise AttachmentNotFound()
    if not check_s3_object_exists(storage_key):
        raise AttachmentNotInBucket()
    if get_attachment_status(db, task_id, attachment_id) != "pending":
        raise InvalidAttachmentStatus()

    db.execute(
        update(Attachment)
        .where(Attachment.id == attachment_id, Attachment.task_id == task_id)
        .values(status="uploaded")
    )
    db.commit()


def file_attachment_upload_failed(
    db: Session, user_id: UUID, task_id: UUID, attachment_id: UUID
) -> None:
    """Mark a pending file attachment as failed."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_edit_attachment_name)

    storage_key = get_storage_key(db, task_id, attachment_id)
    if not storage_key:
        raise AttachmentNotFound()
    if check_s3_object_exists(storage_key):
        raise AttachmentInBucket()
    if get_attachment_status(db, task_id, attachment_id) != "pending":
        raise InvalidAttachmentStatus()

    db.execute(
        update(Attachment)
        .where(Attachment.id == attachment_id, Attachment.task_id == task_id)
        .values(status="failed")
    )
    db.commit()


def get_task_attachments(
    db: Session, user_id: UUID, task_id: UUID
) -> AttachmentListOut:
    """Return all attachments belonging to a task."""

    _, curr_member = _get_task_and_member(db, user_id, task_id)
    if not can_view_attachment(curr_member.role):
        raise NotAuthorized()

    attachments = (
        db.execute(select(Attachment).where(Attachment.task_id == task_id))
        .scalars()
        .all()
    )
    attachment_schemas = []
    for attachment in attachments:
        if attachment.attachment_type == "link":
            attachment_schemas.append(
                LinkAttachmentOut.model_validate(attachment, from_attributes=True)
            )
        else:
            attachment_schemas.append(
                FileAttachmentOut.model_validate(attachment, from_attributes=True)
            )
    return AttachmentListOut(attachments=attachment_schemas)


def rename_attachment(
    db: Session,
    user_id: UUID,
    task_id: UUID,
    attachment_id: UUID,
    attachment_data: AttachmentRename,
) -> None:
    """Rename an attachment without changing its S3 object."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_edit_attachment_name)

    if not validate_attachment_existence(db, task_id, attachment_id):
        raise AttachmentNotFound()

    db.execute(
        update(Attachment)
        .where(Attachment.id == attachment_id, Attachment.task_id == task_id)
        .values(attachment_name=attachment_data.attachment_new_name)
    )
    db.commit()


def get_download_url(
    db: Session, user_id: UUID, task_id: UUID, attachment_id: UUID
) -> AttachmentDownloadUrlOut:
    """Return a presigned download URL for an attachment."""

    _, curr_member = _get_task_and_member(db, user_id, task_id)
    if not can_download_attachment(curr_member.role):
        raise NotAuthorized()

    if not validate_attachment_existence(db, task_id, attachment_id):
        raise AttachmentNotFound()

    attachment = (
        db.execute(
            select(Attachment).where(
                Attachment.id == attachment_id, Attachment.task_id == task_id
            )
        )
        .scalars()
        .first()
    )
    if not attachment or not attachment.storage_key:
        raise AttachmentNotFound()

    download_url, expires_in = create_presigned_access_url(
        attachment.storage_key,
        attachment.content_type,
        attachment.original_filename,
        mode="download",
    )
    return AttachmentDownloadUrlOut(
        download_url=download_url,
        expires_in_seconds=expires_in,
    )


def delete_attachment(
    db: Session, user_id: UUID, task_id: UUID, attachment_id: UUID
) -> None:
    """Delete an attachment record and its S3 object when present."""

    task, curr_member = _get_task_and_member(db, user_id, task_id)
    _validate_permission(curr_member, task, user_id, can_delete_attachment)

    if not validate_attachment_existence(db, task_id, attachment_id):
        raise AttachmentNotFound()

    storage_key = get_storage_key(db, task_id, attachment_id)
    db.execute(
        delete(Attachment).where(
            Attachment.id == attachment_id, Attachment.task_id == task_id
        )
    )
    db.commit()

    if storage_key:
        delete_s3_object(storage_key)
