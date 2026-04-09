"""Task Tests."""

from tests.utils import login_user, register_user


def test_create_task(client):
    """Test that every task is created correctly."""

    # Register user and log in.
    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get default workspace
    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    payload = {
        "title": "My Task",
        "description": "Test description",
        "priority": 3,
        "due_at": "2026-05-01",
        "project_id": None,
        "workspace_id": ws["id"],
    }

    res = client.post("/tasks", json=payload, headers=headers)
    data = res.json()

    assert res.status_code == 201
    assert data["title"] == "My Task"
    assert data["workspace_id"] == ws["id"]
    assert data["priority"] == 3


def test_cannot_create_task_in_foreign_workspace(client):
    """Test that a task cannot be created in a foreign workspace."""

    # User A
    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    ws_a = client.get("/workspaces", headers=headers_a).json()["workspaces"][0]

    # User B
    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    payload = {
        "title": "Illegal Task",
        "description": "Should fail",
        "priority": 1,
        "due_at": "2026-05-01",
        "project_id": None,
        "workspace_id": ws_a["id"],
    }

    res = client.post("/tasks", json=payload, headers=headers_b)

    assert res.status_code in (401, 403)


def test_list_tasks_only_from_workspace(client):
    """Test that tasks are listed only from a specific workspace."""

    # User A
    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    ws_a = client.get("/workspaces", headers=headers_a).json()["workspaces"][0]

    # Add two tasks in workspace A
    for i in range(2):
        client.post(
            "/tasks",
            json={
                "title": f"A Task {i}",
                "description": "desc",
                "priority": 2,
                "due_at": "2026-05-01",
                "project_id": None,
                "workspace_id": ws_a["id"],
            },
            headers=headers_a,
        )

    # User B
    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    ws_b = client.get("/workspaces", headers=headers_b).json()["workspaces"][0]

    # Add one task in workspace B
    client.post(
        "/tasks",
        json={
            "title": "B Task",
            "description": "desc",
            "priority": 1,
            "due_at": "2026-05-01",
            "project_id": None,
            "workspace_id": ws_b["id"],
        },
        headers=headers_b,
    )

    # List tasks from workspace A
    res = client.get(f"/tasks?workspace_id={ws_a['id']}", headers=headers_a)
    data = res.json()

    assert data["total"] == 2
    assert all(task["workspace_id"] == ws_a["id"] for task in data["tasks"])


def test_update_task(client):
    """Test that a task is updated correctly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    # Add task
    res = client.post(
        "/tasks",
        json={
            "title": "Old Title",
            "description": "desc",
            "priority": 3,
            "due_at": "2026-05-01",
            "project_id": None,
            "workspace_id": ws["id"],
        },
        headers=headers,
    )
    task = res.json()

    # Update
    update = {
        "title": "New Title",
        "description": "Updated desc",
        "status": "in_progress",
        "priority": 1,
        "due_at": "2026-06-01",
        "project_id": None,
        "workspace_id": ws["id"],
    }

    res2 = client.patch(f"/tasks/{task['id']}", json=update, headers=headers)
    updated = res2.json()

    assert updated["title"] == "New Title"
    assert updated["priority"] == 1
    assert updated["status"] == "in_progress"


def test_delete_task(client):
    """Test that a task is deleted corretly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    # Add task.
    res = client.post(
        "/tasks",
        json={
            "title": "Task to delete",
            "description": "desc",
            "priority": 3,
            "due_at": "2026-05-01",
            "project_id": None,
            "workspace_id": ws["id"],
        },
        headers=headers,
    )
    task = res.json()

    # Delete task
    client.delete(f"/tasks/{task['id']}", headers=headers)

    # Try to get deleted task
    res2 = client.get(f"/tasks/{task['id']}", headers=headers)
    assert res2.status_code in (404, 403)


def test_order_tasks_by_status(client):
    """Test that the tasks are organized correctly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get workspace
    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    # Add 3 tasks
    task_ids = []
    for i in range(3):
        res = client.post(
            "/tasks",
            json={
                "title": f"Task {i}",
                "description": "desc",
                "priority": 3,
                "due_at": "2026-05-01",
                "project_id": None,
                "workspace_id": ws["id"],
            },
            headers=headers,
        )
        task_ids.append(res.json()["id"])

    # Update tasks with different status
    status_values = ["done", "to do", "in_progress"]

    for task_id, status in zip(task_ids, status_values):
        client.patch(
            f"/tasks/{task_id}",
            json={
                "title": "Updated",
                "description": "desc",
                "status": status,
                "priority": 3,
                "due_at": "2026-05-01",
                "project_id": None,
                "workspace_id": ws["id"],
            },
            headers=headers,
        )

    # Get tasks organized by status
    res = client.get(
        f"/tasks?workspace_id={ws['id']}&order_by=status",
        headers=headers,
    )
    tasks = res.json()["tasks"]

    expected_order = ["to do", "in_progress", "done"]

    assert [t["status"] for t in tasks] == expected_order
