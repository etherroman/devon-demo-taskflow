from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.models import User
from app.repository import Repository
from app.services import AuthService, DomainError, ProjectService

bearer = HTTPBearer(auto_error=False)


def repository(request: Request):
    with Session(request.app.state.engine) as session:
        yield Repository(session)


Repo = Annotated[Repository, Depends(repository)]


def auth_service(request: Request, repo: Repo):
    return AuthService(repo, request.app.state.settings)


Auth = Annotated[AuthService, Depends(auth_service)]


def current_user(
    auth: Auth, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
):
    if credentials is None:
        raise DomainError(401, "Authentication required")
    return auth.authenticate(credentials.credentials)


CurrentUser = Annotated[User, Depends(current_user)]


def project_service(repo: Repo):
    return ProjectService(repo)


Projects = Annotated[ProjectService, Depends(project_service)]
