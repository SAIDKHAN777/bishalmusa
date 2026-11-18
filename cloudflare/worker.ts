/**
 * Cloudflare Worker API & Static Asset Router for Bishal Musa Portfolio.
 * Backed by Cloudflare D1 (SQLite) for persistent content, works, inquiries,
 * admin sessions, and chunked binary media storage.
 */

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}

interface AssetsFetcherLike {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1DatabaseLike;
  ASSETS: AssetsFetcherLike;
  ADMIN_PASSWORD?: string;
}

type WorkCategoryId = 'video-editing' | 'graphic-design' | 'motion-graphics' | 'digital-marketing';

interface WorkRow {
  id: string;
  category_id: string;
  title: string;
  work_url: string | null;
  thumbnail_url: string;
  caption: string | null;
  status: string;
  tags_json: string;
  created_at: string;
}

interface InquiryRow {
  id: string;
  name: string;
  email: string;
  service: string;
  budget: string | null;
  message: string;
  status: string;
  created_at: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_salt: string;
  password_hash: string;
}

interface UploadRow {
  filename: string;
  original_name: string;
  kind: string;
  mime_type: string;
  size_bytes: number;
  chunk_count: number;
}

const VALID_CATEGORIES: WorkCategoryId[] = [
  'video-editing',
  'graphic-design',
  'motion-graphics',
  'digital-marketing',
];

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const CHUNK_RAW_BYTES = 450 * 1024; // ~600 KB base64 per row, safely below D1's 1 MB parameter limit

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeThumbSvg(label: string, subtitle: string, bgStart: string, bgEnd: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="1060" cy="150" r="240" fill="#e97f61" fill-opacity="0.18"/>
    <circle cx="200" cy="600" r="190" fill="#e97f61" fill-opacity="0.12"/>
    <rect x="64" y="64" width="1152" height="592" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>
    <text x="110" y="340" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="60" font-weight="600">${escapeXml(label)}</text>
    <text x="110" y="405" fill="#d6d6d6" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="300">${escapeXml(subtitle)}</text>
    <rect x="110" y="458" width="120" height="6" rx="3" fill="#e97f61"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_CONFIG = {
  tabTitle: 'Bishal Musa | Designer',
  headerRole: 'Designer',
  hero: {
    greetingLine: "Hello, I'm",
    displayName: 'Bishal Musa',
    introText:
      'I design and build digital products for a living.\nStill figuring out the living part.',
  },
  about: {
    sections: [
      {
        id: 'bio_profession',
        title: 'Designer,\nDeveloper',
        subLabel: 'by profession',
        body: "As someone who cares deeply about digital product design and development, I guide products from early ideas all the way to launch.\n\nMy goal is to strip away complexity, creating interfaces that users intuitively understand and leave a positive impact. I'm always trying to learn more, and I hope my work helps make people's daily use of technology better.",
        quickNotes: [],
      },
      {
        id: 'bio_ambition',
        title: 'Polymath',
        subLabel: 'by ambition',
        body: "Armed with a mind that never stops questioning, I'm drawn to explore everything from technology to timeless philosophy, from wit and verse to the stars above. I'm always searching for the deeper meaning, whether through code or contemplation.\n\nYou'll find me riding my Classic 350, letting the wind clear my head, or finding peace in a small village in Punjab. Other times, I'm in Hyderabad, caught up in the city's energy.\n\nI'm here for the ride, chasing horizons.",
        quickNotes: [
          {
            id: 'note_1',
            text: 'सौ मिलीं ज़िंदगी से सौग़ातें\nहम को आवारगी ही रास आई',
            subtext: 'Life offered a hundred gifts;\nonly wandering ever felt like home.',
            author: 'Ali Sardar Jafri',
          },
          {
            id: 'note_2',
            text: 'Look round at the courses of the stars,\nas if thou wert going along with them.',
            author: 'Marcus Aurelius, Meditations',
          },
        ],
      },
    ],
  },
  worksIntro: {
    headline: 'Selected works',
    introText:
      'Explore curated creative work across four core disciplines — click any category to open its dedicated full-page gallery.\n\nEvery project thumbnail links directly to the live video or published campaign, managed seamlessly from the Admin workspace.',
    categories: {
      'video-editing': {
        title: 'Video Editing',
        summary:
          'Story-first cuts, pacing, sound design, and color grading crafted for YouTube films, commercials, reels, and brand documentaries.',
        ctaLabel: 'Open Video Editing',
      },
      'graphic-design': {
        title: 'Graphic Design',
        summary:
          'Brand identities, high-CTR thumbnails, editorial posters, social campaigns, and clean visual systems built for instant recognition.',
        ctaLabel: 'Open Graphic Design',
      },
      'motion-graphics': {
        title: 'Motion Graphics',
        summary:
          'Kinetic typography, logo stings, UI motion explainers, title sequences, and smooth 2D/3D visual animations.',
        ctaLabel: 'Open Motion Graphics',
      },
      'digital-marketing': {
        title: 'Digital Marketing',
        summary:
          'Performance ad creatives, funnel content strategy, paid social campaigns, SEO growth assets, and conversion-focused storytelling.',
        ctaLabel: 'Open Digital Marketing',
      },
    },
  },
  contact: {
    headlineFirst: 'Say',
    headlineAccent: 'hello',
    description:
      "Hiring, building something, or just want to talk? Send a good question or a bad joke, either works. I'll do my best with the question. The joke, I'll probably answer with a worse one. Sorry in advance.",
    socialLinks: [
      { id: 'email', label: 'Email', href: 'mailto:hello@bishalmusa.com', external: false },
      { id: 'github', label: 'Github', href: 'https://github.com/', external: true },
      { id: 'x', label: 'X', href: 'https://x.com/', external: true },
      { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/', external: true },
    ],
    footerCreditName: 'Said Khan',
    copyrightText: '© 2026 · All rights reserved',
  },
  resume: {
    fullName: 'Bishal Musa',
    subtitle: 'Video Editor, Visual Designer & Digital Strategist',
    coreFocus:
      'Video Editing, Graphic Design, Motion Graphics, Digital Marketing, Brand Storytelling & Production Systems.',
    selectedExperience:
      'Commercial YouTube Films · Brand Identity Kits · Kinetic Motion Reels · High-ROAS Performance Campaigns.',
    externalPdfUrl: '',
    pdfFileName: '',
  },
};

const STARTER_WORKS: Array<{
  categoryId: WorkCategoryId;
  title: string;
  workUrl?: string;
  thumbnailUrl: string;
  caption?: string;
  tags: string[];
}> = [
  {
    categoryId: 'video-editing',
    title: 'Brand Documentary — Behind the Craft',
    workUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: makeThumbSvg(
      'Brand Documentary',
      'YouTube Film · Sound Design & Color Grade',
      '#171717',
      '#2b2420'
    ),
    caption: 'YouTube · 04:12',
    tags: ['Documentary', 'Color Grade'],
  },
  {
    categoryId: 'video-editing',
    title: 'High-Retention Commercial Reel Cut',
    workUrl: 'https://vimeo.com/',
    thumbnailUrl: makeThumbSvg(
      'Commercial Reel',
      'Fast-Paced Social Ad · 60fps Edit',
      '#141a24',
      '#26212a'
    ),
    caption: 'Vimeo · 01:05',
    tags: ['Commercial', 'Reels'],
  },
  {
    categoryId: 'graphic-design',
    title: 'Minimalist Brand Identity & Packaging Kit',
    workUrl: 'https://www.behance.net/',
    thumbnailUrl: makeThumbSvg(
      'Brand Identity Kit',
      'Typography · Visual System · Packaging',
      '#1f1b18',
      '#332924'
    ),
    caption: 'Behance Case Study',
    tags: ['Branding', 'Identity'],
  },
  {
    categoryId: 'graphic-design',
    title: 'High-CTR YouTube Thumbnail Series',
    workUrl: 'https://dribbble.com/',
    thumbnailUrl: makeThumbSvg(
      'Thumbnail Series',
      'Editorial Contrast · Click-Through Lift',
      '#18181b',
      '#2b2220'
    ),
    caption: 'Dribbble Showcase',
    tags: ['Thumbnails', 'Social'],
  },
  {
    categoryId: 'motion-graphics',
    title: 'SaaS Product Launch — Kinetic Motion Explainer',
    workUrl: 'https://vimeo.com/',
    thumbnailUrl: makeThumbSvg(
      'Motion Explainer',
      'After Effects · UI Choreography · 60fps',
      '#111827',
      '#261f2c'
    ),
    caption: 'Motion Reel · 01:30',
    tags: ['Motion', 'Explainer'],
  },
  {
    categoryId: 'digital-marketing',
    title: 'Performance Ad Creatives & Funnel Case',
    thumbnailUrl: makeThumbSvg(
      'Growth Campaign',
      '4.2x ROAS · Paid Social & Funnel Strategy',
      '#2a201b',
      '#111111'
    ),
    caption: 'Campaign Breakdown',
    tags: ['Paid Ads', 'Growth'],
  },
];

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders ?? {}),
    },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(new Uint8Array(digest));
}

