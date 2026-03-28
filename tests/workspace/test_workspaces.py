"""Workspace Tests."""

from tests.utils import login_user, register_user


def test_default_workspace_created(client):
    """Test than a default workspace is created every time
    an user is registered"""

    # Register user
    res1 = register_user(client)
    assert res1.status_code == 201

    # Login user to get token
    login = login_user(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Obtain user workspaces
    res2 = client.get("/workspaces", headers=headers)
    data = res2.json()

    assert res2.status_code == 200
    assert len(data["workspaces"]) == 1

    ws = data["workspaces"][0]
    assert ws["name"] == "My Space"


def test_list_user_workspaces(client):
    """Test than listing user workspaces works correctly."""

    # User A
    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A created an extra workspace
    client.post("/workspaces", json={"name": "Extra"}, headers=headers_a)

    # User A should have two workspaces
    res_a = client.get("/workspaces", headers=headers_a)
    assert len(res_a.json()["workspaces"]) == 2

    # User B should have only one workspace (default)
    res_b = client.get("/workspaces", headers=headers_b)
    assert len(res_b.json()["workspaces"]) == 1


def test_create_workspace(client):
    """Test a workspace is created correctly."""

    register_user(client)
    login = login_user(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/workspaces", json={"name": "New WS"}, headers=headers)
    assert res.status_code == 201

    list_res = client.get("/workspaces", headers=headers)
    names = [ws["name"] for ws in list_res.json()["workspaces"]]
    assert "New WS" in names


def test_rename_workspace(client):
    """Test a workspace is renamed correctly."""

    register_user(client)
    login = login_user(client)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get default workspace
    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    # Rename workspace
    res = client.patch(
        f"/workspaces/{ws['id']}", json={"name": "Renamed"}, headers=headers
    )
    assert res.status_code == 200

    # Verify workspace was renamed correctly
    updated = client.get("/workspaces", headers=headers).json()["workspaces"][0]
    assert updated["name"] == "Renamed"


def test_cannot_access_other_user_workspace(client):
    """Test a workspace cannot be accessed by an user who is not a member."""

    # User A
    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A workspace
    ws_a = client.get("/workspaces", headers=headers_a).json()["workspaces"][0]

    # User B tries to access
    res = client.get(f"/workspaces/{ws_a['id']}", headers=headers_b)

    assert res.status_code in (403, 404)
