from logging.config import fileConfig

from sqlmodel import SQLModel

from alembic import context
from app import models  # noqa: F401 -- register metadata for comparison
from app.config import Settings
from app.database import make_engine

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = SQLModel.metadata
settings = Settings()

if context.is_offline_mode():
    context.configure(
        url=settings.database_url, target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(settings.database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