async function hashPasswordPbkdf2(
  password: string,
  saltHex?: string
): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = saltHex || randomHex(16);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return { salt, hash: toHex(new Uint8Array(derived)) };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function buildSessionCookie(token: string, requestUrl: URL, maxAge: number): string {
  const isHttps = requestUrl.protocol === 'https:';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

function isSafeHref(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/api/uploads/') || trimmed.startsWith('/resume-')) return true;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isCategory(val: unknown): val is WorkCategoryId {
  return typeof val === 'string' && VALID_CATEGORIES.includes(val as WorkCategoryId);
}

function mapWorkRow(row: WorkRow) {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags_json || '[]');
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  const isPhotoOnly = row.category_id === 'digital-marketing';
  return {
    id: row.id,
    categoryId: row.category_id as WorkCategoryId,
    title: row.title,
    workUrl: isPhotoOnly ? undefined : row.work_url || undefined,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption || undefined,
    status: row.status === 'draft' ? 'draft' : 'published',
    tags,
    createdAt: row.created_at,
  };
}

function mapInquiryRow(row: InquiryRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    service: row.service,
    budget: row.budget || undefined,
    message: row.message,
    status: row.status === 'replied' ? 'replied' : row.status === 'read' ? 'read' : 'new',
    createdAt: row.created_at,
  };
}

