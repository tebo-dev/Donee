"""Import necessary libraries for endpoints creation."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.auth.user import User
from app.schemas.task.task import TaskCreate, TaskListOut, TaskOut, TaskUpdate
from app.services.task.task_service import (
    create_task,
    delete_task,
    get_task_for_user,
    get_workspace_tasks,
    order_tasks,
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
    order_by: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all the tasks from a workspace."""

    if order_by:
        return order_tasks(db, user.id, workspace_id, order_by)
    return get_workspace_tasks(db, user.id, workspace_id)


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
    """Update an specific task."""

    updated_task = update_task(db, task_id, user.id, payload)
    return updated_task


@router.delete("/tasks/{task_id}")
def delete_user_task(
    task_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Delete an specific task."""

    delete_task(db, task_id, user.id)
    return {"message": "Deleted successfully."}
