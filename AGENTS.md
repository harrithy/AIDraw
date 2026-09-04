# Repository Guidelines

## Project Structure & Module Organization

This npm workspace keeps the application in `client/`. React/TypeScript source lives in `client/src/`: UI in `components/`, interaction logic in `hooks/`, domain utilities in `lib/`, provider adapters in `lib/providers/`, and persistence in `lib/storage/`. Put static files in `client/public/`. API handlers live in `client/api/`; root `api/` files expose them to Vercel. Tests are colocated as `*.test.ts`. Do not edit generated `dist/` directories.

## Build, Test, and Development Commands

- `npm ci` installs the exact lockfile dependencies; CI uses Node.js 22.
- `npm run dev` starts Vite at `http://127.0.0.1:5173` with local API middleware.
- `npm run check` runs the strict TypeScript project check.
- `npm test` runs all Vitest tests once in the `happy-dom` environment.
- `npm run build` type-checks and creates the production bundle.
- `npm run test --workspace client -- src/lib/jobRetry.test.ts` runs one targeted test file. Paths passed to Vitest are relative to `client/`.

Before submitting changes, run `npm run check`, `npm test`, and `npm run build`.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and surrounding-code conventions for trailing commas. Name React components and files in `PascalCase`, hooks with a `use` prefix, and functions or variables in `camelCase`. Prefer explicit domain types and the `@/` alias for `client/src`. Keep provider-specific requests, authentication, statuses, and errors inside provider adapters; route selection through `providerRegistry.ts`. No formatter or linter is configured, so match nearby code and run the TypeScript check.

## Testing Guidelines

Vitest discovers `client/src/**/*.test.ts` and `client/api/**/*.test.ts`. Add focused tests beside changed utilities, providers, queue policies, or request guards. Cover success, failure, migration, and retry boundaries when relevant. There is no numeric coverage threshold.

## Commit & Pull Request Guidelines

History uses Conventional Commit-style prefixes such as `feat:`, `fix:`, and `docs:`, with optional scopes (for example, `feat(model): ...`). Keep commits focused. Pull requests should explain behavior changes, identify affected providers or storage migrations, link issues, and include screenshots for UI changes. Report verification commands and update API or README documentation when configuration changes.

## Security & Configuration

Copy `.env.example` for local server-side settings; never commit real API keys. Preserve remote URL validation, redirect handling, upload limits, request guards, and their tests when modifying proxy or upload behavior.
