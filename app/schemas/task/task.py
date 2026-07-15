"""Import the necessary libraries for tasks schemas implementation."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.tag.tag import TagAssign, TagListOut

# Requests


class TaskCreate(BaseModel):
    """Schema for task creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=2, max_length=80)
    description: str
    priority: int
    due_at: date
    tags: list[TagAssign] | None
    project_id: UUID | None
    workspace_id: UUID


class TaskUpdate(BaseModel):
    """Schema for task update."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=2, max_length=80)
    description: str
    status: str | None
    priority: int
    due_at: date
    tags: list[TagAssign] | None
    project_id: UUID | None
    workspace_id: UUID


# Responses


class TaskOut(BaseModel):
    """Schema for returning a task for the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    status: str
    priority: int
    due_at: date
    tags: TagListOut | None
    completed_at: date | None
    workspace_id: UUID
    project_id: UUID | None
    created_at: datetime
    updated_at: datetime


class TaskListOut(BaseModel):
    """Schema for returning a list of tasks to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    tasks: list[TaskOut]
    total: int
