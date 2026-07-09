# Database

This directory now contains development-time database assets for MediIntel.

Current state:

- PostgreSQL is configured through environment variables.
- SQLAlchemy entity models are defined under `backend/models/entities.py`.
- Alembic includes the initial core-table migration in `backend/alembic/versions/20260706_0001_core_tables.py`.
- `seed.py` can populate development data for users, inventory, forecasts, suppliers, orders, alerts, files, APIs, audit logs, and chat history.
- `postgres_demo.py` can wait for PostgreSQL, apply migrations, seed realistic demo data, reset seeded data, and print row-count summaries.
- `reference-data.json` is the shared source for hospital metadata, supplier seeds, medicine catalog entries, policy files, and mock API definitions.

Recommended demo workflow:

```bash
python -m database.postgres_demo bootstrap --create-db --reset
```

If you are running Python directly on Windows against a locally installed PostgreSQL server, copy `.env.local-postgres.example` to `.env` first.

Useful alternatives:

```bash
python -m database.postgres_demo migrate
python -m database.postgres_demo create-db
python -m database.postgres_demo seed --reset
python -m database.postgres_demo summary
```

The seeded demo dataset is designed to exercise:

- critical shortages and watchlist medicines
- near-expiry inventory decisions
- pending, modified, approved, in-transit, received, and rejected procurement paths
- supplier delay and delivery variance alerts
- approval history, invoices, files, APIs, and audit-log drill-downs
