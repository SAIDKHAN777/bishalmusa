# Bishal Musa Portfolio and Studio CMS

Full-stack creative portfolio and content management platform built for Bishal Musa. The application serves a minimal editorial public showcase across four creative disciplines (Video Editing, Graphic Design, Motion Graphics, and Digital Marketing), an inline full-page Resume PDF viewer, a client requirement submission flow, and a password-protected Admin CMS.

Designed and engineered by Said Khan.

Live Production URL: https://bishalmusa.khalidworks.workers.dev

---

## Overview

The codebase supports two seamless runtime topologies sharing the same React 19 frontend and REST API contract:

1. **Cloudflare Edge Production (`wrangler.jsonc` + `cloudflare/worker.ts`)**:
   - Frontend SPA served via Cloudflare Workers Static Assets (`ASSETS` binding).
   - Dynamic API and authentication handled by a single Cloudflare Worker (`/api/*`).
   - Persistent storage backed by Cloudflare D1 (`bishalmusa-db`), including chunked binary storage for uploaded thumbnails, photos, and Resume PDFs.
2. **Local Full-Stack Development (`frontend/` + `src/` + `prisma/`)**:
   - Vite + React 19 frontend on port `5173` with same-origin `/api` proxy.
   - Astro 5 SSR Node backend on port `4322` backed by PostgreSQL 16 (Prisma ORM) and Redis.

---

## Architecture

```text
Browser (Public Portfolio / Admin CMS)
  |
  +--> Static SPA Assets (React 19, Tailwind CSS v4, Motion, PDF.js)
  |      - Lazy-loaded routes: CategoryWorkPage, AdminWorkPage, ResumeDialog
  |
  +--> /api/* (Same-Origin API Boundary)
         |
         +-- Production: Cloudflare Worker (cloudflare/worker.ts)
         |     - PBKDF2-SHA256 password verification & HttpOnly session cookies
         |     - Cloudflare D1 SQLite (site_settings, works, inquiries, uploads)
         |
         +-- Local Dev: Astro 5 SSR Backend (src/pages/api/*)
               - Argon2id password verification & PostgreSQL sessions
               - Prisma ORM + PostgreSQL 16 + Redis rate limiting
```

---

## Core Features

- **Public Portfolio Interface**:
  - Editorial white-background layout with progressive blur header and scroll-reveal typography.
  - Dynamic Hero and expandable About bio sections with optional inline quick notes.
  - Selected Works across four fixed disciplines: Video Editing, Graphic Design, Motion Graphics, and Digital Marketing.
  - Category galleries: video/project thumbnails open external links (YouTube, Facebook, Vimeo, Behance) directly; Digital Marketing photo items open an in-page white photo lightbox.
  - In-app HiDPI Resume PDF renderer powered by `pdfjs-dist` with zoom controls and direct download.
  - Collapsible Contact requirement form behind a dedicated toggle button.
- **Protected Admin CMS (`/admin`)**:
  - Accessible via `/admin` (or appending `/admin` to any section URL).
  - Server-side session cookies (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS).
  - Manage Hero text, dynamic About bio blocks and inline quick notes, Selected Works intro and category copy, per-category media uploads, Resume PDF uploads, client inquiry inbox (`new`, `read`, `replied`), password rotation, and JSON backups.

---

## Repository Structure

```text
.
├── cloudflare/
│   ├── schema.sql               # Cloudflare D1 SQLite schema
│   └── worker.ts                # Production Cloudflare Worker API & SPA router
├── frontend/
│   ├── public/                  # Static favicon, PDF.js worker, starter resume PDF
│   ├── src/
│   │   ├── components/          # Header, CategoryWorkPage, AdminWorkPage, Modals, ContactForm
│   │   ├── data/                # Client stores and default config definitions
│   │   ├── hooks/               # IntersectionObserver scroll reveal hook
│   │   └── lib/api.ts           # Typed same-origin REST API client
│   ├── index.html
│   └── vite.config.ts
├── prisma/
│   ├── migrations/              # PostgreSQL migration history
│   ├── schema.prisma            # Prisma ORM relational schema
│   └── seed.ts                  # Database seeder
├── scripts/
│   └── code-review.mjs          # Automated 8-gate static analysis & quality runner
├── src/
│   ├── lib/                     # Auth, DB, Redis, error utilities, Zod validators
│   ├── middleware/              # Security headers, CSRF, rate limit, session guard
│   ├── pages/api/               # Astro SSR REST API routes
│   └── services/                # Business logic layer (PortfolioService, AuthService, etc.)
├── ARCHITECTURE.md              # Detailed system design and API contract notes
├── CHANGELOG.md                 # Release and milestone history
├── eslint.config.js             # ESLint v9 + TypeScript + React Hooks flat config
├── cspell.json                  # Identifier and spelling verification config
├── .secretlintrc.json           # Secret and credential leak detection rules
└── wrangler.jsonc               # Cloudflare Workers + Assets + D1 deployment config
```

---

## Local Development Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 16 and Redis 7 (for local Astro backend)

### 1. Install Dependencies

```bash
npm install
npm --prefix frontend install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your local PostgreSQL, Redis, and admin credentials:

```bash
cp .env.example .env
```

Push the Prisma schema and generate the client:

```bash
npm run db:push
npm run db:generate
```

### 3. Start Backend and Frontend

Terminal 1 (Astro API backend on port `4322`):

```bash
npm run dev
```

Terminal 2 (Vite React frontend on port `5173`):

```bash
npm --prefix frontend run dev
```

Open `http://localhost:5173/` for the public site and `http://localhost:5173/admin` for the Admin CMS.

---

## Production Deployment (Cloudflare Workers + D1)

1. Build the frontend bundle:

```bash
npm --prefix frontend run build
```

2. Apply the D1 schema to the remote database:

```bash
npx wrangler d1 execute bishalmusa-db --remote --file=cloudflare/schema.sql
```

3. Deploy the Worker and static assets:

```bash
npx wrangler deploy
```

4. Optionally configure a custom production admin password secret:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

---

## Quality Gates and Code Review

Run the full automated 8-check quality suite (TypeScript backend and frontend checks, Prisma schema validation, strict zero-warning ESLint, Prettier formatting verification, Secretlint credential scan, CSpell spelling audit, and Depcheck dependency hygiene):

```bash
npm run review
```

Individual commands:

```bash
npm run review:lint      # ESLint across backend and frontend
npm run review:secrets   # Secretlint credential leak scan
npm run review:spell     # CSpell identifier and documentation check
npm run review:deps      # Depcheck unused/missing dependency check
npm run build            # Astro backend production build
npm --prefix frontend run build  # Vite frontend production build
```

---

## Security Posture

- Password hashing uses Argon2id (Node/PostgreSQL) and PBKDF2-SHA256 with constant-time comparison (Cloudflare Workers/D1).
- Session tokens are 256-bit cryptographically random values stored as SHA-256 hashes in the database and delivered via `HttpOnly`, `SameSite=Lax` cookies.
- User image uploads restrict MIME types to safe raster formats (`PNG`, `JPEG`, `WEBP`, `GIF`, `AVIF`) to prevent stored SVG XSS; `/api/uploads/*` enforces `X-Content-Type-Options: nosniff` and sandbox headers on any SVG fallback.
- Admin site configuration updates validate URL protocols to reject `javascript:` URIs.
- Public contact submissions enforce IP-based rate limiting and honeypot spam filtering.

---

## License

Copyright (c) 2026 Said Khan. All rights reserved.
