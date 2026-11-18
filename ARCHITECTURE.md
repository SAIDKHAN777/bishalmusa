# System Architecture

This document records the runtime architecture, API contract, and storage design for the Bishal Musa Portfolio and Admin CMS.

## API Contract

Both the local Astro SSR backend (`src/pages/api/`) and the production Cloudflare Worker (`cloudflare/worker.ts`) expose the same REST contract under `/api/*`.

### Public Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Runtime and database connectivity health check |
| GET | `/api/portfolio/public` | Returns live site configuration and published work items |
| POST | `/api/portfolio/inquiries` | Validates and stores client project requirements (rate-limited + honeypot) |
| GET | `/api/uploads/:filename` | Serves persisted image thumbnails, photos, and Resume PDFs |

### Admin Endpoints (Session Cookie Required)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Verifies admin password and issues `HttpOnly` `admin_session` cookie |
| GET | `/api/admin/auth/me` | Validates active admin session |
| POST | `/api/admin/auth/logout` | Invalidates session record and clears cookie |
| POST | `/api/admin/auth/password` | Rotates admin password hash in database |
| GET | `/api/admin/portfolio/bootstrap` | Loads full config, all works (published + draft), and client inquiries |
| PUT | `/api/admin/portfolio/config` | Validates and persists full site configuration |
| POST | `/api/admin/portfolio/works` | Creates a new work item in one of the four disciplines |
| PUT | `/api/admin/portfolio/works/:id` | Updates an existing work item |
| DELETE | `/api/admin/portfolio/works/:id` | Soft-deletes a work item |
| POST | `/api/admin/portfolio/works/reset` | Restores starter showcase items |
| PATCH | `/api/admin/portfolio/inquiries/:id` | Updates inquiry status (`new`, `read`, `replied`) |
| DELETE | `/api/admin/portfolio/inquiries/:id` | Soft-deletes a client inquiry |
| POST | `/api/admin/portfolio/upload` | Uploads raster image or Resume PDF to persistent storage |
| DELETE | `/api/admin/portfolio/resume` | Removes custom Resume PDF and reverts to starter PDF |

## Frontend Code-Splitting Strategy

To minimize initial payload size and keep Largest Contentful Paint fast for public visitors, `frontend/src/App.tsx` loads heavy secondary modules via `React.lazy()` and `<Suspense>`:

- `AdminWorkPage` is downloaded only when navigating to `/admin`.
- `CategoryWorkPage` is downloaded when opening a discipline gallery (`/work/:category`).
- `ResumeDialog` and `PdfCanvasViewer` (`pdfjs-dist`) are downloaded only when a visitor clicks `RESUME`.

This reduces the initial homepage JavaScript chunk from 969 KB down to 402 KB (127 KB gzip).

## Binary Storage in Cloudflare D1

Because Cloudflare D1 enforces a per-row parameter size limit, binary uploads (images and multi-megabyte Resume PDFs) are split into 450 KB raw slices, base64-encoded, and stored across `uploads` and `upload_chunks` in a single atomic `DB.batch()` transaction. When a Resume PDF is replaced or removed, prior chunks are purged cleanly to prevent storage bloat.
