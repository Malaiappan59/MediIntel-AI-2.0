from __future__ import annotations

import time
from pathlib import Path
from urllib.parse import urlsplit

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from backend.database.session import SessionLocal, engine
from backend.models.entities import User
from backend.services.file_service import file_service
from backend.utils.settings import get_settings
from database.seed import seed_database

settings = get_settings()


def _is_docker_service_hostname(hostname: str | None) -> bool:
    return (hostname or "").strip().lower() == "database"


def _database_unavailable_message(exc: OperationalError) -> str:
    message = "Database did not become available in time."
    hostname = urlsplit(settings.database_url.replace("+psycopg", "", 1)).hostname
    error_text = str(exc)

    if _is_docker_service_hostname(hostname) or "failed to resolve host 'database'" in error_text:
        return (
            f"{message} DATABASE_URL is pointing to host '{hostname or 'database'}', which only resolves inside Docker Compose. "
            "If you are running Python directly on Windows, set DATABASE_URL to localhost or your managed PostgreSQL host instead."
        )

    return message


def wait_for_database() -> None:
    for attempt in range(1, settings.database_connect_max_retries + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("Database connection established.", flush=True)
            return
        except OperationalError as exc:
            if attempt == settings.database_connect_max_retries:
                raise RuntimeError(_database_unavailable_message(exc)) from exc
            print(
                f"Waiting for database ({attempt}/{settings.database_connect_max_retries})...",
                flush=True,
            )
            time.sleep(settings.database_connect_retry_seconds)


def run_migrations() -> None:
    project_root = Path(__file__).resolve().parents[2]
    config = Config(str(project_root / "backend" / "alembic.ini"))
    config.set_main_option("script_location", str(project_root / "backend" / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(config, "head")
    print("Alembic migrations applied.", flush=True)


def database_has_seed_data() -> bool:
    session = SessionLocal()
    try:
        return session.scalar(select(User.id).limit(1)) is not None
    finally:
        session.close()


def seed_mock_data_if_needed() -> None:
    if database_has_seed_data():
        print("Seed data already present. Skipping development seed.", flush=True)
        return

    if seed_database(skip_if_seeded=False):
        print("Development seed data loaded.", flush=True)


def sync_knowledge_index() -> None:
    session = SessionLocal()
    try:
        indexed_count = file_service.sync_repository_index(session)
    finally:
        session.close()

    print(f"Knowledge index synchronized for {indexed_count} file(s).", flush=True)


def bootstrap() -> None:
    settings.validate_runtime()
    for warning in settings.runtime_warnings():
        print(f"Runtime configuration warning: {warning}", flush=True)

    wait_for_database()

    if settings.run_db_migrations:
        run_migrations()

    if settings.seed_mock_data:
        seed_mock_data_if_needed()

    sync_knowledge_index()


if __name__ == "__main__":
    bootstrap()
