# SGMS — Student Grade Management System

SGMS stores students, courses, and grades in SQLite through Prisma. The
database is the source of truth; the browser talks to the Node API, and core
services depend on repository ports rather than a process-local store.

## Local development

Requirements: Node.js 24.18.0 and pnpm 11.3.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` generates the Prisma client and applies checked-in migrations before
starting the API and Vite development server. The default database is
`dev.sqlite` in the repository root. Set `DATABASE_URL` to a Prisma SQLite URL
such as `file:./dev.sqlite` to use another file.

## Docker

```sh
docker compose up --build
```

The container applies migrations on startup and stores the database at
`/data/sgms.sqlite` in the `sgms-data` volume.
