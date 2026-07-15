"""Import necessary libraries for workspace tags services."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.domain_errors.tag_domain_errors import (
    ExistingColor,
    ExistingName,
    TagNotFound,
)
from app.core.domain_errors.workspace_domain_errors import NotAuthorized
from app.core.permissions import can_create_tag, can_delete_tag, can_edit_tag
from app.models.tag.tag import Tag
from app.schemas.tag.tag import TagCreate, TagEdit, TagListOut
from app.services.task.task_service import get_member
from app.utils.colors import random_hex_color

# Helpers


def validate_tag_name(db: Session, tag_name: str, workspace_id: UUID) -> bool:
    """Confirms if a tag name is already taken."""

    stmt = select(Tag).where(Tag.workspace_id == workspace_id, Tag.name == tag_name)
    record = db.execute(stmt).scalars().first()

    if record:
        return True
    return False


def validate_tag_color(db: Session, tag_color: str, workspace_id: UUID) -> bool:
    """Confirms if a tag of a specific color already exists."""

    stmt = select(Tag).where(Tag.workspace_id == workspace_id, Tag.color == tag_color)
    record = db.execute(stmt).scalars().first()

    if record:
        return True
    return False


# Main service


def create_tag(db: Session, user_id: UUID, tag_data: TagCreate) -> Tag:
    """Create a new tag."""

    curr_member = get_member(db, user_id, tag_data.workspace_id)

    if not curr_member or not can_create_tag(curr_member.role):
        raise NotAuthorized()

    if validate_tag_name(db, tag_data.name, tag_data.workspace_id):
        raise ExistingName()

    if validate_tag_color(db, tag_data.color, tag_data.workspace_id):
        raise ExistingColor()

    if not tag_data.color:
        tag_data.color = random_hex_color()

    new_tag = Tag(
        workspace_id=tag_data.workspace_id,
        name=tag_data.name,
        color=tag_data.color.upper(),
    )

    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)

    return new_tag


def get_workspace_tags(db: Session, user_id: UUID, workspace_id: UUID) -> TagListOut:
    """Return all the tags from a workspace."""

    curr_member = get_member(db, user_id, workspace_id)

    if not curr_member:
        raise NotAuthorized()

    stmt = select(Tag).where(Tag.workspace_id == workspace_id)
    workspace_tags = db.execute(stmt).scalars().all()

    return TagListOut(
        tags=workspace_tags,
        total=len(workspace_tags),
    )


def get_specific_tag(db: Session, user_id: UUID, tag_id: UUID) -> Tag:
    """Return a specefic tag."""

    stmt = select(Tag).where(Tag.id == tag_id)
    tag = db.execute(stmt).scalars().first()

    if not tag:
        raise TagNotFound()

    curr_member = get_member(db, user_id, tag.workspace_id)

    if not curr_member:
        raise NotAuthorized()

    return tag


def edit_tag(db: Session, user_id: UUID, tag_id: UUID, tag_edit: TagEdit) -> Tag:
    """Edit an existing tag and return it."""

    stmt = select(Tag).where(Tag.id == tag_id)
    tag = db.execute(stmt).scalars().first()

    if not tag:
        raise TagNotFound()

    if validate_tag_name(db, tag_edit.name, tag_edit.workspace_id):
        raise ExistingName()

    if validate_tag_color(db, tag_edit.color, tag_edit.workspace_id):
        raise ExistingColor()

    curr_member = get_member(db, user_id, tag.workspace_id)

    if not curr_member or not can_edit_tag(curr_member.role):
        raise NotAuthorized()

    tag.name = tag_edit.name
    tag.color = tag_edit.color

    db.commit()

    return tag


def delete_tag(db: Session, user_id: UUID, tag_id: UUID) -> None:
    """Delete a tag."""

    stmt = select(Tag).where(Tag.id == tag_id)
    tag = db.execute(stmt).scalars().first()

    if not tag:
        raise TagNotFound()

    curr_member = get_member(db, user_id, tag.workspace_id)

    if not curr_member or not can_delete_tag(curr_member.role):
        raise NotAuthorized()

    db.delete(tag)
    db.commit()