async function ensureSeeded(env: Env): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed default site config if absent
  const existingConfig = await env.DB.prepare('SELECT id FROM site_settings WHERE id = ?')
    .bind('default')
    .first();
  if (!existingConfig) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO site_settings (id, config_json, updated_at) VALUES (?, ?, ?)'
    )
      .bind('default', JSON.stringify(DEFAULT_CONFIG), now)
      .run();
  }

  // 2. Seed starter works idempotently ONLY when works table is completely empty
  const worksCount = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM works').first<{
    cnt: number;
  }>();
  if (!worksCount || worksCount.cnt === 0) {
    const statements = STARTER_WORKS.map((w, idx) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO works (id, category_id, title, work_url, thumbnail_url, caption, status, tags_json, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`
      ).bind(
        `starter_work_${idx + 1}`,
        w.categoryId,
        w.title,
        w.workUrl ?? null,
        w.thumbnailUrl,
        w.caption ?? '',
        JSON.stringify(w.tags),
        idx,
        now,
        now
      )
    );
    await env.DB.batch(statements);
  }

  // 3. Seed admin user if absent
  const existingAdmin = await env.DB.prepare('SELECT id FROM admin_users LIMIT 1').first();
  if (!existingAdmin) {
    const initialPw = env.ADMIN_PASSWORD?.trim() || 'bishal2026';
    const { salt, hash } = await hashPasswordPbkdf2(initialPw);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO admin_users (id, email, name, role, password_salt, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, 'ADMIN', ?, ?, ?, ?)`
    )
      .bind('admin_bishal', 'bishal@bishalmusa.com', 'Bishal Musa', salt, hash, now, now)
      .run();
  }
}

