"""Import necessary libraries for endpoints creation."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.tag.tag import TagCreate, TagEdit, TagListOut, TagOut
from app.services.tag.tag_service import (
    create_tag,
    delete_tag,
    edit_tag,
    get_specific_tag,
    get_workspace_tags,
)

router = APIRouter(tags=["tag"])


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def add_new_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create new tag."""

    new_tag = create_tag(db, user.id, payload)
    return new_tag


@router.get("/tags", response_model=TagListOut)
def return_tags(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all the tags from a workspace."""

    return get_workspace_tags(db, user.id, workspace_id)


@router.get("/tags/{tag_id}", response_model=TagOut)
def return_specific_tag(
    tag_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Return a specific tag from a workspace."""

    tag = get_specific_tag(db, user.id, tag_id)
    return tag


@router.patch("/tags/{tag_id}", response_model=TagOut)
def edit_workspace_tag(
    tag_id: UUID,
    payload: TagEdit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Edit a specific tag."""

    tag = edit_tag(db, user.id, tag_id, payload)
    return tag


@router.delete("/tags/{tag_id}")
def delete_workspace_tag(
    tag_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Delete a specefic tag."""

    delete_tag(db, user.id, tag_id)
    return {"message": "Deleted successfully."}
