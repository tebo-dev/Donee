"""Import necessary libraries for task services."""

from datetime import date
from uuid import UUID

from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.core.domain_errors.project_domain_errors import ProjectNotFound
from app.core.domain_errors.tag_domain_errors import TagNotFound
from app.core.domain_errors.task_domain_errors import (
    InvalidOrderParameter,
    TaskNotFound,
)
from app.core.domain_errors.workspace_domain_errors import NotAuthorized
from app.core.permissions import (
    can_assign_tag,
    can_create_task,
    can_delete_task,
    can_edit_project,
    can_edit_task,
    can_unassign_tag,
)
from app.models.project.project import Project
from app.models.tag.tag import Tag
from app.models.task.task import Task
from app.models.task.task_tag import TaskTag
from app.models.workspace.workspace_member import WorkspaceMember
from app.schemas.tag.tag import TagListOut
from app.schemas.task.task import TaskCreate, TaskListOut, TaskOut, TaskUpdate

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
        Project.id == project_id, Project.workspace_id == workspace_id
    )
    record = db.execute(stmt).scalars().first()

    if record:
        return True
    return False


def add_tag_to_task(
    db: Session, curr_member: WorkspaceMember, task: Task, tag_id: UUID
) -> None:
    """Add a tag to task tags table."""

    if not can_assign_tag(
        curr_member.role, task.created_by, task.assignee_id, curr_member.user_id
    ):
        raise NotAuthorized()

    new_tag = TaskTag(
        task_id=task.id,
        tag_id=tag_id,
    )

    db.add(new_tag)
    db.commit()


def remove_tag_from_task(
    db: Session, curr_member: WorkspaceMember, task: Task, tag_id: UUID
) -> None:
    """Add a tag to task tags table."""

    stmt = select(TaskTag).where(
        TaskTag.task_id == task.id and TaskTag.tag_id == tag_id
    )
    tag = db.execute(stmt).scalars().first()

    if not tag:
        raise TagNotFound()

    if not can_unassign_tag(
        curr_member.role, task.created_by, task.assignee_id, curr_member.user_id
    ):
        raise NotAuthorized()

    db.delete(tag)
    db.commit()


def get_task_tags(db: Session, task_id: UUID, user_id: UUID) -> TagListOut:
    """Return tags belonging to a task."""

    stmt = select(Task).where(Task.id == task_id)
    task = db.execute(stmt).scalars().first()

    if not task:
        raise TaskNotFound()

    curr_member = get_member(db, user_id, task.workspace_id)

    if not curr_member:
        raise NotAuthorized()

    stmt = select(TaskTag.tag_id).where(TaskTag.task_id == task_id)
    tags_ids = db.execute(stmt).scalars().all()

    if not tags_ids:
        return []

    task_tags = db.execute(select(Tag).where(Tag.id.in_(tags_ids))).scalars().all()

    return TagListOut(tags=task_tags, total=len(task_tags))


# Main service


def create_task(db: Session, user_id: UUID, task_data: TaskCreate) -> Task:
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
        created_by=user_id,
        due_at=task_data.due_at,
        project_id=task_data.project_id,
        workspace_id=task_data.workspace_id,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    if task_data.tags:
        patch = task_data.tags

        for tag_id in patch.add_tag_ids:
            add_tag_to_task(db, curr_member, new_task, tag_id)

        for tag_id in patch.remove_tag_ids:
            remove_tag_from_task(db, curr_member, new_task, tag_id)

    new_task_schema = TaskOut.model_validate(new_task)
    new_task_schema.tags = get_task_tags(db, new_task.id, user_id)

    return new_task_schema


def get_workspace_tasks(db: Session, user_id: UUID, workspace_id: UUID) -> TaskListOut:
    """Return all the tasks from a workspace."""

    curr_member = get_member(db, user_id, workspace_id)

    if not curr_member:
        raise NotAuthorized()

    stmt = select(Task).where(Task.workspace_id == workspace_id)
    workspace_tasks = db.execute(stmt).scalars().all()
    task_schemas = []

    for task in workspace_tasks:
        task_schema = TaskOut.model_validate(task)
        task_schema.tags = get_task_tags(db, task.id, user_id)
        task_schemas.append(task_schema)

    return TaskListOut(
        tasks=task_schemas,
        total=len(workspace_tasks),
    )


def get_task_for_user(db: Session, task_id: UUID, user_id: UUID) -> Task:
    """Return a specific task."""

    stmt = select(Task).where(Task.id == task_id)
    task = db.execute(stmt).scalars().first()

    if not task:
        raise TaskNotFound()

    curr_member = get_member(db, user_id, task.workspace_id)

    if not curr_member:
        raise NotAuthorized()

    task_schema = TaskOut.model_validate(task)
    task_schema.tags = get_task_tags(db, task.id, user_id)

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

    if task_update.tags:
        patch = task_update.tags

        for tag_id in patch.add_tag_ids:
            add_tag_to_task(db, curr_member, task, tag_id)

        for tag_id in patch.remove_tag_ids:
            remove_tag_from_task(db, curr_member, task, tag_id)

    updated_data = task_update.model_dump(exclude_unset=True)

    for field, value in updated_data.items():
        if field != "tags":
            setattr(task, field, value)

    if updated_data.get("status") == "done":
        task.completed_at = date.today()
    elif "status" in updated_data:
        task.completed_at = None

    db.commit()

    return task


def delete_task(db: Session, task_id: UUID, user_id: UUID) -> None:
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
            (Task.status == "to do", 1),
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

    else:
        raise InvalidOrderParameter()

    tasks = db.execute(stmt).scalars().all()
    return TaskListOut(
        tasks=tasks,
        total=len(tasks),
    )
