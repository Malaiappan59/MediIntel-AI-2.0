# MediIntel

MediIntel is an autonomous hospital operations platform for medicine continuity, procurement intelligence, operational alerting, and grounded decision support. The project now extends beyond scaffolding with a production-style frontend experience, real JWT authentication, PostgreSQL-backed services, an OpenAI Agents SDK workspace boundary, approval workflows, audit trails, and Chroma-backed knowledge indexing.

## Stack

- Frontend: Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- Backend: FastAPI, Python
- Database: PostgreSQL
- Authentication: JWT access tokens, refresh sessions, RBAC, protected routes
- Deployment: Docker, Railway-ready container orchestration, Vercel frontend deployment, and a Vercel-safe FastAPI backend entrypoint

## Project Structure

```text
medintel/
|-- frontend/
|-- backend/
|-- database/
|-- uploads/
|-- docs/
|-- README.md
|-- docker-compose.yml
|-- Dockerfile
`-- railway.json
```

## What Is Included

- Dashboard with mission view, hospital health score, forecast chart, medicine consumption, latest orders, alerts, and procurement activity
- Master Agent workspace with backend-launched execution state, structured AI responses, and Copilot-style operations UI
- Master Agent workspace with grounded source cards so users can inspect the policy or contract evidence behind AI responses
- Master Agent workspace with operational trace cards that deep-link AI actions into procurement, approvals, and audit history
- Master Agent workspace with a response hub, per-message follow-up actions, live agent execution state, and trace-linked report exports
- Global operations inbox plus focused alert and knowledge drill-downs for faster triage from the shell and AI workspace
- Knowledge repository with Chroma indexing hooks, multi-upload, bulk delete, grounded citation review, and repository audit workflows
- Knowledge repository with TXT, PDF, and DOCX ingestion, extracted-text preview, stored originals, and Chroma chunk indexing
- Operations console for procurement, approvals, audit logs, and API registry management
- Operations console with a procurement launchpad, focused order drill-downs, bulk approval actions, audit-linked review history, and enterprise filtering
- Alerts page with bulk triage, focused drill-downs, and linked resolution workflow
- Settings page for general, theme, hospital, notifications, AI, and user preferences
- Per-user workspace settings persistence with live shell updates for profile, facility, density, and workspace context
- FastAPI REST APIs for login, logout, refresh, dashboard, digital twin, inventory, forecast, procurement, approvals, alerts, files, APIs, audit, chat, and master-agent launch
- PostgreSQL SQLAlchemy models, Alembic migration support, and optional enterprise seed data for development environments
- OpenAI Agents SDK orchestration boundary with GPT-4.1 configuration and Chroma-backed knowledge search
- Bootstrap automation for database wait, Alembic migrations, and idempotent seed loading
- Railway deployment files and local Docker Compose setup

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY`. The live-AI workspace will fail clearly without it.
3. Update secrets and environment values as needed.
4. Run the stack:

```bash
docker compose up --build
```

On first boot the container waits for PostgreSQL and applies Alembic migrations. Seed loading only runs if you explicitly enable `SEED_MOCK_DATA=true`.

5. Open the app:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000/docs`

## Demo PostgreSQL Bootstrap

If you are running Python directly on Windows instead of Docker Compose, point `DATABASE_URL` to `localhost` instead of the Docker-only hostname `database`. You can start from `.env.local-postgres.example` for that setup.

Example:

```env
DATABASE_URL=postgresql+psycopg://medintel:medintel@localhost:5432/medintel
```

Create the schema and load the realistic MediIntel demo dataset with:

```bash
python -m database.postgres_demo bootstrap --reset
```

If the target `medintel` database itself does not exist yet on your PostgreSQL server, use:

```bash
python -m database.postgres_demo bootstrap --create-db --reset
```

This bootstrap path:

- can create the target PostgreSQL database when your configured user has that permission
- waits for PostgreSQL connectivity
- runs Alembic migrations
- seeds 102 medicines, 10 suppliers, 50 procurement requests, 30 alerts, approvals, invoices, files, APIs, and audit logs
- synchronizes the seeded knowledge files into Chroma for retrieval demos
- prints a row-count summary so you can confirm the load succeeded

## Environment Variables

Core values are documented in `.env.example`.

- `NEXT_PUBLIC_API_BASE_PATH`: Browser-facing API proxy path
- `NEXT_PRIVATE_BACKEND_ORIGIN`: Build-time proxy target for Next.js rewrites
- `DATABASE_URL`: SQLAlchemy and Alembic connection string
- `RUN_DB_MIGRATIONS`: Applies Alembic on container startup when `true`
- `SEED_MOCK_DATA`: Disabled by default in this live-AI variant; enable only when you intentionally want development seed data
- `UPLOADS_PATH`: Filesystem location for uploaded knowledge documents
- `RAG_CHUNK_SIZE`: Target chunk size used when indexing knowledge files
- `RAG_CHUNK_OVERLAP`: Overlap used between knowledge chunks for retrieval continuity
- `JWT_SECRET_KEY`: Access and refresh signing secret
- `JWT_SECRET_KEY_FILE`: Optional file-based secret source for the JWT signing key
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`: Refresh session lifetime
- `BACKEND_CORS_ORIGINS`: Allowed frontend origins for the API
- `OPENAI_API_KEY`: Required for live MediIntel AI responses
- `OPENAI_API_KEY_FILE`: Optional file-based secret source for the OpenAI API key
- `OPENAI_REQUEST_TIMEOUT_SECONDS`: Upper bound for each agent-runtime request before the live model request is failed
- `AGENT_DEGRADED_MODE_ENABLED`: Keep this `false` when you want model-only responses with no deterministic fallback
- `CHROMADB_PATH`: Persistent path for the knowledge vector store

