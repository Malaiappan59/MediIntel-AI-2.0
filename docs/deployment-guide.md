# MediIntel Deployment Guide

## Vercel Frontend + Vercel Backend

Use this path when both application tiers must stay on Vercel.

### Runtime Shape

- Vercel project 1 hosts the Next.js frontend from `frontend`.
- Vercel project 2 hosts the FastAPI backend from the repository root via `app.py`.
- PostgreSQL is provided through a managed provider connected to the backend project.
- The frontend keeps `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1` and rewrites requests to the backend project using `NEXT_PRIVATE_BACKEND_ORIGIN`.
- The backend redirects the default `UPLOADS_PATH` and `CHROMADB_PATH` into a temporary runtime directory when `VERCEL` is detected so the function can start safely.

### Backend Project Setup

- Import the same repository into a second Vercel project.
- Set the backend project root to the repository root containing `app.py` and `requirements.txt`.
- The repository root includes `.vercelignore` so the backend project does not upload the frontend bundle, local runtime cache, or container-only files.
- Confirm the backend project exposes the FastAPI health route at `/api/v1/health`.

### Frontend Project Variables

- `NEXT_PUBLIC_APP_NAME=MediIntel`
- `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1`
- `NEXT_PUBLIC_LOGIN_REDIRECT=/dashboard`
- `NEXT_PRIVATE_BACKEND_ORIGIN=https://<backend-vercel-domain>`

Use `.env.vercel.frontend.example` as the exact variable checklist.

### Backend Project Variables

- `DATABASE_URL`
- `DATABASE_CONNECT_MAX_RETRIES=30`
- `DATABASE_CONNECT_RETRY_SECONDS=2`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`
- `FRONTEND_APP_URL=https://<frontend-vercel-domain>`
- `BACKEND_CORS_ORIGINS=https://<frontend-vercel-domain>`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4.1`
- `OPENAI_REQUEST_TIMEOUT_SECONDS=45`
- `AGENT_DEGRADED_MODE_ENABLED=false`
- `CHROMADB_PATH=./chromadb`
- `CHROMADB_COLLECTION=medintel_knowledge`
- `UPLOADS_PATH=./uploads`
- `RAG_CHUNK_SIZE=1200`
- `RAG_CHUNK_OVERLAP=200`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`

Use `.env.vercel.backend.example` as the exact variable checklist.

### First Deploy Checklist

1. Provision the managed PostgreSQL instance and set `DATABASE_URL` on the backend project.
2. Run Alembic migrations from CI or a local Python environment against that database.
3. Run `python -m database.postgres_demo bootstrap --create-db --reset` from CI or a local Python environment when you want the full realistic demo dataset in PostgreSQL and the target database may not exist yet.
4. Deploy the backend project and confirm `/api/v1/health` is healthy.
5. Set `NEXT_PRIVATE_BACKEND_ORIGIN` on the frontend project to the backend Vercel URL.
6. Deploy the frontend project.

### Temporary Storage Note

The backend can now run on Vercel without crashing on startup, but the default uploads and Chroma locations are still temporary inside the Vercel runtime. That means durable file originals and persistent vector indexing still need a managed storage migration in a later step.

## Vercel + Render

This is the recommended split deployment for the current MediIntel architecture.

### Runtime Shape

- Vercel hosts the Next.js frontend.
- Render hosts the FastAPI backend.
- PostgreSQL is attached to the backend environment.
- Chroma persists to the backend filesystem path configured by `CHROMADB_PATH`.
- The frontend keeps `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1` and uses a Vercel rewrite target from `NEXT_PRIVATE_BACKEND_ORIGIN`.

### Vercel Frontend Variables

- `NEXT_PUBLIC_APP_NAME=MediIntel`
- `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1`
- `NEXT_PUBLIC_LOGIN_REDIRECT=/dashboard`
- `NEXT_PRIVATE_BACKEND_ORIGIN=https://<render-backend-domain>`

`NEXT_PRIVATE_BACKEND_ORIGIN` is read at build time, so set it before deploying the frontend.

### Render Backend Variables

- `DATABASE_URL`
- `DATABASE_CONNECT_MAX_RETRIES=30`
- `DATABASE_CONNECT_RETRY_SECONDS=2`
- `RUN_DB_MIGRATIONS=true`
- `SEED_MOCK_DATA=false`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`
- `FRONTEND_APP_URL=https://<your-vercel-domain>`
- `BACKEND_CORS_ORIGINS=https://<your-vercel-domain>`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4.1`
- `CHROMADB_PATH=./chromadb`
- `CHROMADB_COLLECTION=medintel_knowledge`
- `UPLOADS_PATH=./uploads`
- `RAG_CHUNK_SIZE=1200`
- `RAG_CHUNK_OVERLAP=200`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`

### Render Start Command

```bash
python -m backend.utils.bootstrap && uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

On first startup the bootstrap step waits for PostgreSQL and runs Alembic migrations. Seed loading only runs when `SEED_MOCK_DATA=true`, but the recommended demo-data workflow is the explicit `database.postgres_demo` command so the dataset can be recreated cleanly.

### First Deploy Checklist

1. Deploy the backend with the Render environment variables above.
2. Confirm the backend health endpoint responds at `/api/v1/health`.
3. Add the Vercel environment variables, especially `NEXT_PRIVATE_BACKEND_ORIGIN`.
4. Deploy the frontend.
5. Sign in with a seeded account only if you intentionally enabled `SEED_MOCK_DATA=true` or explicitly loaded the demo dataset with `python -m database.postgres_demo bootstrap --create-db --reset`.

## Railway

This project also remains configured for a direct Railway deployment using the root `Dockerfile`.

### Runtime Shape

- Next.js runs as the public web entrypoint.
- FastAPI runs internally on port `8000`.
- Railway routes external traffic to the frontend container port.
- Frontend API requests use `/api/backend/v1/...`, which rewrites to the internal FastAPI service.

### Railway Steps

1. Push the `medintel` directory to GitHub.
2. In Railway, create a new project from that repository.
3. Set the service root to the repository root containing `Dockerfile`.
4. Add the variables from `.env.example`.
5. Provision PostgreSQL in the same project and set `DATABASE_URL`.
6. Deploy.

## Local Docker

```bash
docker compose up --build
```

The application becomes available at `http://localhost:3000`, FastAPI docs are available at `http://localhost:8000/docs`, and startup auto-runs database readiness and migrations. First-time seeding runs only when `SEED_MOCK_DATA=true`.
