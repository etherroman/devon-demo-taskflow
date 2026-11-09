from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

from app.models import TaskStatus

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Input):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @model_validator(mode="after")
    def valid_password(self):
        if not self.password.strip():
            raise ValueError("Password must contain non-space characters")
        return self


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProjectCreate(Input):
    title: Title
    description: Description = ""


class UpdateInput(Input):
    @model_validator(mode="before")
    @classmethod
    def nonempty_nonnull(cls, value):
        if isinstance(value, dict) and (not value or any(v is None for v in value.values())):
            raise ValueError("Supply at least one field; null is not supported")
        return value


class ProjectUpdate(UpdateInput):
    title: Title | None = None
    description: Description | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    created_at: datetime


class TaskCreate(ProjectCreate):
    status: TaskStatus = TaskStatus.TODO


class TaskUpdate(ProjectUpdate):
    status: TaskStatus | None = None


class TaskOut(ProjectOut):
    project_id: int
    status: TaskStatus


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
