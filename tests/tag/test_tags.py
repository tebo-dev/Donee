"""Tag Tests."""

from tests.utils import login_user, register_user


def test_create_tag(client):
    """Test that a tag is created correctly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    payload = {
        "name": "Urgent",
        "color": "#FF5733",
        "workspace_id": ws["id"],
    }

    res = client.post("/tags", json=payload, headers=headers)
    data = res.json()

    assert res.status_code == 201
    assert data["name"] == "Urgent"
    assert data["color"] == "#FF5733"


def test_cannot_create_tag_in_foreign_workspace(client):
    """Test that a tag cannot be created in a foreign workspace."""

    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    ws_a = client.get("/workspaces", headers=headers_a).json()["workspaces"][0]

    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    payload = {
        "name": "Invading Tag",
        "color": "#00FF00",
        "workspace_id": ws_a["id"],
    }

    res = client.post("/tags", json=payload, headers=headers_b)

    assert res.status_code in (401, 403, 404)


def test_list_tags_only_from_workspace(client):
    """Test that tags are listed only from a specific workspace."""

    register_user(client, email="a@donee.com", username="userA")
    login_a = login_user(client, email="a@donee.com")
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    ws_a = client.get("/workspaces", headers=headers_a).json()["workspaces"][0]

    for name, color in [("A Tag 1", "#123456"), ("A Tag 2", "#abcdef")]:
        client.post(
            "/tags",
            json={"name": name, "color": color, "workspace_id": ws_a["id"]},
            headers=headers_a,
        )

    register_user(client, email="b@donee.com", username="userB")
    login_b = login_user(client, email="b@donee.com")
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    ws_b = client.get("/workspaces", headers=headers_b).json()["workspaces"][0]

    client.post(
        "/tags",
        json={"name": "B Tag", "color": "#654321", "workspace_id": ws_b["id"]},
        headers=headers_b,
    )

    res = client.get(f"/tags?workspace_id={ws_a['id']}", headers=headers_a)
    data = res.json()

    assert res.status_code == 200
    assert data["total"] == 2
    assert all(tag["name"] in {"A Tag 1", "A Tag 2"} for tag in data["tags"])


def test_get_specific_tag(client):
    """Test that a specific tag can be retrieved."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    created = client.post(
        "/tags",
        json={"name": "Project", "color": "#ABCDEF", "workspace_id": ws["id"]},
        headers=headers,
    )
    tag = created.json()

    res = client.get(f"/tags/{tag['id']}", headers=headers)
    data = res.json()

    assert res.status_code == 200
    assert data["id"] == tag["id"]
    assert data["name"] == "Project"


def test_edit_tag(client):
    """Test that an existing tag is updated correctly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    created = client.post(
        "/tags",
        json={"name": "Old Tag", "color": "#112233", "workspace_id": ws["id"]},
        headers=headers,
    )
    tag = created.json()

    update = {
        "name": "New Tag",
        "color": "#334455",
        "workspace_id": ws["id"],
    }

    res = client.patch(f"/tags/{tag['id']}", json=update, headers=headers)
    data = res.json()

    assert res.status_code == 200
    assert data["name"] == "New Tag"
    assert data["color"] == "#334455"


def test_duplicate_tag_name_or_color_is_rejected(client):
    """Test that duplicate tag names and colors are not
    allowed in the same workspace."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    client.post(
        "/tags",
        json={"name": "Shared", "color": "#AABBCC", "workspace_id": ws["id"]},
        headers=headers,
    )

    dup_name = client.post(
        "/tags",
        json={"name": "Shared", "color": "#DDEEFF", "workspace_id": ws["id"]},
        headers=headers,
    )
    assert dup_name.status_code == 409
    assert dup_name.json()["detail"] == "Tag name already taken."

    dup_color = client.post(
        "/tags",
        json={"name": "Another", "color": "#AABBCC", "workspace_id": ws["id"]},
        headers=headers,
    )
    assert dup_color.status_code == 409
    assert dup_color.json()["detail"] == "Tag color already taken."


def test_delete_tag(client):
    """Test that a tag is deleted correctly."""

    register_user(client, email="a@donee.com", username="userA")
    login = login_user(client, email="a@donee.com")
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    ws = client.get("/workspaces", headers=headers).json()["workspaces"][0]

    created = client.post(
        "/tags",
        json={"name": "Delete Me", "color": "#FF00AA", "workspace_id": ws["id"]},
        headers=headers,
    )
    tag = created.json()

    delete_res = client.delete(f"/tags/{tag['id']}", headers=headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["message"] == "Deleted successfully."

    fetch_res = client.get(f"/tags/{tag['id']}", headers=headers)
    assert fetch_res.status_code in (404, 403)
