from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Column, DateTime, String
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class TaskStatus(StrEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(sa_column=Column(String(254), unique=True, nullable=False, index=True))
    password_hash: str = Field(max_length=255)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = (CheckConstraint("length(trim(title)) > 0", name="ck_project_title"),)
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=120)
    description: str = Field(default="", max_length=2000)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )


class Task(SQLModel, table=True):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('TODO', 'IN_PROGRESS', 'DONE')", name="ck_task_status"),
        CheckConstraint("length(trim(title)) > 0", name="ck_task_title"),
    )
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=120)
    description: str = Field(default="", max_length=2000)
    status: str = Field(default=TaskStatus.TODO, max_length=20, index=True)
    created_at: datetime = Field(
        default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )
