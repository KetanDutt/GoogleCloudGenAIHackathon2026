from logging.config import fileConfig

from alembic import context

from backend.config.settings import Settings
from backend.db.database import Database
from backend.db.models import Base

config = context.config
if config.config_file_name and config.attributes.get("connection") is None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
target_metadata = Base.metadata
settings = config.attributes.get("settings") or Settings()


def run_with_connection(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    run_with_connection(config.attributes["connection"])
else:
    database = Database(settings)
    with database.engine.connect() as connection:
        run_with_connection(connection)
    database.engine.dispose()
