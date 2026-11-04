# Agent rules for SGMS

This project follows the rat-stack conventions adapted for the SGMS stack decision (2026-11-04).

## Stack contract

- **Runtime**: Node 24.18.0 with pnpm 11.3.0 (declared in `.nvmrc`, `engines`, `packageManager`)
- **Backend**: Rat Stack on Effect 4 — hexagonal architecture, capability pattern (`defineContract` → `implement` → projections)
- **Frontend**: Foldkit 0.170.0 — Elm Architecture (Model / update / Command)
- **Database**: Prisma v7 + SQLite
- **Packaging**: Fully Dockerized
- **CI/CD**: GitHub Actions — run tests; on pass, build the Docker image as a sanity check. No GHCR push.

## Workspace

pnpm workspaces + Turborepo: `apps/*` + `packages/*`. Do not replace pnpm with Bun or npm for installs.

## Vendored repositories (Effect git trick)

This project vendors external repositories under `@repos/` for agent reference.

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under `@repos/` unless explicitly asked
- Do not import from `@repos/` — application code should continue importing from normal package dependencies

## Testing

- `@effect/vitest` for every Effect test: `it.effect` and `it.layer(layer)`
- `Effect.run*` and `ManagedRuntime.make` in test files are a lint error
- Foldkit: Story tests for state machines, Scene tests for view interactions

## Conventions

- Effect Schema defines input/output/failure schemas for every capability
- `Schema.TaggedError` for typed failures
- `Context.Service` for application services
- `Layer.effect` for service implementations
- Hexagonal architecture: ports in `packages/core`, adapters outside core
- pnpm lockfile: `pnpm install --frozen-lockfile` in CI