async function getSiteConfig(env: Env): Promise<typeof DEFAULT_CONFIG> {
  await ensureSeeded(env);
  const row = await env.DB.prepare('SELECT config_json FROM site_settings WHERE id = ?')
    .bind('default')
    .first<{ config_json: string }>();
  if (!row) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(row.config_json) as Partial<typeof DEFAULT_CONFIG>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      hero: { ...DEFAULT_CONFIG.hero, ...(parsed.hero ?? {}) },
      about: {
        sections:
          Array.isArray(parsed.about?.sections) && parsed.about.sections.length > 0
            ? parsed.about.sections
            : DEFAULT_CONFIG.about.sections,
      },
      worksIntro: {
        ...DEFAULT_CONFIG.worksIntro,
        ...(parsed.worksIntro ?? {}),
        categories: {
          ...DEFAULT_CONFIG.worksIntro.categories,
          ...(parsed.worksIntro?.categories ?? {}),
        },
      },
      contact: {
        ...DEFAULT_CONFIG.contact,
        ...(parsed.contact ?? {}),
        socialLinks: Array.isArray(parsed.contact?.socialLinks)
          ? parsed.contact.socialLinks
          : DEFAULT_CONFIG.contact.socialLinks,
      },
      resume: { ...DEFAULT_CONFIG.resume, ...(parsed.resume ?? {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function listWorks(env: Env, includeDrafts: boolean) {
  await ensureSeeded(env);
  const sql = includeDrafts
    ? 'SELECT * FROM works WHERE deleted_at IS NULL ORDER BY created_at DESC, sort_order ASC'
    : "SELECT * FROM works WHERE deleted_at IS NULL AND status = 'published' ORDER BY created_at DESC, sort_order ASC";
  const res = await env.DB.prepare(sql).all<WorkRow>();
  return res.results.map(mapWorkRow);
}

async function listInquiries(env: Env) {
  const res = await env.DB.prepare(
    'SELECT * FROM inquiries WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200'
  ).all<InquiryRow>();
  return res.results.map(mapInquiryRow);
}

async function authenticateAdmin(request: Request, env: Env): Promise<AdminUserRow | null> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.password_salt, u.password_hash, s.expires_at
     FROM admin_sessions s
     INNER JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first<AdminUserRow & { expires_at: string }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return row;
}

async function checkRateLimit(
  env: Env,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!existing || nowSec - existing.window_start >= windowSeconds) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)'
    )
      .bind(key, nowSec)
      .run();
    return true;
  }

  if (existing.count >= maxRequests) {
    return false;
  }

  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

