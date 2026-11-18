# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-11-18

### Added

- Public editorial portfolio for Bishal Musa with Hero, dynamic About bio blocks with inline quick notes, Selected Works across four disciplines (Video Editing, Graphic Design, Motion Graphics, Digital Marketing), pure-white in-app Resume PDF viewer, and collapsible Contact requirement form.
- Password-protected Admin CMS (`/admin`) with Dashboard, Hero & About editor, Works Studio with category dropdown uploaders (Video Editing, Graphic Design, Motion Graphics, and photo-only Digital Marketing), Resume PDF manager, Contact Inquiries inbox, and Settings & Security.
- Full-stack PostgreSQL + Prisma integration via Astro 5 SSR API routes and Vite same-origin proxy.
- Cloudflare Workers + Static Assets + Cloudflare D1 production runtime (`cloudflare/worker.ts`, `cloudflare/schema.sql`, `wrangler.jsonc`) with chunked binary media storage and PBKDF2-SHA256 authentication.
- Automated 8-gate open-source code review runner (`scripts/code-review.mjs`) enforcing TypeScript, Prisma validation, strict zero-warning ESLint, Prettier, Secretlint, CSpell, and Depcheck.

### Security

- Blocked SVG user uploads and enforced sandboxed `Content-Security-Policy` plus `X-Content-Type-Options: nosniff` on `/api/uploads/*`.
- Added IP-based rate limiting and honeypot validation on public inquiry submissions.
- Added strict URL protocol validation on admin configuration saves to prevent `javascript:` links.

### Performance

- Code-split `AdminWorkPage`, `CategoryWorkPage`, and `ResumeDialog` (`pdfjs-dist`) via `React.lazy()`, reducing initial homepage JS payload by 58.5%.
- Removed unused Three.js dependencies and added `AbortController` teardown for PDF rendering requests.
