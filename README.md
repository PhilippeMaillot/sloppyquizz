# SloppyQuizz

Base full-stack project for an interactive quiz creation and live hosting app.

This first setup phase includes:

- a modular FastAPI backend;
- MongoDB connection bootstrap;
- Socket.IO bootstrap for future realtime features;
- a React + TypeScript frontend with base routing;
- placeholder pages for the main MVP flows;
- a root `.env.example`.

## Project Structure

```txt
backend/
  app/
    config.py
    main.py
    database/
    routes/
    models/
    services/
    websocket/
    utils/
frontend/
  src/
    app/
    pages/
    components/
    features/
    services/
    stores/
    types/
docs/agent/
```

## Prerequisites

- Node.js 22+
- Python 3.13+
- MongoDB running locally on port `27017`

## Environment Variables

Copy the root example file and adjust values if needed:

```bash
cp .env.example .env
```

The backend reads standard environment variables such as `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL` and `UPLOAD_DIR`.

The frontend uses:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Run The Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```txt
GET http://localhost:8000/api/health
```

## Run The Frontend

```bash
cd frontend
npm install
export $(grep -v '^#' ../.env | xargs)
npm run dev
```

Frontend default URL:

```txt
http://localhost:5173
```

## Run With Docker

Start the full stack with Docker Compose:

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

Stop everything:

```bash
docker compose down
```

Stop and remove volumes too:

```bash
docker compose down -v
```

## Useful Commands

Frontend build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
python3 -m compileall backend/app
```

## Current Scope

Implemented in this setup phase:

- backend folder architecture;
- FastAPI app bootstrap;
- MongoDB connection manager and index bootstrap;
- CORS and static uploads mounting;
- Socket.IO bootstrap placeholder;
- health route;
- frontend React bootstrap;
- React Router base configuration;
- empty MVP pages for auth, dashboard, editor and room flows.

Not implemented yet:

- authentication logic;
- quiz CRUD;
- live room gameplay;
- answer submission;
- reveal/scoring;
- blind test audio;
- Groq AI correction;
- leaderboards.

## Next Recommended Step

Implement Phase 2 from `docs/agent/16_MVP_ROADMAP.md`:

1. register route;
2. login route;
3. JWT generation and password hashing flow;
4. current user route;
5. login/register forms on the frontend;
6. auth store wiring and protected routes.
