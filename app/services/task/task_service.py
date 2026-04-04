"""Import necessary libraries for task services."""

from uuid import UUID

from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.core.domain_errors.project_domain_errors import ProjectNotFound
from app.core.domain_errors.task_domain_errors import TaskNotFound
from app.core.domain_errors.workspace_domain_errors import NotAuthorized
from app.core.permissions import (
    can_create_task,
    can_delete_task,
    can_edit_project,
    can_edit_task,
)
from app.models.project.project import Project
from app.models.task.task import Task
from app.models.workspace.workspace_member import WorkspaceMember
from app.schemas.task.task import TaskCreate, TaskListOut, TaskUpdate

# Helpers


def get_member(
    db: Session, user_id: UUID, workspace_id: UUID
) -> WorkspaceMember | None:
    """Returns a workspace member if it exists."""

    stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
    )
    return db.execute(stmt).scalars().first()


def validate_project(db: Session, project_id: UUID, workspace_id: UUID) -> bool:
    """Verify that a project exist in a workspace."""

    stmt = select(Project).where(
        Project.id == project_id and Project.workspace_id == workspace_id
    )
    record = db.execute(stmt).scalars().first()

    if record:
        return True
    return False


# Main service


def create_task(db: Session, user_id: UUID, task_data: TaskCreate) -> Task | None:
    """Create a new task."""

    curr_member = get_member(db, user_id, task_data.workspace_id)

    if not curr_member or not can_create_task(curr_member.role):
        raise NotAuthorized()

    if task_data.project_id:
        if not validate_project(db, task_data.project_id, task_data.workspace_id):
            raise ProjectNotFound()

        if not can_edit_project(curr_member.role):
            raise NotAuthorized()

    new_task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        due_at=task_data.due_date,
        project_id=task_data.project_id,
        workspace_id=task_data.workspace_id,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


def get_workspace_tasks(db: Session, user_id: UUID, workspace_id: UUID) -> TaskListOut:
    """Return all the tasks from a workspace."""

    curr_member = get_member(db, user_id, workspace_id)

    if not curr_member:
        raise NotAuthorized()

    stmt = select(Task).where(Task.workspace_id == workspace_id)
    workspace_tasks = db.execute(stmt).scalars().all()

    return TaskListOut(tasks=workspace_tasks)


def get_task_for_user(db: Session, task_id: UUID, user_id: UUID) -> Task:
    """Return a specific task."""

    stmt = select(Task).where(Task.id == task_id)
    task = db.execute(stmt).scalars().first()

    if not task:
        raise TaskNotFound()

    curr_member = get_member(db, user_id, task.workspace_id)

    if not curr_member:
        raise NotAuthorized()

    return task


def update_task(
    db: Session, task_id: UUID, user_id: UUID, task_update: TaskUpdate
) -> Task:
    """Update an existing task and return it."""

    stmt = select(Task).where(Task.id == task_id)
    task = db.execute(stmt).scalars().first()

    if not task:
        raise TaskNotFound()

    curr_member = get_member(db, user_id, task.workspace_id)

    if not curr_member or not can_edit_task(
        curr_member.role, task.created_by, task.assignee_id, curr_member.user_id
    ):
        raise NotAuthorized()

    task.title = task_update.title
    task.description = task_update.description
    task.priority = task_update.priority
    task.due_at = task_update.due_date
    task.project_id = task_update.project_id
    task.workspace_id = task_update.workspace_id

    db.commit()

    return task


def delete_task(db: Session, task_id: UUID, user_id: UUID):
    """Delete a task."""

    stmt = select(Task).where(Task.id == task_id)
    task = db.execute(stmt).scalars().first()

    if not task:
        raise TaskNotFound()

    curr_member = get_member(db, user_id, task.workspace_id)

    if not curr_member or not can_delete_task(
        curr_member.role, task.created_by, curr_member.user_id
    ):
        raise NotAuthorized()

    db.delete(task)
    db.commit()


def order_tasks(
    db: Session, user_id: UUID, workspace_id: UUID, order_by: str
) -> TaskListOut:
    """Order task by different parameters."""

    curr_member = get_member(db, user_id, workspace_id)

    if not curr_member:
        raise NotAuthorized()

    stmt = select(Task).where(Task.workspace_id == workspace_id)

    if order_by == "status":
        status_order = case(
            (Task.status == "to_do", 1),
            (Task.status == "in_progress", 2),
            (Task.status == "done", 3),
            (Task.status == "blocked", 4),
            (Task.status == "archived", 5),
        )
        stmt = stmt.order_by(status_order)

    elif order_by == "priority":
        stmt = stmt.order_by(Task.priority.asc())

    elif order_by == "project":
        stmt = stmt.order_by(Task.project_id)

    tasks = db.execute(stmt).scalars().all()
    return TaskListOut(tasks=tasks)
