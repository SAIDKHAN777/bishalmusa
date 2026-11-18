# Contributing

## Development Workflow

1. Create a feature or fix branch from `main` using a clear prefix:
   - `feat/<short-description>`
   - `fix/<short-description>`
   - `chore/<short-description>`
   - `docs/<short-description>`
2. Keep pull requests focused on a single logical change.
3. Follow the Conventional Commits format for all commit messages:
   - `feat(admin): add photo-only digital marketing uploader`
   - `fix(security): block svg uploads and enforce sandbox headers`
   - `perf(frontend): lazy-load admin console and pdf viewer`
   - `docs: update cloudflare deployment steps`

## Pre-Commit Quality Gates

Before opening a pull request or pushing to `main`, verify all static checks and production builds pass cleanly:

```bash
npm run review
npm run build
npm --prefix frontend run build
```

All eight checks in `npm run review` (backend TypeScript, frontend TypeScript, Prisma schema validation, strict zero-warning ESLint, Prettier formatting, Secretlint, CSpell, and Depcheck) must pass without warnings or errors.
