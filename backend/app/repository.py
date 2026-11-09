"""Database queries only. Ownership filters are part of every resource lookup."""

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Project, Task, TaskStatus, User


class Repository:
    def __init__(self, session: Session):
        self.session = session

    def user_by_email(self, email: str) -> User | None:
        return self.session.exec(select(User).where(User.email == email)).first()

    def user(self, user_id: int) -> User | None:
        return self.session.get(User, user_id)

    def project(self, owner_id: int, project_id: int) -> Project | None:
        return self.session.exec(
            select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
        ).first()

    def projects(self, owner_id: int, page: int, page_size: int):
        condition = Project.owner_id == owner_id
        count = self.session.exec(select(func.count()).select_from(Project).where(condition)).one()
        items = self.session.exec(
            select(Project)
            .where(condition)
            .order_by(Project.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return items, count

    def task(self, project_id: int, task_id: int) -> Task | None:
        return self.session.exec(
            select(Task).where(Task.id == task_id, Task.project_id == project_id)
        ).first()

    def tasks(self, project_id: int, status: TaskStatus | None, page: int, page_size: int):
        conditions = [Task.project_id == project_id]
        if status is not None:
            conditions.append(Task.status == status.value)
        count = self.session.exec(select(func.count()).select_from(Task).where(*conditions)).one()
        items = self.session.exec(
            select(Task)
            .where(*conditions)
            .order_by(Task.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return items, count

    def save(self, item):
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item

    def delete(self, item):
        self.session.delete(item)
        self.session.commit()
