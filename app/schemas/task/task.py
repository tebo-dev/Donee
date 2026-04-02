"""Import the necessary libraries for tasks schemas implementation."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Requests


class TaskCreate(BaseModel):
    """Schema for task creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=2, max_length=100)
    description: str
    priority: str
    due_date: date
    project_id: UUID
    workspace_id: UUID


class TaskUpdate(BaseModel):
    """Schema for task update."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=2, max_length=100)
    description: str
    priority: str
    due_date: date
    project_id: UUID
    workspace_id: UUID


# Responses


class TaskOut(BaseModel):
    """Schema for returning a task for the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    status: str
    priority: str
    due_date: date
    workspace_id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class TaskListOut(BaseModel):
    """Schema for returning a list of tasks to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    tasks: list[TaskOut]
    total: int
