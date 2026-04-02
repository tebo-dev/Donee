"""Implement authorization helpers."""

# Base role helpers.


def is_owner(role: str) -> bool:
    """Determines if an user is the workspace owner."""

    if role == "owner":
        return True
    return False


def is_admin(role: str) -> bool:
    """Determines if an user is a workspace admin."""

    if role == "admin":
        return True
    return False


def is_member(role: str) -> bool:
    """Determines if an user is a workspace member."""

    if role == "member":
        return True
    return False


def is_viewer(role: str) -> bool:
    """Determines if an user is a workspace viewer."""

    if role == "admin":
        return True
    return False


def is_owner_or_admin(role: str) -> bool:
    """Determines if an user is a workspace owner or admin."""

    if role == "owner" or role == "admin":
        return True
    return False


def is_collaborator(role: str) -> bool:
    """Determines if an user is a workspace owner, admin or member."""

    roles = ["owner", "admin", "member"]

    if role in roles:
        return True
    return False


# Workspace permissions.


def can_view_workspace(role: str) -> bool:
    """Determines if an user is allowed to visualize a workspace."""

    roles = ["owner", "admin", "member", "viewer"]

    if role in roles:
        return True
    return False


def can_manage_workspace_settings(role: str) -> bool:
    """Determines if an user is allowed to manage workspace settings."""

    if role == "owner":
        return True
    return False


def can_rename_workspace(role: str) -> bool:
    """Determines if an user is allowed to rename a workspace."""

    if role == "owner":
        return True
    return False


def can_delete_workspace(role: str) -> bool:
    """Determines if an user is allowed to delete a workspace."""

    if role == "owner":
        return True
    return False


def can_invite_members(role: str) -> bool:
    """Determines if an user is allowed to invite members to a workspace."""

    if role == "owner":
        return True
    return False


def can_manage_members(role: str) -> bool:
    """Determines if an user is allowed to manage members."""

    if role == "owner":
        return True
    return False


def can_change_roles(role: str) -> bool:
    """Determines if an user is allowed to change roles."""

    if role == "owner":
        return True
    return False


# Task permissions.


def can_create_task(role: str) -> bool:
    """Determines if an user is allowed to create a task."""

    roles = ["owner", "admin", "member"]

    if role in roles:
        return True
    return False


def can_view_task(role: str) -> bool:
    """Determines if an user is allowed to view a task."""

    roles = ["owner", "admin", "member", "viewer"]

    if role in roles:
        return True
    return False


def can_edit_task(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to edit a task."""

    if role == "owner" or role == "admin":
        return True

    if current_user_id == created_by or current_user_id == assignee_id:
        return True

    return False


def can_complete_task(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to mark a task as completed."""

    if role == "owner" or role == "admin":
        return True

    if current_user_id == created_by or current_user_id == assignee_id:
        return True

    return False


def can_delete_task(role: str, created_by: str | None, current_user_id: str) -> bool:
    """Determines if an user is allowed to delete a task."""

    roles = ["owner", "admin"]

    if role in roles or current_user_id == created_by:
        return True
    return False


def can_reassign_task(role: str) -> bool:
    """Determines if an user is allowed to reassign a task."""

    if role == "owner" or role == "admin":
        return True
    return False


def can_change_task_status(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to change the status of a task."""

    if role == "owner" or role == "admin":
        return True

    if current_user_id == created_by or current_user_id == assignee_id:
        return True

    return False


def can_edit_task_metadata(role: str) -> bool:
    """Determines if an user is allowed to edit structural fields."""

    if role == "owner" or role == "admin":
        return True
    return False


# Project permissions.


def can_create_project(role: str) -> bool:
    """Determines if an user is allowed to create a project."""

    if role == "owner" or role == "admin":
        return True
    return False


def can_view_project(role: str) -> bool:
    """Determines if an user is allowed to visualize a project."""

    roles = ["owner", "admin", "member", "viewer"]

    if role in roles:
        return True
    return False


def can_edit_project(role: str) -> bool:
    """Determines if an user is allowed to edit a project."""

    if role == "owner" or role == "admin":
        return True
    return False


def can_delete_project(role: str) -> bool:
    """Determines if an user is allowed to delete a project."""

    if role == "owner" or role == "admin":
        return True
    return False