async function deleteStoredUpload(env: Env, url?: string | null): Promise<void> {
  if (!url || !url.startsWith('/api/uploads/')) return;
  const filename = url.slice('/api/uploads/'.length).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM upload_chunks WHERE filename = ?').bind(filename),
    env.DB.prepare('DELETE FROM uploads WHERE filename = ?').bind(filename),
  ]);
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  // --- Health Check ---
  if (pathname === '/api/health' && method === 'GET') {
    const start = Date.now();
    await env.DB.prepare('SELECT 1 AS ok').first();
    return jsonResponse({
      success: true,
      data: {
        status: 'ok',
        runtime: 'cloudflare-workers',
        database: { status: 'connected', engine: 'cloudflare-d1', latencyMs: Date.now() - start },
        timestamp: new Date().toISOString(),
      },
    });
  }

  // --- Public Portfolio Bootstrap ---
  if (pathname === '/api/portfolio/public' && method === 'GET') {
    await ensureSeeded(env);
    const [siteConfig, works] = await Promise.all([getSiteConfig(env), listWorks(env, false)]);
    return jsonResponse({ success: true, data: { siteConfig, works } });
  }

  // --- Public Contact Inquiry Submission ---
  if (pathname === '/api/portfolio/inquiries' && method === 'POST') {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse('INVALID_PAYLOAD', 'Valid JSON payload is required.', 400);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const service = typeof body.service === 'string' ? body.service.trim() : '';
    const budget = typeof body.budget === 'string' ? body.budget.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const honeypot =
      typeof body.website_url_check === 'string' ? body.website_url_check.trim() : '';

    if (!name || name.length > 120) {
      return errorResponse('VALIDATION_ERROR', 'Please enter your name.', 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('VALIDATION_ERROR', 'Please enter a valid email address.', 400);
    }
    if (!service) {
      return errorResponse('VALIDATION_ERROR', 'Please select a service.', 400);
    }
    if (message.length < 3 || message.length > 5000) {
      return errorResponse('VALIDATION_ERROR', 'Please describe your project requirements.', 400);
    }

    if (honeypot.length > 0) {
      return jsonResponse(
        {
          success: true,
          data: {
            id: 'accepted',
            name,
            email,
            service,
            budget: budget || undefined,
            message,
            status: 'new',
            createdAt: new Date().toISOString(),
          },
        },
        201
      );
    }

    const ipHash = await sha256Hex(clientIp);
    const allowed = await checkRateLimit(env, `inquiry:${ipHash}`, 10, 3600);
    if (!allowed) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many submissions from your IP. Please try again later.',
        429
      );
    }

    const id = `inq_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO inquiries (id, name, email, service, budget, message, status, ip_hash, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`
    )
      .bind(
        id,
        name,
        email,
        service,
        budget || null,
        message,
        ipHash,
        request.headers.get('user-agent') || null,
        now,
        now
      )
      .run();

    return jsonResponse(
      {
        success: true,
        data: {
          id,
          name,
          email,
          service,
          budget: budget || undefined,
          message,
          status: 'new',
          createdAt: now,
        },
      },
      201
    );
  }

  // --- Serve Uploaded Media & Resume PDFs ---
  if (pathname.startsWith('/api/uploads/') && method === 'GET') {
    const filename = decodeURIComponent(pathname.slice('/api/uploads/'.length));
    if (!filename || filename.includes('/') || filename.includes('..')) {
      return new Response('Invalid filename', { status: 400 });
    }

    const meta = await env.DB.prepare('SELECT * FROM uploads WHERE filename = ?')
      .bind(filename)
      .first<UploadRow>();
    if (!meta) return new Response('File not found', { status: 404 });

    const chunksRes = await env.DB.prepare(
      'SELECT data_base64 FROM upload_chunks WHERE filename = ? ORDER BY chunk_index ASC'
    )
      .bind(filename)
      .all<{ data_base64: string }>();

    const parts = chunksRes.results.map((c) => base64ToBytes(c.data_base64));
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }

    const isSvg = meta.mime_type === 'image/svg+xml' || filename.toLowerCase().endsWith('.svg');
    const headers: Record<string, string> = {
      'Content-Type': meta.mime_type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `${isSvg ? 'attachment' : 'inline'}; filename="${filename}"`,
    };
    if (isSvg) {
      headers['Content-Security-Policy'] = "sandbox; default-src 'none'";
    }

    return new Response(merged, { status: 200, headers });
  }

  // --- Admin Login ---
  if (pathname === '/api/admin/auth/login' && method === 'POST') {
    await ensureSeeded(env);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const password = typeof body?.password === 'string' ? body.password : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!password) {
      return errorResponse('VALIDATION_ERROR', 'Password is required.', 400);
    }

    const ipHash = await sha256Hex(clientIp);
    const allowed = await checkRateLimit(env, `login:${ipHash}`, 15, 900);
    if (!allowed) {
      return errorResponse(
        'TOO_MANY_REQUESTS',
        'Too many login attempts. Please try again in 15 minutes.',
        429
      );
    }

    const candidatesRes = email
      ? await env.DB.prepare('SELECT * FROM admin_users WHERE email = ?')
          .bind(email)
          .all<AdminUserRow>()
      : await env.DB.prepare("SELECT * FROM admin_users WHERE role = 'ADMIN'").all<AdminUserRow>();

    let matched: AdminUserRow | null = null;
    for (const user of candidatesRes.results) {
      const derived = await hashPasswordPbkdf2(password, user.password_salt);
      if (constantTimeEqual(derived.hash, user.password_hash)) {
        matched = user;
        break;
      }
    }

    if (!matched) {
      return errorResponse('INVALID_CREDENTIALS', 'Incorrect password. Please try again.', 401);
    }

    const token = randomHex(32);
    const tokenHash = await sha256Hex(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO admin_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(tokenHash, matched.id, expiresAt, now.toISOString())
      .run();

    return jsonResponse(
      {
        success: true,
        data: {
          user: { id: matched.id, email: matched.email, name: matched.name, role: matched.role },
          expiresAt,
        },
      },
      200,
      { 'Set-Cookie': buildSessionCookie(token, url, SESSION_TTL_SECONDS) }
    );
  }

  // --- Admin Logout ---
  if (pathname === '/api/admin/auth/logout' && method === 'POST') {
    const cookies = parseCookies(request.headers.get('cookie'));
    const token = cookies[SESSION_COOKIE];
    if (token) {
      const tokenHash = await sha256Hex(token);
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
    return jsonResponse({ success: true, data: { message: 'Logged out' } }, 200, {
      'Set-Cookie': buildSessionCookie('', url, 0),
    });
  }

  // --- Protected Admin Routes (/api/admin/*) ---
  if (pathname.startsWith('/api/admin/')) {
    const adminUser = await authenticateAdmin(request, env);
    if (!adminUser) {
      return errorResponse('UNAUTHORIZED', 'Authentication session required.', 401);
    }

    if (pathname === '/api/admin/auth/me' && method === 'GET') {
      return jsonResponse({
        success: true,
        data: {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
          },
        },
      });
    }

    if (pathname === '/api/admin/auth/password' && method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : '';

      if (!currentPassword || newPassword.length < 4) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Current password and a new password (min 4 chars) are required.',
          400
        );
      }

      const check = await hashPasswordPbkdf2(currentPassword, adminUser.password_salt);
      if (!constantTimeEqual(check.hash, adminUser.password_hash)) {
        return errorResponse('INVALID_CREDENTIALS', 'Current password is incorrect.', 401);
      }

      const next = await hashPasswordPbkdf2(newPassword);
      await env.DB.prepare(
        'UPDATE admin_users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?'
      )
        .bind(next.salt, next.hash, new Date().toISOString(), adminUser.id)
        .run();

      return jsonResponse({
        success: true,
        data: { message: 'Admin password updated successfully.' },
      });
    }

    if (pathname === '/api/admin/portfolio/bootstrap' && method === 'GET') {
      const [siteConfig, works, inquiries] = await Promise.all([
        getSiteConfig(env),
        listWorks(env, true),
        listInquiries(env),
      ]);
      return jsonResponse({
        success: true,
        data: {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
          },
          database: 'connected',
          siteConfig,
          works,
          inquiries,
        },
      });
    }

    if (pathname === '/api/admin/portfolio/config' && method === 'PUT') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return errorResponse('VALIDATION_ERROR', 'Valid site config JSON is required.', 400);
      }

      // Validate URL protocols to prevent javascript: XSS links
      const contact = body.contact as { socialLinks?: Array<{ href?: unknown }> } | undefined;
      if (Array.isArray(contact?.socialLinks)) {
        for (const link of contact.socialLinks) {
          if (!isSafeHref(link?.href ?? '')) {
            return errorResponse('VALIDATION_ERROR', 'Invalid or unsafe social link URL.', 400);
          }
        }
      }
      const resume = body.resume as { externalPdfUrl?: unknown } | undefined;
      if (resume?.externalPdfUrl && !isSafeHref(resume.externalPdfUrl)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid resume PDF URL.', 400);
      }

      await env.DB.prepare(
        'INSERT OR REPLACE INTO site_settings (id, config_json, updated_at) VALUES (?, ?, ?)'
      )
        .bind('default', JSON.stringify(body), new Date().toISOString())
        .run();

      const saved = await getSiteConfig(env);
      return jsonResponse({ success: true, data: saved });
    }

    if (pathname === '/api/admin/portfolio/works' && method === 'POST') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const categoryId = body?.categoryId;
      const title = typeof body?.title === 'string' ? body.title.trim() : '';
      const thumbnailUrl = typeof body?.thumbnailUrl === 'string' ? body.thumbnailUrl.trim() : '';
      const rawWorkUrl = typeof body?.workUrl === 'string' ? body.workUrl.trim() : '';
      const caption = typeof body?.caption === 'string' ? body.caption.trim() : '';
      const status = body?.status === 'draft' ? 'draft' : 'published';
      const tags = Array.isArray(body?.tags) ? body.tags.map(String) : [];

      if (!isCategory(categoryId)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid work category.', 400);
      }
      if (!title) return errorResponse('VALIDATION_ERROR', 'Title is required.', 400);
      if (!thumbnailUrl) {
        return errorResponse('VALIDATION_ERROR', 'Thumbnail or photo is required.', 400);
      }

      const isPhotoOnly = categoryId === 'digital-marketing';
      const workUrl = isPhotoOnly ? null : rawWorkUrl || null;
      if (workUrl && !isSafeHref(workUrl)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid work URL.', 400);
      }

      const id = `work_${crypto.randomUUID().slice(0, 12)}`;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO works (id, category_id, title, work_url, thumbnail_url, caption, status, tags_json, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
        .bind(
          id,
          categoryId,
          title,
          workUrl,
          thumbnailUrl,
          caption,
          status,
          JSON.stringify(tags),
          now,
          now
        )
        .run();

      const items = await listWorks(env, true);
      const item = items.find((w) => w.id === id) ?? items[0];
      return jsonResponse({ success: true, data: { item, items } }, 201);
    }

    if (pathname === '/api/admin/portfolio/works/reset' && method === 'POST') {
      const now = new Date().toISOString();
      await env.DB.prepare('UPDATE works SET deleted_at = ? WHERE deleted_at IS NULL')
        .bind(now)
        .run();

      const statements = STARTER_WORKS.map((w, idx) =>
        env.DB.prepare(
          `INSERT INTO works (id, category_id, title, work_url, thumbnail_url, caption, status, tags_json, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`
        ).bind(
          `work_${crypto.randomUUID().slice(0, 12)}`,
          w.categoryId,
          w.title,
          w.workUrl ?? null,
          w.thumbnailUrl,
          w.caption ?? '',
          JSON.stringify(w.tags),
          idx,
          now,
          now
        )
      );
      await env.DB.batch(statements);
      const items = await listWorks(env, true);
      return jsonResponse({ success: true, data: { items } });
    }

    const workMatch = pathname.match(/^\/api\/admin\/portfolio\/works\/([^/]+)$/);
    if (workMatch) {
      const id = decodeURIComponent(workMatch[1]);
      if (method === 'PUT') {
        const existing = await env.DB.prepare(
          'SELECT * FROM works WHERE id = ? AND deleted_at IS NULL'
        )
          .bind(id)
          .first<WorkRow>();
        if (!existing) return errorResponse('NOT_FOUND', 'Work item not found.', 404);

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const categoryId = isCategory(body?.categoryId)
          ? body.categoryId
          : (existing.category_id as WorkCategoryId);
        const title =
          typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : existing.title;
        const thumbnailUrl =
          typeof body?.thumbnailUrl === 'string' && body.thumbnailUrl.trim()
            ? body.thumbnailUrl.trim()
            : existing.thumbnail_url;
        const isPhotoOnly = categoryId === 'digital-marketing';
        const workUrl = isPhotoOnly
          ? null
          : body?.workUrl !== undefined
            ? typeof body.workUrl === 'string' && body.workUrl.trim()
              ? body.workUrl.trim()
              : null
            : existing.work_url;

        if (workUrl && !isSafeHref(workUrl)) {
          return errorResponse('VALIDATION_ERROR', 'Invalid work URL.', 400);
        }

        await env.DB.prepare(
          `UPDATE works
           SET category_id = ?, title = ?, work_url = ?, thumbnail_url = ?, updated_at = ?
           WHERE id = ?`
        )
          .bind(categoryId, title, workUrl, thumbnailUrl, new Date().toISOString(), id)
          .run();

        const items = await listWorks(env, true);
        const item = items.find((w) => w.id === id) ?? null;
        return jsonResponse({ success: true, data: { item, items } });
      }

      if (method === 'DELETE') {
        await env.DB.prepare('UPDATE works SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
          .bind(new Date().toISOString(), id)
          .run();
        const items = await listWorks(env, true);
        return jsonResponse({ success: true, data: { items } });
      }
    }

    const inquiryMatch = pathname.match(/^\/api\/admin\/portfolio\/inquiries\/([^/]+)$/);
    if (inquiryMatch) {
      const id = decodeURIComponent(inquiryMatch[1]);
      if (method === 'PATCH') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const status = body?.status;
        if (status !== 'new' && status !== 'read' && status !== 'replied') {
          return errorResponse('VALIDATION_ERROR', 'Invalid inquiry status.', 400);
        }
        await env.DB.prepare('UPDATE inquiries SET status = ?, updated_at = ? WHERE id = ?')
          .bind(status, new Date().toISOString(), id)
          .run();
        const items = await listInquiries(env);
        const item = items.find((i) => i.id === id) ?? null;
        return jsonResponse({ success: true, data: { item, items } });
      }

      if (method === 'DELETE') {
        await env.DB.prepare(
          'UPDATE inquiries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
        )
          .bind(new Date().toISOString(), id)
          .run();
        const items = await listInquiries(env);
        return jsonResponse({ success: true, data: { items } });
      }
    }

    if (pathname === '/api/admin/portfolio/upload' && method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return errorResponse('INVALID_CONTENT_TYPE', 'Expected multipart/form-data.', 400);
      }

      const formData = await request.formData();
      const fileEntry = formData.get('file');
      const kind = formData.get('kind') === 'pdf' ? 'pdf' : 'image';

      if (!fileEntry || typeof fileEntry === 'string') {
        return errorResponse('FILE_REQUIRED', 'No file uploaded.', 400);
      }

      const file = fileEntry as File;
      const mime = file.type || (kind === 'pdf' ? 'application/pdf' : 'image/png');
      if (
        kind === 'pdf' &&
        mime !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        return errorResponse('INVALID_FILE_TYPE', 'Please upload a valid PDF (.pdf) file.', 400);
      }
      if (kind === 'image' && !ALLOWED_IMAGE_MIMES.has(mime)) {
        return errorResponse(
          'INVALID_FILE_TYPE',
          'Unsupported image format. Use PNG, JPG, WEBP, GIF, or AVIF.',
          400
        );
      }

      const maxBytes = kind === 'pdf' ? 12 * 1024 * 1024 : 8 * 1024 * 1024;
      if (file.size > maxBytes) {
        return errorResponse(
          'FILE_TOO_LARGE',
          `File exceeds maximum allowed size (${kind === 'pdf' ? '12 MB' : '8 MB'}).`,
          400
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const extMatch = file.name.toLowerCase().match(/\.[a-z0-9]{1,6}$/);
      const ext = extMatch ? extMatch[0] : kind === 'pdf' ? '.pdf' : '.png';
      const stem = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const filename = `${kind}_${Date.now()}_${randomHex(4)}_${stem || 'file'}${ext}`;
      const now = new Date().toISOString();

      const totalChunks = Math.max(1, Math.ceil(bytes.length / CHUNK_RAW_BYTES));
      const statements: D1PreparedStatementLike[] = [
        env.DB.prepare(
          `INSERT INTO uploads (filename, original_name, kind, mime_type, size_bytes, chunk_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(filename, file.name, kind, mime, bytes.length, totalChunks, now),
      ];

      for (let i = 0; i < totalChunks; i++) {
        const slice = bytes.subarray(i * CHUNK_RAW_BYTES, (i + 1) * CHUNK_RAW_BYTES);
        statements.push(
          env.DB.prepare(
            'INSERT INTO upload_chunks (filename, chunk_index, data_base64) VALUES (?, ?, ?)'
          ).bind(filename, i, bytesToBase64(slice))
        );
      }
      await env.DB.batch(statements);

      const publicUrl = `/api/uploads/${filename}`;
      if (kind === 'pdf') {
        const config = await getSiteConfig(env);
        const prevUrl = config.resume.externalPdfUrl;
        const nextConfig = {
          ...config,
          resume: {
            ...config.resume,
            pdfFileName: file.name,
            externalPdfUrl: publicUrl,
          },
        };
        await env.DB.prepare(
          'INSERT OR REPLACE INTO site_settings (id, config_json, updated_at) VALUES (?, ?, ?)'
        )
          .bind('default', JSON.stringify(nextConfig), now)
          .run();
        if (prevUrl && prevUrl !== publicUrl) {
          await deleteStoredUpload(env, prevUrl);
        }
      }

      return jsonResponse(
        {
          success: true,
          data: {
            id: filename,
            url: publicUrl,
            fileName: file.name,
            size: bytes.length,
            mimeType: mime,
          },
        },
        201
      );
    }

    if (pathname === '/api/admin/portfolio/resume' && method === 'DELETE') {
      const config = await getSiteConfig(env);
      await deleteStoredUpload(env, config.resume.externalPdfUrl);
      const nextConfig = {
        ...config,
        resume: {
          ...config.resume,
          pdfFileName: '',
          externalPdfUrl: '',
        },
      };
      await env.DB.prepare(
        'INSERT OR REPLACE INTO site_settings (id, config_json, updated_at) VALUES (?, ?, ?)'
      )
        .bind('default', JSON.stringify(nextConfig), new Date().toISOString())
        .run();
      return jsonResponse({ success: true, data: nextConfig });
    }
  }

  return errorResponse('NOT_FOUND', 'API route not found.', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('Worker API error:', message);
        return errorResponse('INTERNAL_ERROR', 'Internal server error.', 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
