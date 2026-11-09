from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import Settings
from app.database import make_engine
from app.routers import auth, projects
from app.services import DomainError

settings = Settings()
engine = make_engine(settings.database_url)
app = FastAPI(title="Taskflow API", version="1.0.0")
app.state.settings = settings
app.state.engine = engine
app.add_middleware(
    CORSMiddleware,
    allow_origins=[v.strip() for v in settings.cors_origins.split(",")],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth.router)
app.include_router(projects.router)


@app.exception_handler(DomainError)
async def domain_error(_: Request, exc: DomainError):
    return JSONResponse(
        status_code=exc.status,
        content={"detail": exc.message},
        headers={"WWW-Authenticate": "Bearer"} if exc.status == 401 else None,
    )


@app.get("/health", tags=["operations"])
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
