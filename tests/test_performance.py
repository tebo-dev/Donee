"""Bound SQL round trips independent of task-page size."""

from datetime import date
from uuid import UUID

import pytest
from sqlalchemy import event

from app.models import Tag, Task, TaskTag
from app.services.task.task_service import get_workspace_tasks
from tests.test_security_regressions import account


@pytest.mark.parametrize("size", [1, 50])
def test_task_page_uses_four_selects_at_any_page_size(client, db_session, size):
    user, _, workspace = account(client)
    user_id, workspace_id = UUID(user["id"]), UUID(workspace["id"])
    tasks = [
        Task(
            workspace_id=workspace_id,
            created_by=user_id,
            title=f"Task {i}",
            description="",
            priority="normal",
            due_at=date(2026, 12, 1),
        )
        for i in range(size)
    ]
    db_session.add_all(tasks)
    tag = Tag(workspace_id=workspace_id, name="Shared", color="#123456")
    db_session.add(tag)
    db_session.flush()
    db_session.add_all([TaskTag(task_id=task.id, tag_id=tag.id) for task in tasks])
    db_session.commit()
    statements = []

    def capture(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", capture)
    try:
        result = get_workspace_tasks(db_session, user_id, workspace_id, limit=50)
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert result.total == size
    assert result.counts.total == size
    assert len(result.tasks) == size
    assert all(task.tags.total == 1 for task in result.tasks)
    assert len(statements) == 4


def test_current_user_and_session_use_one_select(client, db_session):
    _, headers, _ = account(client)
    statements = []

    def capture(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.get("/auth/me", headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert response.status_code == 200
    assert len(statements) == 1
