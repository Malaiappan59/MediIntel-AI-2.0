# MediIntel AI

MediIntel AI is a hospital operations platform designed to support medicine continuity, procurement workflows, operational alerting, and decision support. It brings key hospital operations into a single interface, including inventory, orders, alerts, approvals, knowledge resources, and audit history.

**Live application:** [MediIntel AI](https://mediintel-frontend.vercel.app/login)

## Technology Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** FastAPI, Python
- **Database:** PostgreSQL
- **Authentication:** JWT access tokens, refresh sessions, role-based access control (RBAC), and protected routes
- **Deployment:** Docker and Vercel, with a Vercel-compatible FastAPI backend entrypoint

## Features

- **Operations dashboard:** Overview of hospital operations, medicine consumption, forecasts, recent orders, alerts, and procurement activity
- **Operations workspace:** Central interface for operational questions and AI-assisted decision support
- **Inventory and procurement:** Tools to review medicine inventory, orders, procurement requests, and supplier activity
- **Alerts and triage:** View, review, and manage operational alerts and their resolution workflow
- **Approvals and audit history:** Review approval workflows and track operational activity
- **Knowledge resources:** Upload and review supporting documents and reference material
- **User access control:** JWT-based authentication, refresh sessions, role-based permissions, and protected application routes
- **Settings:** User and workspace preferences
- **FastAPI endpoints:** Backend APIs for authentication and the application's operational features

## Project Structure

```text
medintel/
├── frontend/
├── backend/
├── database/
├── uploads/
├── docs/
├── README.md
├── docker-compose.yml
├── Dockerfile
├── app.py
└── requirements.txt
```

## Run Locally

### Prerequisites

- Node.js compatible with your Next.js setup
- Python compatible with your FastAPI backend
- PostgreSQL
- Docker, if you prefer to run the services using the Docker setup

### Environment configuration

Configure the environment variables for your local setup. The main settings include:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET_KEY` — secret used to sign JWT tokens
- `BACKEND_CORS_ORIGINS` — frontend origins allowed to call the backend
- `NEXT_PUBLIC_API_BASE_PATH` — API path used by the frontend
- `NEXT_PRIVATE_BACKEND_ORIGIN` — backend origin used by the frontend's server-side proxy, when configured

Keep secrets in environment variables and do not commit real credentials to the repository.

### Start with Docker

From the project root, configure the required environment variables and run:

```bash
docker compose up --build
```

When the local services are running, the frontend is expected at `http://localhost:3000`. If the backend is running separately on port `8000`, its FastAPI documentation is available at `http://localhost:8000/docs`.

## Deploy to Vercel

The application is deployed on Vercel. If the frontend and backend are configured as separate Vercel projects from the same repository, use the following setup.

### Frontend project

- **Project root:** `frontend`
- Set `NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1`.
- Set `NEXT_PRIVATE_BACKEND_ORIGIN` to the deployed FastAPI backend's Vercel URL.

### Backend project

- **Project root:** repository root
- Use the root `app.py` entrypoint, which exposes the FastAPI application.
- Configure `DATABASE_URL` for the PostgreSQL database.
- Configure `JWT_SECRET_KEY` with a secure value.
- Set `FRONTEND_APP_URL` and `BACKEND_CORS_ORIGINS` to the deployed frontend URL.

Set environment variables in Vercel project settings, and make sure the frontend's backend origin and the backend's allowed frontend origin match the deployed URLs. Do not commit production secrets to GitHub.

## Authentication

MediIntel uses JWT access tokens, refresh sessions, role-based access control (RBAC), and protected routes. The frontend login flow communicates with the FastAPI backend to authenticate users.

## Notes

- The public link above points to the deployed frontend login page.
- The database must be reachable by the backend in the deployed environment.
- Confirm that all required environment variables are configured in Vercel before deploying or redeploying.
