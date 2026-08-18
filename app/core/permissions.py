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

    if role == "viewer":
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

    return is_owner(role)


def can_rename_workspace(role: str) -> bool:
    """Determines if an user is allowed to rename a workspace."""

    return is_owner(role)


def can_delete_workspace(role: str) -> bool:
    """Determines if an user is allowed to delete a workspace."""

    return is_owner(role)


def can_invite_members(role: str) -> bool:
    """Determines if an user is allowed to invite members to a workspace."""

    return is_owner(role)


def can_manage_members(role: str) -> bool:
    """Determines if an user is allowed to manage members."""

    return is_owner(role)


def can_change_roles(role: str) -> bool:
    """Determines if an user is allowed to change roles."""

    return is_owner(role)


# Task permissions.


def can_create_task(role: str) -> bool:
    """Determines if an user is allowed to create a task."""

    return is_collaborator(role)


def can_view_task(role: str) -> bool:
    """Determines if an user is allowed to view a task."""

    return can_view_workspace(role)


def can_edit_task(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to edit a task."""

    if is_owner_or_admin(role):
        return True

    if current_user_id == created_by or current_user_id == assignee_id:
        return True

    return False


def can_delete_task(role: str, created_by: str | None, current_user_id: str) -> bool:
    """Determines if an user is allowed to delete a task."""

    if is_owner_or_admin(role) or current_user_id == created_by:
        return True
    return False


def can_reassign_task(role: str) -> bool:
    """Determines if an user is allowed to reassign a task."""

    return is_owner_or_admin(role)


def can_edit_task_metadata(role: str) -> bool:
    """Determines if an user is allowed to edit structural fields."""

    return is_owner_or_admin(role)


# Project permissions.


def can_create_project(role: str) -> bool:
    """Determines if an user is allowed to create a project."""

    return is_owner_or_admin(role)


def can_view_project(role: str) -> bool:
    """Determines if an user is allowed to visualize a project."""

    return can_view_workspace(role)


def can_edit_project(role: str) -> bool:
    """Determines if an user is allowed to edit a project."""

    return is_owner_or_admin(role)


def can_delete_project(role: str) -> bool:
    """Determines if an user is allowed to delete a project."""

    return is_owner_or_admin(role)


# Tag permissions.


def can_create_tag(role: str) -> bool:
    """Determines if an user is allowed to create a tag."""

    return is_owner_or_admin(role)


def can_view_tag(role: str) -> bool:
    """Determines if an user is allowed to visualize a tag."""

    return can_view_workspace(role)


def can_assign_tag(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to assign a tag."""

    return can_edit_task(role, created_by, assignee_id, current_user_id)


def can_unassign_tag(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to assign a tag."""

    return can_edit_task(role, created_by, assignee_id, current_user_id)


def can_edit_tag(role: str) -> bool:
    """Determines if an user is allowed to edit a tag."""

    return is_owner_or_admin(role)


def can_delete_tag(role: str) -> bool:
    """Determines if an user is allowed to delete a tag."""

    return is_owner_or_admin(role)


# Attachment permissions.


def can_add_attachment(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to add an attachment to a task."""

    return can_edit_task(role, created_by, assignee_id, current_user_id)


def can_view_attachment(role: str) -> bool:
    """Determines if an user is allowed to visualize an attachment."""

    return can_view_workspace(role)


def can_edit_attachment_name(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to change an attachment name."""

    return can_edit_task(role, created_by, assignee_id, current_user_id)


def can_download_attachment(role: str) -> bool:
    """Determines if an user is allowed to download an attachment from a task."""

    return can_view_workspace(role)


def can_delete_attachment(
    role: str, created_by: str | None, assignee_id: str | None, current_user_id: str
) -> bool:
    """Determines if an user is allowed to delete an attachment from a task."""

    return can_edit_task(role, created_by, assignee_id, current_user_id)
