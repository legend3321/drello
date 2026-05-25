# Drello

Real-time collaborative Kanban board: **Next.js** frontend + **Django** backend with WebSockets (Django Channels).

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 15, React 19, Zustand, @hello-pangea/dnd |
| Backend | Django 5, Django REST Framework, Django Channels |
| Database | SQLite (dev) — swap to PostgreSQL in production |
| Real-time | WebSockets (`ws://`) per board room |

> **Note:** The original brief used Node + Socket.io + MongoDB. This repo uses **Django Channels** (WebSockets) and **Django ORM** instead — same features, idiomatic Python stack.

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

`daphne` is listed first in `INSTALLED_APPS`, so **`runserver` serves both REST and WebSockets** on port 8000.

### Frontend

Requires [Node.js](https://nodejs.org/) 20+.

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to **Sign in**.

### Demo account

```bash
python manage.py seed_demo --username demo
```

Sign in with **demo** / **demo12345**, or register a new account at `/register`.

## Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register/` | POST | No | Create account |
| `/api/auth/login/` | POST | No | Returns JWT `access` + `refresh` |
| `/api/auth/refresh/` | POST | No | Refresh `access` token |
| `/api/auth/me/` | GET | Bearer | Current user profile |

All board/list/card endpoints require `Authorization: Bearer <access_token>`.

Boards can be **personal** (`owner` only) or **team-owned** (`Board.team`). Team access uses **Django auth Groups** — each hierarchy level in a team maps to one `Group`, and membership syncs the user into that group.

### Teams & roles

| Concept | Description |
|---------|-------------|
| **Team** | Named workspace; users can belong to many teams |
| **Role level** | Per-team hierarchy tier (rank 0 = highest), each linked to a `django.contrib.auth.models.Group` |
| **Membership** | User + team + role level; drives board permissions |

Default hierarchy when a team is created: **Owner → Admin → Member → Viewer**.

| Role | Typical powers |
|------|----------------|
| Owner | Full team control, custom hierarchy levels |
| Admin | Team admin dashboard, manage members & boards |
| Member | Edit boards, lists, cards |
| Viewer | Read-only board access |

Team admin dashboard: `GET /api/teams/:id/admin-dashboard/` (Admin/Owner only).

WebSockets require `?token=<access_token>` on connect; team boards allow any member to subscribe.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Django REST base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://127.0.0.1:8000` | Channels WebSocket base |

## API overview

All routes below require authentication unless noted.

- `GET /api/teams/` — list teams you belong to
- `POST /api/teams/` — create team (you become Owner)
- `GET /api/teams/:id/admin-dashboard/` — team admin stats, members, hierarchy
- `POST /api/teams/:id/members/add/` — add member (`username`, `role_level_id`)
- `GET /api/boards/` — list personal + team boards you can access
- `GET /api/boards/:id/` — board with nested lists + cards
- `POST /api/lists/` — create list
- `POST /api/cards/` — create card
- `PATCH /api/cards/:id/move/` — move card (`list_id`, `position`)
- Full CRUD on boards, lists (columns), and cards — rename inline in the UI; delete with confirmation

WebSocket events: `board_updated`, `board_deleted`, `list_created`, `list_updated`, `list_deleted`, `card_created`, `card_updated`, `card_moved`, `card_deleted`.

## Project layout

```
drello/
├── backend/
│   ├── teams/        # Teams, hierarchy, Django groups
│   ├── boards/       # Kanban boards, lists, cards
│   └── accounts/     # Auth
├── frontend/         # Next.js app (/teams, /teams/:id/admin)
└── README.md
```
