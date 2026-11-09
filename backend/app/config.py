from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://taskflow:taskflow@localhost:55432/taskflow"
    jwt_secret: str = Field(min_length=32)
    token_minutes: int = Field(default=60, ge=1, le=1440)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
