"""Auth Tests."""

# Helpers


def register_user(
    client, email="test@donee.com", username="testuser", password="12345678"
):
    """Register user in tests db."""

    return client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )


def login_user(client, email="test@donee.com", password="12345678"):
    """Login user registered in tests db."""

    return client.post("/auth/login", json={"email": email, "password": password})


# Auth tests


def test_register_creates_user(client):
    """Test that user has been created."""

    res = register_user(client)
    assert res.status_code in (200, 201)

    data = res.json()
    assert "id" in data
    assert data["email"] == "test@donee.com"
    assert data["username"] == "testuser"
    assert "password" not in data
    assert "password_hash" not in data


def test_register_fails_if_email_exists(client):
    """Test that an email that already exists cannot be registered."""

    res1 = register_user(client)
    assert res1.status_code in (200, 201)

    res2 = register_user(client)
    assert res2.status_code == 400
    assert res2.json().get("detail") == "Email already registered."


def test_login_success_returns_token(client):
    """Test that a token is returned when logging in."""

    register_user(client)

    res = login_user(client)
    assert res.status_code == 200

    data = res.json()
    assert "access_token" in data
    assert data.get("token_type", "").lower() == "bearer"


def test_login_fails_with_wrong_password(client):
    """Test that a user cannot log in with the wrong password."""

    register_user(client)

    res = login_user(client, password="wrongpass123")
    assert res.status_code == 401
    assert res.json().get("detail") == "Invalid credentials."


def test_me_works_with_valid_token(client):
    """Test that the current user can be obtained with the token."""

    register_user(client)
    login_res = login_user(client)
    token = login_res.json()["access_token"]

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    data = res.json()
    assert data["email"] == "test@donee.com"


def test_me_fails_without_token(client):
    """Test that the current user cannot be obtained without the token."""

    res = client.get("/auth/me")
    assert res.status_code == 401


# Reset password tests


def test_forgot_password_returns_debug_code_in_dev(client):
    """Test that the debug code is returned in dev."""

    register_user(client)

    res = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert res.status_code == 200

    data = res.json()

    assert "debug_code" in data
    assert isinstance(data["debug_code"], str)
    assert len(data["debug_code"]) == 6


def test_verify_reset_code_succeeds_with_correct_code(client):
    """Test that verify_reset_code succeeds with correct code."""

    register_user(client)

    forgot = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert forgot.status_code == 200
    code = forgot.json()["debug_code"]

    verify = client.post(
        "/auth/verify-reset-code", json={"email": "test@donee.com", "code": code}
    )
    assert verify.status_code == 200

    data = verify.json()
    assert data.get("message") == "Code is valid."


def test_reset_password_allows_login_with_new_password(client):
    """Test that it is possible to log in with the new password."""

    register_user(client)

    # Request code
    forgot = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert forgot.status_code == 200
    code = forgot.json()["debug_code"]

    # Reset password
    reset = client.post(
        "/auth/reset-password",
        json={"email": "test@donee.com", "code": code, "new_password": "newpass12345"},
    )
    assert reset.status_code in (200, 204)

    # Old password should fail
    old_login = login_user(client, password="12345678")
    assert old_login.status_code == 401
    assert old_login.json().get("detail") == "Invalid credentials."

    # New password should succeed
    new_login = login_user(client, password="newpass12345")
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_verify_reset_code_fails_with_wrong_code(client):
    """Test that verify_reset_code fails with incorrect code."""

    register_user(client)

    # Make a real token exist
    forgot = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert forgot.status_code == 200

    # Wrong code
    verify = client.post(
        "/auth/verify-reset-code", json={"email": "test@donee.com", "code": "000000"}
    )
    assert verify.status_code in (400, 401)


def test_reset_password_fails_with_wrong_code(client):
    """Test that reset_password fails with the wrong code."""

    register_user(client)

    # Ensure token exists
    forgot = client.post("/auth/forgot-password", json={"email": "test@donee.com"})
    assert forgot.status_code == 200

    reset = client.post(
        "/auth/reset-password",
        json={
            "email": "test@donee.com",
            "code": "000000",
            "new_password": "newpass12345",
        },
    )
    assert reset.status_code in (400, 401)
