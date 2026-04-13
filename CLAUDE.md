# CLAUDE.md — Yappd Project Reference

## Project Overview
Yappd is a fullstack AI productivity dashboard with a Kanban board and Claude-powered AI sidebar.
- Frontend: React + Vite + Tailwind CSS + React Router (`client/`, port 5173)
- Backend: Node.js + Express (`server/`, port 8000)
- Database: PostgreSQL via Prisma ORM (Supabase hosted)
- Auth: JWT stored in httpOnly cookies (never localStorage)
- AI: Claude API (Sonnet) with streaming responses (Phase 3)

## Repository Layout
```
yappd/
├── client/     React + Vite frontend (port 5173)
├── server/     Express API (port 5000)
└── CLAUDE.md
```

## Running the Project
```bash
# Terminal 1 — server
cd server && npm run dev      # nodemon, port 5000

# Terminal 2 — client
cd client && npm run dev      # Vite, port 5173
```

## API Conventions
- All routes prefixed: `/api/v1`
- Auth routes: `/api/v1/auth/{register,login,refresh,logout}`
- Health check: `GET /api/v1/health`
- Protected routes use the `authenticate` middleware

## Auth Flow
- Access token: JWT, 15min TTL, httpOnly cookie `access_token`
- Refresh token: JWT, 7d TTL, httpOnly cookie `refresh_token`
  - Also stored in `users.refreshToken` in DB for reuse detection
- Logout nulls DB refreshToken and clears both cookies
- Client silently restores session on mount via `POST /api/v1/auth/refresh`

## Server Structure (`server/src/`)
```
config/       prisma.js — PrismaClient singleton
routes/       index.js, auth.routes.js, health.routes.js
controllers/  auth.controller.js
middleware/   authenticate.js, errorHandler.js
utils/        jwt.js
```

## Client Structure (`client/src/`)
```
api/          axiosClient.js  — baseURL=/api/v1, withCredentials:true
context/      AuthContext.jsx — user state, login/register/logout, silent refresh
hooks/        useAuth.js
pages/        Login.jsx, Register.jsx, Dashboard.jsx
components/   ProtectedRoute.jsx
```

## Key Packages
- **Server:** express, @prisma/client, bcrypt, jsonwebtoken, cookie-parser, cors, dotenv, express-async-errors
- **Client:** react, react-router-dom, axios, tailwindcss

## Database
- Provider: PostgreSQL (Supabase)
- ORM: Prisma — no raw SQL ever
- Schema: `server/prisma/schema.prisma`
- Migration: `cd server && npx prisma migrate dev --name <name>`
- Studio: `cd server && npx prisma studio`

## User Model
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| email | String | Unique |
| passwordHash | String | bcrypt, 12 rounds |
| refreshToken | String? | Nullable — null after logout |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

## Environment Variables
### `server/.env`
```
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/yappd?schema=public
JWT_ACCESS_SECRET=<256-bit hex>
JWT_REFRESH_SECRET=<256-bit hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### `client/.env`
```
# Not needed in dev — Vite proxy routes /api → localhost:5000
```

## Error Handling
- `express-async-errors` patches all async handlers — no try/catch needed
- All errors route to `src/middleware/errorHandler.js`
- Throw pattern:
  ```js
  const err = new Error('Unauthorized'); err.status = 401; throw err;
  ```

## Code Conventions
- `async/await` only — no callbacks, no `.then()` in server code
- No hardcoded secrets — all from `process.env`
- Prisma for all DB access — no raw SQL
- CORS: `credentials: true`, origin from `CLIENT_ORIGIN` env var
- Cookie flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production
