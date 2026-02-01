# Freelance Forge

Full-stack freelance invoicing app using Rust (Axum + SeaORM), React, and PostgreSQL.

## Requirements

- Docker Desktop (recommended for local dev)
- Rust toolchain (only if running the backend directly)

## Environment variables

Create a `.env` file at the repo root (already included in this repo for local use):

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=freelance_forge
DATABASE_URL=postgresql://forge:forge@db:5432/freelance_forge
```

Notes:
- `DATABASE_URL` uses the Docker service name `db` as the host.
- If you run the backend outside Docker, change the host to `localhost`.

## Run with Docker (recommended)

```bash
docker compose up --build
```

- Backend: `http://localhost:3000`
- Postgres: `localhost:5432`
- Frontend (Vite dev server): `http://localhost:5173`

Migrations run automatically on backend startup.

## Run backend locally (without Docker)

1) Make sure Postgres is running locally.
2) Update `DATABASE_URL` in `.env` to use `localhost`.
3) Start the backend:

```bash
cd backend
cargo run
```

## Run frontend locally

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `frontend/.env` if your backend is not running at `http://localhost:3000`.

## API endpoints

- `GET /` — health check
- `POST /auth/register` — register + login
- `POST /auth/login` — login
- `POST /auth/logout` — logout
- `GET /auth/me` — current user
- `POST /company` — create company
- `GET /company/me` — fetch current company
- `POST /invoices` — create invoice
- `GET /invoices/:id` — fetch invoice by UUID
