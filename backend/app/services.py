"""Domain rules: credentials, authorization and nested resource invariants."""

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.models import Project, Task, User
from app.repository import Repository
from app.schemas import Credentials, ProjectCreate, ProjectUpdate, TaskCreate, TaskUpdate

password_hasher = PasswordHasher()


class DomainError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


class AuthService:
    def __init__(self, repository: Repository, settings: Settings):
        self.repo = repository
        self.settings = settings

    def signup(self, data: Credentials):
        email = str(data.email).lower()
        if self.repo.user_by_email(email):
            raise DomainError(409, "Email already registered")
        try:
            return self.repo.save(
                User(email=email, password_hash=password_hasher.hash(data.password))
            )
        except IntegrityError:
            self.repo.session.rollback()
            raise DomainError(409, "Email already registered") from None

    def login(self, data: Credentials):
        user = self.repo.user_by_email(str(data.email).lower())
        try:
            if user is None or not password_hasher.verify(user.password_hash, data.password):
                raise DomainError(401, "Invalid email or password")
        except (VerificationError, InvalidHashError):
            raise DomainError(401, "Invalid email or password") from None
        now = datetime.now(UTC)
        return jwt.encode(
            {
                "sub": str(user.id),
                "iat": now,
                "exp": now + timedelta(minutes=self.settings.token_minutes),
            },
            self.settings.jwt_secret,
            algorithm="HS256",
        )

    def authenticate(self, token: str):
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=["HS256"],
                options={"require": ["exp", "sub"]},
            )
            sub = payload["sub"]
            if not isinstance(sub, str) or not sub.isascii() or not sub.isdigit() or len(sub) > 18:
                raise ValueError("Invalid subject")
            user = self.repo.user(int(sub))
            if user is None:
                raise ValueError("Unknown user")
            return user
        except (jwt.InvalidTokenError, ValueError, TypeError):
            raise DomainError(401, "Invalid or expired token") from None


class ProjectService:
    def __init__(self, repository: Repository):
        self.repo = repository

    def get(self, owner_id: int, project_id: int):
        item = self.repo.project(owner_id, project_id)
        if item is None:
            raise DomainError(404, "Project not found")
        return item

    def list(self, owner_id: int, page: int, page_size: int):
        return self.repo.projects(owner_id, page, page_size)

    def list_tasks(self, owner_id: int, project_id: int, status, page: int, page_size: int):
        self.get(owner_id, project_id)
        return self.repo.tasks(project_id, status, page, page_size)

    def create(self, owner_id: int, data: ProjectCreate):
        return self.repo.save(Project(owner_id=owner_id, **data.model_dump()))

    def update(self, owner_id: int, project_id: int, data: ProjectUpdate):
        item = self.get(owner_id, project_id)
        item.sqlmodel_update(data.model_dump(exclude_unset=True))
        return self.repo.save(item)

    def delete(self, owner_id: int, project_id: int):
        self.repo.delete(self.get(owner_id, project_id))

    def get_task(self, owner_id: int, project_id: int, task_id: int):
        self.get(owner_id, project_id)
        item = self.repo.task(project_id, task_id)
        if item is None:
            raise DomainError(404, "Task not found")
        return item

    def create_task(self, owner_id: int, project_id: int, data: TaskCreate):
        self.get(owner_id, project_id)
        return self.repo.save(Task(project_id=project_id, **data.model_dump()))

    def update_task(self, owner_id: int, project_id: int, task_id: int, data: TaskUpdate):
        item = self.get_task(owner_id, project_id, task_id)
        item.sqlmodel_update(data.model_dump(exclude_unset=True))
        return self.repo.save(item)

    def delete_task(self, owner_id: int, project_id: int, task_id: int):
        self.repo.delete(self.get_task(owner_id, project_id, task_id))
