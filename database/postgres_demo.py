from __future__ import annotations

import argparse
import json

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from backend.database.session import SessionLocal
from backend.utils.bootstrap import run_migrations, sync_knowledge_index, wait_for_database
from backend.utils.settings import get_settings
from database.seed import get_seed_summary, reset_seed_data, seed_database


settings = get_settings()


def _print_runtime_warnings() -> None:
    settings.validate_runtime()
    for warning in settings.runtime_warnings():
        print(f"Runtime configuration warning: {warning}", flush=True)


def _print_summary() -> None:
    print("Current MediIntel demo data footprint:", flush=True)
    print(json.dumps(get_seed_summary(), indent=2), flush=True)


def create_database_if_missing() -> None:
    url = make_url(settings.database_url)
    database_name = url.database
    if not database_name:
        raise RuntimeError("DATABASE_URL must include a target PostgreSQL database name.")

    admin_database = "postgres" if database_name != "postgres" else "template1"
    connection_kwargs = {
        "host": url.host or "localhost",
        "port": url.port or 5432,
        "user": url.username,
        "password": url.password,
        "dbname": admin_database,
        "autocommit": True,
    }

    try:
        with psycopg.connect(**connection_kwargs) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database_name,))
                if cursor.fetchone():
                    print(f"Database '{database_name}' already exists.", flush=True)
                    return

                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
                print(f"Database '{database_name}' created.", flush=True)
    except psycopg.Error as exc:
        raise RuntimeError(
            "Unable to create the target PostgreSQL database. Ensure the server is reachable and the configured user "
            f"has permission to create databases. Details: {exc}"
        ) from exc


def _run_seed(*, reset_existing: bool, sync_knowledge: bool) -> None:
    seeded = seed_database(skip_if_seeded=not reset_existing, reset_existing=reset_existing)
    if not seeded and not reset_existing:
        print("Seed skipped because data already exists. Use --reset to replace it.", flush=True)
    else:
        print("Demo PostgreSQL seed completed.", flush=True)

    if sync_knowledge:
        sync_knowledge_index()

    _print_summary()


def bootstrap(reset_existing: bool, sync_knowledge: bool, create_database: bool) -> None:
    _print_runtime_warnings()
    if create_database:
        create_database_if_missing()
    wait_for_database()
    run_migrations()
    _run_seed(reset_existing=reset_existing, sync_knowledge=sync_knowledge)


def migrate_only() -> None:
    _print_runtime_warnings()
    wait_for_database()
    run_migrations()
    _print_summary()


def seed_only(reset_existing: bool, sync_knowledge: bool) -> None:
    _print_runtime_warnings()
    wait_for_database()
    _run_seed(reset_existing=reset_existing, sync_knowledge=sync_knowledge)


def reset_only() -> None:
    _print_runtime_warnings()
    wait_for_database()
    session = SessionLocal()
    try:
        reset_seed_data(session)
    finally:
        session.close()

    print("Demo data reset completed.", flush=True)
    _print_summary()


def summary_only() -> None:
    _print_runtime_warnings()
    wait_for_database()
    _print_summary()


def create_db_only() -> None:
    _print_runtime_warnings()
    create_database_if_missing()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Bootstrap and refresh the MediIntel PostgreSQL demo dataset."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    bootstrap_parser = subparsers.add_parser(
        "bootstrap",
        help="Wait for PostgreSQL, run Alembic migrations, seed demo data, and sync the knowledge index.",
    )
    bootstrap_parser.add_argument(
        "--reset",
        action="store_true",
        help="Replace existing MediIntel demo data before reseeding.",
    )
    bootstrap_parser.add_argument(
        "--skip-knowledge-sync",
        action="store_true",
        help="Skip Chroma knowledge indexing after the seed completes.",
    )
    bootstrap_parser.add_argument(
        "--create-db",
        action="store_true",
        help="Attempt to create the target PostgreSQL database before applying migrations.",
    )

    migrate_parser = subparsers.add_parser(
        "migrate",
        help="Wait for PostgreSQL and apply Alembic migrations only.",
    )
    migrate_parser.set_defaults(noop=False)

    seed_parser = subparsers.add_parser(
        "seed",
        help="Seed demo data into an existing PostgreSQL schema.",
    )
    seed_parser.add_argument(
        "--reset",
        action="store_true",
        help="Replace existing MediIntel demo data before reseeding.",
    )
    seed_parser.add_argument(
        "--skip-knowledge-sync",
        action="store_true",
        help="Skip Chroma knowledge indexing after the seed completes.",
    )

    subparsers.add_parser(
        "create-db",
        help="Attempt to create the target PostgreSQL database defined by DATABASE_URL.",
    )
    subparsers.add_parser(
        "reset",
        help="Delete demo data from the existing PostgreSQL schema without reseeding.",
    )
    subparsers.add_parser(
        "summary",
        help="Print the current row counts for the MediIntel demo dataset.",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "bootstrap":
        bootstrap(
            reset_existing=args.reset,
            sync_knowledge=not args.skip_knowledge_sync,
            create_database=args.create_db,
        )
        return

    if args.command == "create-db":
        create_db_only()
        return

    if args.command == "migrate":
        migrate_only()
        return

    if args.command == "seed":
        seed_only(reset_existing=args.reset, sync_knowledge=not args.skip_knowledge_sync)
        return

    if args.command == "reset":
        reset_only()
        return

    if args.command == "summary":
        summary_only()
        return

    parser.error(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
