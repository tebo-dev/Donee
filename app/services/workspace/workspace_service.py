"""Import necessary libraries for workspace services."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.domain_errors.workspace_domain_errors import (
    ExistingWorkspaceName,
    NotOwned,
    WorkspaceNotFound,
)
from app.models.workspace.workspace import Workspace
from app.models.workspace.workspace_member import WorkspaceMember
from app.schemas.workspace.workspace import (
    WorkspaceCreation,
    WorkspaceListOut,
    WorkspaceUpdate,
)

# Helpers


def get_workspace_by_name(db: Session, user_id: UUID, workspace_name: str):
    """Get a workspace by its name"""

    stmt = select(Workspace).where(
        Workspace.owner_id == user_id, Workspace.name == workspace_name
    )
    return db.execute(stmt).scalars().first()


def get_workspace_by_id(db: Session, workspace_id: UUID):
    """Get a workspace by its id."""

    stmt = select(Workspace).where(Workspace.id == workspace_id)
    found_workspace = db.execute(stmt).scalars().first()

    return found_workspace


# Main service


def create_workspace(db: Session, user_id: UUID, workspace_data: WorkspaceCreation):
    """Create a new workspace."""

    if get_workspace_by_name(db, user_id, workspace_data.name):
        raise ExistingWorkspaceName()

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


def create_default_workspace_for_user(db: Session, user_id: UUID):
    """Create a default workspace when a new user registers."""

    default_workspace = WorkspaceCreation(
        name="My Space",
    )

    create_workspace(db, user_id, default_workspace)


def get_user_workspaces(db: Session, user_id: UUID):
    """List an user workspaces."""

    stmt = select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id, WorkspaceMember.role == "owner"
    )
    workspaces_ids = db.execute(stmt).scalars().all()

    if not workspaces_ids:
        return []

    user_workspaces = (
        db.execute(select(Workspace).where(Workspace.id.in_(workspaces_ids)))
        .scalars()
        .all()
    )

    return WorkspaceListOut(workspaces=user_workspaces)


def get_workspace_for_user(db: Session, workspace_id: UUID, user_id: UUID):
    """Get specific workspace of an user."""

    workspace = get_workspace_by_id(db, workspace_id)

    if not workspace:
        raise WorkspaceNotFound()
    if workspace.owner_id != user_id:
        raise NotOwned()

    return workspace


def rename_workspace(
    db: Session, workspace_id: UUID, user_id: UUID, update: WorkspaceUpdate
):
    """Update workspace name."""

    workspace = get_workspace_by_id(db, workspace_id)

    if workspace.owner_id != user_id:
        raise NotOwned()
    if get_workspace_by_name(db, user_id, update.name):
        raise ExistingWorkspaceName()

    workspace.name = update.name

    db.commit()


def user_has_access(db: Session, user_id: UUID, workspace_id: UUID):
    """Verify if a specific user has access to a workspace"""

    stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
    )
    record = db.execute(stmt).scalars().first()

    if record:
        return True

    return False
