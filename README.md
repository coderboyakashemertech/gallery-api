# Gallery

Express API with username/password auth, JWT sessions, optional route protection, TOTP-based 2FA, and Prisma + SQLite persistence.

## Run

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Start the server with `npm run dev` or `npm start`

## Build

- `npm run build` creates a `dist/` output
- `npm run start:build` runs the built app from `dist/src/server.js`

## Environment

- `PORT=3000`
- `AUTH_ENABLED=false`
- `JWT_SECRET=change-me-in-production`
- `JWT_EXPIRES_IN=1h`
- `DATABASE_URL="file:./dev.db"`

## Auth model

Users register with:

- `username`
- `name`
- `password`

Passwords are stored as hashes in SQLite through Prisma.

## Database

- ORM: Prisma
- Database: SQLite
- Prisma schema: `prisma/schema.prisma`
- Local database file: `prisma/dev.db`

Useful commands:

- `npm run db:setup`
- `npm run db:push`
- `npm run db:studio`

## Route protection flag

- `AUTH_ENABLED=false`: `/api/*` routes are open
- `AUTH_ENABLED=true`: `/api/*` routes require `Authorization: Bearer <jwt>`

`/auth/*` routes are always available so you can register, log in, and manage 2FA regardless of the API protection flag.

## API documentation

Open Swagger UI at `/docs` after starting the server.
Raw OpenAPI JSON is available at `/docs.json`.
