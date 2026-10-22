"""Import necessary libraries for workspace services."""

from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from app.core.domain_errors.workspace_domain_errors import (
    ExistingWorkspaceName,
    NotAuthorized,
    WorkspaceNotFound,
)
from app.core.resource_limits import enforce_quota
from app.core.s3_client import delete_s3_object
from app.models.auth.user import User
from app.models.task.attachment import Attachment
from app.models.task.task import Task
from app.models.workspace.workspace import Workspace
from app.models.workspace.workspace_member import WorkspaceMember
from app.schemas.workspace.workspace import (
    WorkspaceCreation,
    WorkspaceListOut,
    WorkspaceUpdate,
)

# Helpers


def get_workspace_by_name(db: Session, user_id: UUID, workspace_name: str) -> Workspace:
    """Get a workspace by its name."""

    stmt = select(Workspace).where(
        Workspace.owner_id == user_id, Workspace.name == workspace_name
    )
    return db.execute(stmt).scalars().first()


def get_workspace_by_id(db: Session, workspace_id: UUID) -> Workspace:
    """Get a workspace by its id."""

    stmt = select(Workspace).where(Workspace.id == workspace_id)
    found_workspace = db.execute(stmt).scalars().first()

    return found_workspace


# Main service


def user_has_access(db: Session, user_id: UUID, workspace_id: UUID) -> bool:
    """Verify if a specific user has access to a workspace."""

    stmt = select(
        exists().where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return bool(db.execute(stmt).scalar())


def create_workspace(
    db: Session, user_id: UUID, workspace_data: WorkspaceCreation
) -> Workspace:
    """Create a new workspace."""

    if get_workspace_by_name(db, user_id, workspace_data.name):
        raise ExistingWorkspaceName()

    enforce_quota(db, user_id, Workspace, Workspace.owner_id == user_id, 50)

    new_workspace = Workspace(
        owner_id=user_id,
        name=workspace_data.name,
    )

    db.add(new_workspace)
    db.flush()

    workspace_owner = WorkspaceMember(
        workspace_id=new_workspace.id,
        user_id=user_id,
        role="owner",
    )

    db.add(workspace_owner)
    db.commit()
    db.refresh(new_workspace)

    return new_workspace


def create_default_workspace_for_user(db: Session, user_id: UUID) -> None:
    """Create a default workspace when a new user registers."""

    workspace = Workspace(owner_id=user_id, name="My Space")
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user_id, role="owner"))


def get_user_workspaces(db: Session, user_id: UUID) -> WorkspaceListOut:
    """List an user workspaces."""

    stmt = select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id, WorkspaceMember.role == "owner"
    )
    workspaces_ids = db.execute(stmt).scalars().all()

    if not workspaces_ids:
        return WorkspaceListOut(workspaces=[])

    user_workspaces = (
        db.execute(select(Workspace).where(Workspace.id.in_(workspaces_ids)))
        .scalars()
        .all()
    )

    return WorkspaceListOut(workspaces=user_workspaces)


def get_workspace_for_user(db: Session, workspace_id: UUID, user_id: UUID) -> Workspace:
    """Get specific workspace of an user."""

    workspace = get_workspace_by_id(db, workspace_id)
    has_access = user_has_access(db, user_id, workspace_id)

    if not workspace:
        raise WorkspaceNotFound()
    if has_access is False:
        raise NotAuthorized()

    return workspace


def rename_workspace(
    db: Session, workspace_id: UUID, user_id: UUID, update: WorkspaceUpdate
) -> None:
    """Update workspace name."""

    workspace = get_workspace_by_id(db, workspace_id)
    duplicate = get_workspace_by_name(db, user_id, update.name)

    if not workspace:
        raise WorkspaceNotFound()

    if workspace.owner_id != user_id:
        raise NotAuthorized()
    if duplicate and duplicate.id != workspace.id:
        raise ExistingWorkspaceName()

    updated_data = update.model_dump(exclude_unset=True)

    for field, value in updated_data.items():
        setattr(workspace, field, value)

    db.commit()


def delete_workspace(db: Session, workspace_id: UUID, user_id: UUID) -> None:
    """Remove stored files before deleting records; retry on S3 failure."""
    # Serialize against task/attachment creation, which also locks the owner row.
    db.execute(
        update(User).where(User.id == user_id).values(token_version=User.token_version)
    )
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise WorkspaceNotFound()
    if workspace.owner_id != user_id:
        raise NotAuthorized()
    keys = db.scalars(
        select(Attachment.storage_key)
        .join(Task)
        .where(Task.workspace_id == workspace_id, Attachment.storage_key.is_not(None))
    ).all()
    try:
        for key in keys:
            delete_s3_object(key)
    except (BotoCoreError, ClientError):
        db.rollback()
        raise HTTPException(
            503, "Workspace file cleanup failed. Retry deletion."
        ) from None
    db.delete(workspace)
    db.commit()
