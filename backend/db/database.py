from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.config.settings import Settings
from backend.db.models import Base


class Database:
    def __init__(self, settings: Settings):
        url = make_url(settings.database_url)
        options = {"pool_pre_ping": True}
        if url.get_backend_name() == "sqlite":
            if url.database and url.database != ":memory:":
                Path(url.database).parent.mkdir(parents=True, exist_ok=True)
            options["connect_args"] = {"check_same_thread": False, "timeout": 10}
            if url.database in (None, "", ":memory:"):
                options["poolclass"] = StaticPool
        else:
            options.update(
                pool_size=5,
                max_overflow=5,
                pool_timeout=10,
                connect_args={"connect_timeout": 10, "client_encoding": "utf8"},
            )
        self.engine = create_engine(settings.database_url, **options)
        if url.get_backend_name() == "sqlite":

            @event.listens_for(self.engine, "connect")
            def configure_sqlite(connection, _):
                cursor = connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.close()

        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def initialize(self, settings: Settings):
        if settings.environment == "test":
            Base.metadata.create_all(self.engine)
        elif settings.environment == "development":
            from alembic import command
            from alembic.config import Config

            config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
            with self.engine.begin() as connection:
                config.attributes["connection"] = connection
                config.attributes["settings"] = settings
                command.upgrade(config, "head")
        else:
            from alembic.config import Config
            from alembic.runtime.migration import MigrationContext
            from alembic.script import ScriptDirectory

            config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
            with self.engine.connect() as connection:
                current = MigrationContext.configure(connection).get_current_revision()
            if current != ScriptDirectory.from_config(config).get_current_head():
                raise RuntimeError("Database migrations are required: run alembic upgrade head")
        self.check()

    def check(self):
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    def session(self) -> Iterator[Session]:
        with self.sessions() as session:
            yield session
