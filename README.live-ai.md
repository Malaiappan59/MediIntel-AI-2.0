# MediIntel Live-AI Notes

This folder is the isolated live-AI variant of MediIntel.

What changed:
- Chat responses now come only from the backend model runtime.
- The frontend no longer creates local assistant replies for procurement or chat.
- Chat history is scoped to the logged-in user.
- Suppliers now load from the backend database.
- Default degraded mode and mock-data seeding are disabled in the example environment files.

What this version requires:
- A working PostgreSQL database with MediIntel tables and real records.
- A valid `OPENAI_API_KEY`.
- A valid `JWT_SECRET_KEY`.
- Login-capable user records already present in the database.

Recommended demo bootstrap:
- Run `python -m database.postgres_demo bootstrap --create-db --reset` on the machine that has working Python and PostgreSQL access.

Expected behavior:
- If backend data is missing, the UI shows an error banner instead of inventing dashboard content.
- If the AI runtime is not configured, `/api/v1/chat` fails clearly instead of returning deterministic fallback text.
