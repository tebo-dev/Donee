"""Useful functions for testing."""


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
