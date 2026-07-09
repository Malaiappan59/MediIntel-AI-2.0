# MediIntel Architecture Notes

## Frontend

- App Router structure with protected application routes
- JWT-backed auth context for role-aware navigation
- Shared app-data provider that hydrates from backend APIs and surfaces live-data errors instead of silently falling back
- Copilot-style MedIntel AI drawer with mission greeting, suggested prompts, chat history, reasoning, and confidence
- Dashboard, Agent, Memory, Tools, Alerts, and Settings pages built as functional operational modules

## Backend

- FastAPI application entrypoint
- Versioned API routers for dashboard, inventory, forecast, orders, alerts, files, upload, APIs, chat, and master-agent launch
- JWT authentication, refresh sessions, and RBAC-backed route dependencies
- PostgreSQL-backed service layer for dashboard, procurement, alerts, approvals, files, APIs, audit, and chat workflows
- SQLAlchemy models and Alembic migration foundation for PostgreSQL

## Data Layer

- PostgreSQL connection configured through environment variables
- Core entity coverage for users, inventory, forecast, orders, suppliers, alerts, files, APIs, audit logs, and chat history
- Deterministic reference-data driven seed generation shared across database bootstrap workflows
- Demo PostgreSQL bootstrap path that can recreate 102 medicines, 10 suppliers, 50 procurement requests, 30 alerts, and scenario-rich audit and approval history
