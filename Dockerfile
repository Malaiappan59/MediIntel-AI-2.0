FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
ARG NEXT_PUBLIC_APP_NAME=MediIntel
ARG NEXT_PUBLIC_API_BASE_PATH=/api/backend/v1
ARG NEXT_PUBLIC_LOGIN_REDIRECT=/dashboard
ARG NEXT_PRIVATE_BACKEND_ORIGIN=http://127.0.0.1:8000
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_API_BASE_PATH=${NEXT_PUBLIC_API_BASE_PATH}
ENV NEXT_PUBLIC_LOGIN_REDIRECT=${NEXT_PUBLIC_LOGIN_REDIRECT}
ENV NEXT_PRIVATE_BACKEND_ORIGIN=${NEXT_PRIVATE_BACKEND_ORIGIN}
COPY frontend/package.json ./package.json
RUN npm install
COPY frontend/ ./
RUN mkdir -p /app/frontend/public
RUN npm run build

FROM node:20-bookworm-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv build-essential libpq-dev bash \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r ./backend/requirements.txt

COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

COPY backend ./backend
COPY database ./database
COPY uploads ./uploads
COPY start.sh ./start.sh
COPY .env.example ./.env.example

RUN mkdir -p /app/chromadb /app/uploads \
  && chmod +x ./start.sh

EXPOSE 3000
EXPOSE 8000

CMD ["/bin/bash", "./start.sh"]
