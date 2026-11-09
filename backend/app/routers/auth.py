from fastapi import APIRouter

from app.dependencies import Auth, CurrentUser
from app.schemas import Credentials, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(data: Credentials, auth: Auth):
    return auth.signup(data)


@router.post("/login", response_model=TokenOut)
def login(data: Credentials, auth: Auth):
    return TokenOut(access_token=auth.login(data))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
