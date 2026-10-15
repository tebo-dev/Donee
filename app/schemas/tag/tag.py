"""Import the necessary libraries for workspace tags schemas implementation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Requests


class TagCreate(BaseModel):
    """Schema for tag creation."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=80)
    color: str | None = Field(default=None, min_length=4, max_length=7)
    workspace_id: UUID


class TagEdit(BaseModel):
    """Schema for tag edition."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=80)
    color: str | None = Field(default=None, min_length=4, max_length=7)

    @model_validator(mode="after")
    def reject_null_fields(self):
        """Reject any null fields."""

        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TagPatch(BaseModel):
    """Schema for tag assignment."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    add_tag_ids: list[UUID] = Field(default_factory=list, max_length=50)
    remove_tag_ids: list[UUID] = Field(default_factory=list, max_length=50)


# Responses


class TagOut(BaseModel):
    """Schema for returning a tag."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str
    created_at: datetime


class TagListOut(BaseModel):
    """Schema for returning a list of tags."""

    model_config = ConfigDict(from_attributes=True)

    tags: list[TagOut]
    total: int