## Frontend Notes

- `/login` authenticates against the FastAPI backend and stores JWT + refresh session state locally for the browser app shell.
- Middleware protects application routes by checking for the active session cookie.
- The frontend now consumes backend-only data for inventory, orders, alerts, knowledge, audit, and chat history.

## Backend Notes

- `backend/main.py` boots the FastAPI app and registers enterprise routes.
- `app.py` exposes the FastAPI application from the repository root so the backend can be deployed directly as a Vercel Python project.
- `backend/auth` contains the current-user and RBAC dependencies.
- `backend/agents` contains the OpenAI Agents SDK workspace boundary.
- `backend/rag` contains the Chroma-backed knowledge service.
- `backend/services/knowledge_ingestion_service.py` extracts supported document types, stores originals, and prepares retrieval content.
- `backend/database/mock_seed.py` generates realistic hospital demo data with shortage, approval, supplier, expiry, and audit scenarios.
- `database/seed.py` populates PostgreSQL with deterministic enterprise data.
- `database/postgres_demo.py` is the recommended command-line entrypoint for demo PostgreSQL migrate, seed, reset, and summary workflows.
- `backend/tests/test_agent_smoke.py` provides route-level smoke coverage for `/api/v1/chat` and `/api/v1/master-agent/launch`, including live-runtime failure handling.

## Backend Smoke Tests

Run the route-level agent smoke tests from the project root:

```bash
python -m unittest backend.tests.test_agent_smoke
```

The smoke suite uses a temporary SQLite database, overrides authentication for the test client, validates the master-agent launch route, validates the live chat response contract with a mocked agent runtime, and confirms missing live-AI configuration returns a service-unavailable response.

## Seed Credentials

These accounts are relevant only when you intentionally load the optional development seed dataset.

- Username: `admin`
- Password: `MediIntel@123`
- Other seeded usernames: `inventory.manager`, `procurement.manager`, `pharmacist`, `auditor`, `viewer`

## Vercel-Only Split Deployment

When you need to keep both the frontend and backend on Vercel, use two Vercel projects from the same repository:

- Frontend project root: `frontend`
- Backend project root: repository root (`medintel`)

The backend Vercel project uses the root `app.py` entrypoint and root `requirements.txt`, which forwards directly into `backend.main:app`.

- Keep `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1` on the frontend.
- Set `NEXT_PRIVATE_BACKEND_ORIGIN=https://<your-backend-vercel-domain>` on the frontend project before deploying.
- Set `FRONTEND_APP_URL=https://<your-frontend-vercel-domain>` and `BACKEND_CORS_ORIGINS=https://<your-frontend-vercel-domain>` on the backend project.
- Set `DATABASE_URL`, `JWT_SECRET_KEY`, `OPENAI_API_KEY`, and the rest of the backend secrets on the backend project.
- Use `.env.vercel.frontend.example` and `.env.vercel.backend.example` as the Vercel project variable reference.
- Run Alembic migrations and the seed script from CI or a local Python environment against the managed PostgreSQL instance before first use. Do not rely on function startup for this path.

When the backend detects the Vercel runtime, the default `UPLOADS_PATH` and `CHROMADB_PATH` are redirected into a temporary runtime directory so the function can start safely. This keeps uploads and retrieval working in a preview-safe mode, but those paths are still ephemeral and should be replaced with managed object and vector storage for durable production behavior.

## Split Deployment

For a Vercel frontend plus Render backend deployment:

- Keep `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1` on the frontend.
- Set `NEXT_PRIVATE_BACKEND_ORIGIN` in Vercel to your Render backend URL so the browser stays same-origin while Vercel rewrites requests to FastAPI.
- Set `FRONTEND_APP_URL` and `BACKEND_CORS_ORIGINS` on the backend to your Vercel domain.
- Leave `RUN_DB_MIGRATIONS=true` for first deployment, and keep `SEED_MOCK_DATA=false` unless you explicitly want development seed data.

Detailed deployment instructions are in `docs/deployment-guide.md`.

## Railway Deployment

Railway still uses the root `Dockerfile` and `railway.json`.

- The frontend is served on the Railway-assigned `$PORT`.
- The backend runs internally on port `8000`.
- Next.js rewrites `/api/backend/*` to the internal FastAPI service.
