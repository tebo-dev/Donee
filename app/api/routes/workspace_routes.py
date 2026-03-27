"""Import necessary libraries for endpoints creation."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.workspace.workspace import (
    WorkspaceCreation,
    WorkspaceListOut,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.services.workspace.workspace_service import (
    create_workspace,
    get_user_workspaces,
    get_workspace_for_user,
    rename_workspace,
)

router = APIRouter(tags=["workspace"])


@router.get("/workspaces", response_model=WorkspaceListOut)
def return_user_workspaces(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Return all the workspaces of the authenticated user."""

    workspaces = get_user_workspaces(db, user.id)
    return workspaces


@router.post(
    "/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED
)
def add_new_workspace(
    payload: WorkspaceCreation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create new workspace."""

    new_workspace = create_workspace(db, user.id, payload)
    return new_workspace


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def return_specific_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get specific workspace by its id."""

    found_workspace = get_workspace_for_user(db, workspace_id, user.id)
    return found_workspace


@router.patch("/workspaces/{workspace_id}")
def edit_workspace_name(
    workspace_id: UUID,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Edit specific workspace name by its id."""

    rename_workspace(db, workspace_id, user.id, payload)
    return {"message": "Updated successfully."}
