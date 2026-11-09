from typing import Annotated

from fastapi import APIRouter, Path, Query, Response

from app.dependencies import CurrentUser, Projects
from app.models import TaskStatus
from app.schemas import (
    Page,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects and tasks"])
PositiveId = Annotated[int, Path(ge=1, le=9223372036854775807)]
PageNumber = Annotated[int, Query(ge=1, le=1000000)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get("", response_model=Page[ProjectOut])
def list_projects(
    user: CurrentUser, service: Projects, page: PageNumber = 1, page_size: PageSize = 10
):
    items, total = service.list(user.id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, user: CurrentUser, service: Projects):
    return service.create(user.id, data)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: PositiveId, user: CurrentUser, service: Projects):
    return service.get(user.id, project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: PositiveId, data: ProjectUpdate, user: CurrentUser, service: Projects
):
    return service.update(user.id, project_id, data)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: PositiveId, user: CurrentUser, service: Projects):
    service.delete(user.id, project_id)
    return Response(status_code=204)


@router.get("/{project_id}/tasks", response_model=Page[TaskOut])
def list_tasks(
    project_id: PositiveId,
    user: CurrentUser,
    service: Projects,
    status: TaskStatus | None = None,
    page: PageNumber = 1,
    page_size: PageSize = 5,
):
    items, total = service.list_tasks(user.id, project_id, status, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: PositiveId, data: TaskCreate, user: CurrentUser, service: Projects):
    return service.create_task(user.id, project_id, data)


@router.get("/{project_id}/tasks/{task_id}", response_model=TaskOut)
def get_task(project_id: PositiveId, task_id: PositiveId, user: CurrentUser, service: Projects):
    return service.get_task(user.id, project_id, task_id)


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(
    project_id: PositiveId,
    task_id: PositiveId,
    data: TaskUpdate,
    user: CurrentUser,
    service: Projects,
):
    return service.update_task(user.id, project_id, task_id, data)


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
def delete_task(project_id: PositiveId, task_id: PositiveId, user: CurrentUser, service: Projects):
    service.delete_task(user.id, project_id, task_id)
    return Response(status_code=204)
