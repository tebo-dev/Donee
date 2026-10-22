"""Import necessary libraries for endpoints creation."""

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.task.task import (
    TaskCreate,
    TaskListOut,
    TaskOut,
    TaskStatus,
    TaskUpdate,
)
from app.services.task.task_service import (
    create_task,
    delete_task,
    get_task_for_user,
    get_workspace_tasks,
    update_task,
)

router = APIRouter(tags=["task"])


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def add_new_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create new task."""

    new_task = create_task(db, user.id, payload)
    return new_task


@router.get("/tasks", response_model=TaskListOut)
def return_tasks(
    workspace_id: UUID,
    order_by: (
        Literal["title", "due_at", "priority", "status", "created_at", "id"] | None
    ) = None,
    direction: Literal["asc", "desc"] = "asc",
    search: str | None = Query(default=None, max_length=80),
    statuses: list[TaskStatus] | None = Query(default=None, max_length=5),
    tag_ids: list[UUID] | None = Query(default=None, max_length=50),
    due_from: date | None = None,
    due_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return filtered tasks with filtered total and workspace-wide counts."""
    if due_from and due_to and due_from > due_to:
        raise HTTPException(422, "due_from must not be after due_to")
    return get_workspace_tasks(
        db,
        user.id,
        workspace_id,
        limit,
        offset,
        search=search,
        statuses=statuses,
        tag_ids=tag_ids,
        due_from=due_from,
        due_to=due_to,
        order_by=order_by,
        direction=direction,
    )


@router.get("/tasks/{task_id}", response_model=TaskOut)
def return_specific_task(
    task_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Return specific task by its id."""

    task = get_task_for_user(db, task_id, user.id)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_user_task(
    task_id: UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a specific task."""

    updated_task = update_task(db, task_id, user.id, payload)
    return updated_task


@router.delete("/tasks/{task_id}")
def delete_user_task(
    task_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Delete a specific task."""

    delete_task(db, task_id, user.id)
    return {"message": "Deleted successfully."}
