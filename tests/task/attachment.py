"""Attachment service tests."""

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from app.core.domain_errors.attachment_domain_errors import (
    AlreadyUploaded,
    AttachmentNameTaken,
    AttachmentNotFound,
    InvalidAttachmentStatus,
)
from app.schemas.task.attachment import (
    AttachmentRename,
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
from tests.utils import login_user, register_user


def _create_user_and_task(client, db_session, *, email=None, username=None):
    """Create a user and a task for attachment service tests."""

    email = email or f"{uuid4().hex[:8]}@donee.com"
    username = username or f"user{uuid4().hex[:8]}"

    user_payload = register_user(client, email=email, username=username).json()
    user_id = UUID(user_payload["id"])

    login = login_user(client, email=email)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    workspace = client.get("/workspaces", headers=headers).json()["workspaces"][0]
    task = client.post(
        "/tasks",
        json={
            "title": "Attachment task",
            "description": "Attachment tests",
            "priority": 3,
            "due_at": "2026-05-01",
            "tags": {"add_tag_ids": [], "remove_tag_ids": []},
            "project_id": None,
            "workspace_id": workspace["id"],
        },
        headers=headers,
    ).json()

    task_id = UUID(task["id"])
    return user_id, task_id, headers


def test_add_link_attachment_and_list_it(client, db_session):
    """A link attachment can be created and listed by task."""

    user_id, task_id, _ = _create_user_and_task(client, db_session)

    add_link(
        db_session,
        user_id,
        task_id,
        LinkAttachmentCreate(
            attachment_name="Docs",
            url="https://example.com/docs",
        ),
    )

    attachments = get_task_attachments(db_session, user_id, task_id).attachments
    assert len(attachments) == 1
    assert attachments[0].attachment_type == "link"
    assert attachments[0].attachment_name == "Docs"


def test_duplicate_attachment_name_and_url_raise_domain_errors(client, db_session):
    """Duplicate attachment names and URLs raise domain errors."""

    user_id, task_id, _ = _create_user_and_task(client, db_session)
    payload = LinkAttachmentCreate(
        attachment_name="Docs",
        url="https://example.com/docs",
    )

    add_link(db_session, user_id, task_id, payload)

    with pytest.raises(AttachmentNameTaken):
        add_link(
            db_session,
            user_id,
            task_id,
            LinkAttachmentCreate(
                attachment_name="Docs",
                url="https://example.com/other",
            ),
        )

    with pytest.raises(AlreadyUploaded):
        add_link(
            db_session,
            user_id,
            task_id,
            LinkAttachmentCreate(
                attachment_name="Other docs",
                url="https://example.com/docs",
            ),
        )


def test_add_file_attachment_and_mark_it_uploaded(client, db_session):
    """File attachments can be created and uploaded successfully."""

    user_id, task_id, _ = _create_user_and_task(client, db_session)

    with patch(
        "app.services.task.attachment_service.create_presigned_upload_url",
        return_value=("https://s3-upload.example/upload", 300),
    ):
        upload = add_file(
            db_session,
            user_id,
            task_id,
            FileAttachmentCreate(
                attachment_name="Report",
                original_filename="report.pdf",
                content_type="application/pdf",
                size_bytes=1024,
            ),
        )

    assert upload.upload_url == "https://s3-upload.example/upload"

    with patch(
        "app.services.task.attachment_service.check_s3_object_exists",
        return_value=True,
    ):
        file_attachment_upload_complete(
            db_session, user_id, task_id, upload.attachment_id
        )

    attachments = get_task_attachments(db_session, user_id, task_id).attachments
    assert attachments[0].attachment_type == "file"
    assert attachments[0].status == "uploaded"


def test_file_upload_failed_and_rename_download_delete_flow(client, db_session):
    """A file can fail upload, be renamed, downloaded, and deleted."""

    user_id, task_id, _ = _create_user_and_task(client, db_session)

    with patch(
        "app.services.task.attachment_service.create_presigned_upload_url",
        return_value=("https://s3-upload.example/upload", 300),
    ):
        upload = add_file(
            db_session,
            user_id,
            task_id,
            FileAttachmentCreate(
                attachment_name="Letter",
                original_filename="letter.pdf",
                content_type="application/pdf",
                size_bytes=1024,
            ),
        )

    with patch(
        "app.services.task.attachment_service.check_s3_object_exists",
        return_value=False,
    ):
        file_attachment_upload_failed(
            db_session, user_id, task_id, upload.attachment_id
        )

    rename_attachment(
        db_session,
        user_id,
        task_id,
        upload.attachment_id,
        AttachmentRename(attachment_new_name="Updated letter"),
    )

    with patch(
        "app.services.task.attachment_service.create_presigned_access_url",
        return_value=("https://s3-download.example/download", 300),
    ):
        download = get_download_url(db_session, user_id, task_id, upload.attachment_id)

    assert download.download_url == "https://s3-download.example/download"

    attachments = get_task_attachments(db_session, user_id, task_id).attachments
    assert attachments[0].attachment_name == "Updated letter"

    with patch("app.services.task.attachment_service.delete_s3_object"):
        delete_attachment(db_session, user_id, task_id, upload.attachment_id)

    assert get_task_attachments(db_session, user_id, task_id).attachments == []


def test_missing_attachment_and_invalid_status_are_handled(client, db_session):
    """Missing attachments and invalid status transitions raise domain errors."""

    user_id, task_id, _ = _create_user_and_task(client, db_session)

    with pytest.raises(AttachmentNotFound):
        get_download_url(db_session, user_id, task_id, uuid4())

    with patch(
        "app.services.task.attachment_service.create_presigned_upload_url",
        return_value=("https://s3-upload.example/upload", 300),
    ):
        upload = add_file(
            db_session,
            user_id,
            task_id,
            FileAttachmentCreate(
                attachment_name="Report",
                original_filename="report.pdf",
                content_type="application/pdf",
                size_bytes=1024,
            ),
        )

    with patch(
        "app.services.task.attachment_service.check_s3_object_exists",
        return_value=True,
    ):
        file_attachment_upload_complete(
            db_session, user_id, task_id, upload.attachment_id
        )

    with patch(
        "app.services.task.attachment_service.check_s3_object_exists",
        return_value=True,
    ):
        with pytest.raises(InvalidAttachmentStatus):
            file_attachment_upload_complete(
                db_session,
                user_id,
                task_id,
                upload.attachment_id,
            )
