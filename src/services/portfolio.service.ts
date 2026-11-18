import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../lib/db';
import { hashPassword } from '../lib/auth';
import { AppError } from '../lib/error-utils';
import { MediaType, MessageStatus, Role, Status, type Prisma } from '@prisma/client';

export type WorkCategoryId =
  'video-editing' | 'graphic-design' | 'motion-graphics' | 'digital-marketing';

export interface PortfolioWorkItem {
  id: string;
  categoryId: WorkCategoryId;
  title: string;
  workUrl?: string;
  thumbnailUrl: string;
  caption?: string;
  status: 'published' | 'draft';
  tags?: string[];
  createdAt: string;
}

export interface PortfolioInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  budget?: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  createdAt: string;
}

export const PORTFOLIO_CATEGORIES: {
  id: WorkCategoryId;
  name: string;
  description: string;
}[] = [
  {
    id: 'video-editing',
    name: 'Video Editing',
    description:
      'Story-first cuts, pacing, sound design, and color grading crafted for YouTube films, commercials, reels, and brand documentaries.',
  },
  {
    id: 'graphic-design',
    name: 'Graphic Design',
    description:
      'Brand identities, high-CTR thumbnails, editorial posters, social campaigns, and clean visual systems built for instant recognition.',
  },
  {
    id: 'motion-graphics',
    name: 'Motion Graphics',
    description:
      'Kinetic typography, logo stings, UI motion explainers, title sequences, and smooth 2D/3D visual animations.',
  },
  {
    id: 'digital-marketing',
    name: 'Digital Marketing',
    description:
      'Performance ad creatives, funnel content strategy, paid social campaigns, SEO growth assets, and conversion-focused storytelling.',
  },
];

const CATEGORY_SLUGS = PORTFOLIO_CATEGORIES.map((c) => c.id);

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeThumbSvg(label: string, subtitle: string, bgStart: string, bgEnd: string): string {
  const safeLabel = escapeXml(label);
  const safeSubtitle = escapeXml(subtitle);
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
    <text x="110" y="340" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="60" font-weight="600">${safeLabel}</text>
    <text x="110" y="405" fill="#d6d6d6" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="300">${safeSubtitle}</text>
    <rect x="110" y="458" width="120" height="6" rx="3" fill="#e97f61"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_PORTFOLIO_CONFIG = {
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

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export function isPortfolioCategory(value: string): value is WorkCategoryId {
  return CATEGORY_SLUGS.includes(value as WorkCategoryId);
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const rand = crypto.randomBytes(3).toString('hex');
  return `${base || 'work'}-${Date.now().toString(36)}-${rand}`;
}

function parseInquirySubject(subject: string): { service: string; budget?: string } {
  const sep = ' | Budget: ';
  const idx = subject.indexOf(sep);
  if (idx !== -1) {
    return {
      service: subject.slice(0, idx).trim() || 'General Inquiry',
      budget: subject.slice(idx + sep.length).trim() || undefined,
    };
  }
  return { service: subject.trim() || 'General Inquiry' };
}

function mapMessageToInquiry(row: {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  isRead: boolean;
  repliedAt: Date | null;
  createdAt: Date;
}): PortfolioInquiry {
  const { service, budget } = parseInquirySubject(row.subject);
  let status: 'new' | 'read' | 'replied' = 'new';
  if (row.status === MessageStatus.REPLIED || row.repliedAt) {
    status = 'replied';
  } else if (row.status === MessageStatus.READ || row.isRead) {
    status = 'read';
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    service,
    budget,
    message: row.message,
    status,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapProjectToWork(row: {
  id: string;
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  liveUrl: string | null;
  demoUrl: string | null;
  status: Status;
  tags: string[];
  createdAt: Date;
  category: { slug: string } | null;
}): PortfolioWorkItem {
  const catSlug = (row.category?.slug || 'video-editing') as WorkCategoryId;
  const isPhotoOnly = catSlug === 'digital-marketing';
  const resolvedUrl = row.liveUrl || row.demoUrl || undefined;
  return {
    id: row.id,
    categoryId: isPortfolioCategory(catSlug) ? catSlug : 'video-editing',
    title: row.title,
    workUrl: isPhotoOnly ? undefined : resolvedUrl,
    thumbnailUrl: row.thumbnailUrl || row.coverImageUrl || '',
    caption: row.summary || undefined,
    status: row.status === Status.DRAFT ? 'draft' : 'published',
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

let initializedPromise: Promise<void> | null = null;

export class PortfolioService {
  /**
   * Idempotently ensures:
   * 1. The 4 creative portfolio categories exist in PostgreSQL.
   * 2. SiteSetting.portfolioConfig is populated.
   * 3. Starter showcase works exist if none have ever been seeded for these 4 categories.
   * 4. Bishal admin account exists with Argon2id hashed password (`bishal2026`) so /admin login works out of the box.
   */
  static async ensureInitialized(): Promise<void> {
    if (!initializedPromise) {
      initializedPromise = this._runInit().catch((err) => {
        initializedPromise = null;
        throw err;
      });
    }
    return initializedPromise;
  }

  private static async _runInit(): Promise<void> {
    // 1. Ensure 4 creative categories exist
    const categoryMap = new Map<WorkCategoryId, string>();
    for (const cat of PORTFOLIO_CATEGORIES) {
      const record = await db.category.upsert({
        where: { slug: cat.id },
        update: { deletedAt: null },
        create: {
          name: cat.name,
          slug: cat.id,
          description: cat.description,
        },
      });
      categoryMap.set(cat.id, record.id);
    }

    // 2. Ensure default SiteSetting + portfolioConfig exist
    const existingSetting = await db.siteSetting.findUnique({
      where: { id: 'default' },
    });

    if (!existingSetting) {
      await db.siteSetting.create({
        data: {
          id: 'default',
          siteName: 'Bishal Musa Portfolio',
          heroTitle: DEFAULT_PORTFOLIO_CONFIG.hero.displayName,
          heroSubtitle: DEFAULT_PORTFOLIO_CONFIG.hero.introText,
          tagline: DEFAULT_PORTFOLIO_CONFIG.headerRole,
          contactEmail: 'hello@bishalmusa.com',
          portfolioConfig: DEFAULT_PORTFOLIO_CONFIG as unknown as Prisma.InputJsonValue,
        },
      });
    } else if (!existingSetting.portfolioConfig) {
      await db.siteSetting.update({
        where: { id: 'default' },
        data: {
          portfolioConfig: DEFAULT_PORTFOLIO_CONFIG as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // 3. Seed starter works ONLY if zero projects exist (including soft-deleted) across these 4 categories
    const existingPortfolioProjectsCount = await db.project.count({
      where: {
        category: { slug: { in: CATEGORY_SLUGS } },
      },
    });

    if (existingPortfolioProjectsCount === 0) {
      for (let i = 0; i < STARTER_WORKS.length; i++) {
        const w = STARTER_WORKS[i];
        const categoryId = categoryMap.get(w.categoryId);
        if (!categoryId) continue;
        await db.project.create({
          data: {
            title: w.title,
            slug: slugify(w.title),
            summary: w.caption || '',
            description: w.caption || w.title,
            thumbnailUrl: w.thumbnailUrl,
            coverImageUrl: w.thumbnailUrl,
            liveUrl: w.workUrl || null,
            demoUrl: w.workUrl || null,
            categoryId,
            status: Status.PUBLISHED,
            order: i,
            tags: w.tags,
            publishedAt: new Date(),
          },
        });
      }
    }

    // 4. Ensure Bishal admin user exists for /admin password login
    const bishalEmail = process.env.PORTFOLIO_ADMIN_EMAIL?.trim() || 'bishal@bishalmusa.com';
    const existingBishal = await db.user.findUnique({ where: { email: bishalEmail } });
    if (!existingBishal) {
      const initialPassword = process.env.PORTFOLIO_ADMIN_PASSWORD?.trim() || 'bishal2026';
      const passwordHash = await hashPassword(initialPassword);
      await db.user.create({
        data: {
          email: bishalEmail,
          name: 'Bishal Musa',
          passwordHash,
          role: Role.ADMIN,
        },
      });
    }
  }

  static async getSiteConfig(): Promise<typeof DEFAULT_PORTFOLIO_CONFIG> {
    await this.ensureInitialized();
    const setting = await db.siteSetting.findUnique({
      where: { id: 'default' },
    });
    const saved =
      (setting?.portfolioConfig as Partial<typeof DEFAULT_PORTFOLIO_CONFIG> | null) || {};
    const mergedResume = {
      ...DEFAULT_PORTFOLIO_CONFIG.resume,
      ...(saved.resume ?? {}),
      externalPdfUrl:
        saved.resume?.externalPdfUrl ??
        (setting?.resumeUrl?.startsWith('/api/uploads/') ? setting.resumeUrl : '') ??
        '',
    };
    return {
      ...DEFAULT_PORTFOLIO_CONFIG,
      ...saved,
      hero: {
        ...DEFAULT_PORTFOLIO_CONFIG.hero,
        ...(saved.hero ?? {}),
      },
      about: {
        sections:
          Array.isArray(saved.about?.sections) && saved.about.sections.length > 0
            ? saved.about.sections
            : DEFAULT_PORTFOLIO_CONFIG.about.sections,
      },
      worksIntro: {
        ...DEFAULT_PORTFOLIO_CONFIG.worksIntro,
        ...(saved.worksIntro ?? {}),
        categories: {
          ...DEFAULT_PORTFOLIO_CONFIG.worksIntro.categories,
          ...(saved.worksIntro?.categories ?? {}),
        },
      },
      contact: {
        ...DEFAULT_PORTFOLIO_CONFIG.contact,
        ...(saved.contact ?? {}),
        socialLinks: Array.isArray(saved.contact?.socialLinks)
          ? saved.contact.socialLinks
          : DEFAULT_PORTFOLIO_CONFIG.contact.socialLinks,
      },
      resume: mergedResume,
    };
  }

  static async saveSiteConfig(nextConfig: Record<string, unknown>) {
    await this.ensureInitialized();
    const typed = nextConfig as Partial<typeof DEFAULT_PORTFOLIO_CONFIG>;
    const emailLink = Array.isArray(typed.contact?.socialLinks)
      ? typed.contact.socialLinks.find(
          (l) => typeof l?.href === 'string' && l.href.startsWith('mailto:')
        )
      : null;
    const contactEmail = emailLink ? String(emailLink.href).replace(/^mailto:/i, '') : undefined;

    await db.siteSetting.upsert({
      where: { id: 'default' },
      update: {
        siteName: typed.hero?.displayName ? `${typed.hero.displayName} Portfolio` : undefined,
        heroTitle: typed.hero?.displayName || undefined,
        heroSubtitle: typed.hero?.introText || undefined,
        tagline: typed.headerRole || undefined,
        contactEmail: contactEmail || undefined,
        resumeUrl: typed.resume?.externalPdfUrl || null,
        portfolioConfig: nextConfig as Prisma.InputJsonValue,
      },
      create: {
        id: 'default',
        siteName: 'Bishal Musa Portfolio',
        portfolioConfig: nextConfig as Prisma.InputJsonValue,
      },
    });

    return this.getSiteConfig();
  }

  static async listWorks(includeDrafts: boolean): Promise<PortfolioWorkItem[]> {
    await this.ensureInitialized();
    const rows = await db.project.findMany({
      where: {
        deletedAt: null,
        ...(includeDrafts ? {} : { status: Status.PUBLISHED }),
        category: {
          slug: { in: CATEGORY_SLUGS },
        },
      },
      include: {
        category: { select: { slug: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { order: 'asc' }],
    });

    return rows.map(mapProjectToWork);
  }

  static async createWork(input: {
    categoryId: WorkCategoryId;
    title: string;
    workUrl?: string;
    thumbnailUrl: string;
    caption?: string;
    status?: 'published' | 'draft';
    tags?: string[];
  }): Promise<PortfolioWorkItem> {
    await this.ensureInitialized();
    const category = await db.category.findUnique({
      where: { slug: input.categoryId },
    });
    if (!category) {
      throw new Error(`Invalid category: ${input.categoryId}`);
    }

    const isPhotoOnly = input.categoryId === 'digital-marketing';
    const cleanUrl = isPhotoOnly ? null : input.workUrl?.trim() || null;
    const statusEnum = input.status === 'draft' ? Status.DRAFT : Status.PUBLISHED;

    const created = await db.project.create({
      data: {
        title: input.title.trim(),
        slug: slugify(input.title),
        summary: input.caption?.trim() || '',
        description: input.caption?.trim() || input.title.trim(),
        thumbnailUrl: input.thumbnailUrl,
        coverImageUrl: input.thumbnailUrl,
        liveUrl: cleanUrl,
        demoUrl: cleanUrl,
        categoryId: category.id,
        status: statusEnum,
        tags: input.tags ?? [],
        publishedAt: statusEnum === Status.PUBLISHED ? new Date() : null,
      },
      include: {
        category: { select: { slug: true } },
      },
    });

    return mapProjectToWork(created);
  }

  static async updateWork(
    id: string,
    input: {
      categoryId?: WorkCategoryId;
      title?: string;
      workUrl?: string | null;
      thumbnailUrl?: string;
      caption?: string;
      status?: 'published' | 'draft';
      tags?: string[];
    }
  ): Promise<PortfolioWorkItem> {
    await this.ensureInitialized();
    const existing = await db.project.findFirst({
      where: { id, deletedAt: null },
      include: { category: { select: { slug: true } } },
    });
    if (!existing) {
      throw new AppError('Work item not found', 'NOT_FOUND', 404);
    }

    let nextCategoryId = existing.categoryId;
    const effectiveSlug = (input.categoryId ||
      existing.category?.slug ||
      'video-editing') as WorkCategoryId;
    if (input.categoryId) {
      const cat = await db.category.findUnique({ where: { slug: input.categoryId } });
      if (cat) nextCategoryId = cat.id;
    }

    const isPhotoOnly = effectiveSlug === 'digital-marketing';
    const cleanUrl = isPhotoOnly
      ? null
      : input.workUrl !== undefined
        ? input.workUrl?.trim() || null
        : existing.liveUrl;

    const nextStatus =
      input.status !== undefined
        ? input.status === 'draft'
          ? Status.DRAFT
          : Status.PUBLISHED
        : existing.status;

    const updated = await db.project.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.caption !== undefined
          ? {
              summary: input.caption.trim(),
              description: input.caption.trim() || input.title || existing.title,
            }
          : {}),
        ...(input.thumbnailUrl !== undefined
          ? { thumbnailUrl: input.thumbnailUrl, coverImageUrl: input.thumbnailUrl }
          : {}),
        liveUrl: cleanUrl,
        demoUrl: cleanUrl,
        categoryId: nextCategoryId,
        status: nextStatus,
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
      include: {
        category: { select: { slug: true } },
      },
    });

    return mapProjectToWork(updated);
  }

  static async deleteWork(id: string): Promise<void> {
    await this.ensureInitialized();
    await db.project.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  static async resetDemoWorks(): Promise<PortfolioWorkItem[]> {
    await this.ensureInitialized();
    // Soft-delete existing portfolio items
    await db.project.updateMany({
      where: {
        deletedAt: null,
        category: { slug: { in: CATEGORY_SLUGS } },
      },
      data: { deletedAt: new Date() },
    });

    const cats = await db.category.findMany({ where: { slug: { in: CATEGORY_SLUGS } } });
    const catMap = new Map(cats.map((c) => [c.slug as WorkCategoryId, c.id]));

    for (let i = 0; i < STARTER_WORKS.length; i++) {
      const w = STARTER_WORKS[i];
      const categoryId = catMap.get(w.categoryId);
      if (!categoryId) continue;
      await db.project.create({
        data: {
          title: w.title,
          slug: slugify(w.title),
          summary: w.caption || '',
          description: w.caption || w.title,
          thumbnailUrl: w.thumbnailUrl,
          coverImageUrl: w.thumbnailUrl,
          liveUrl: w.workUrl || null,
          demoUrl: w.workUrl || null,
          categoryId,
          status: Status.PUBLISHED,
          order: i,
          tags: w.tags,
          publishedAt: new Date(),
        },
      });
    }

    return this.listWorks(true);
  }

  static async createInquiry(
    input: {
      name: string;
      email: string;
      service: string;
      budget?: string;
      message: string;
    },
    clientIp?: string,
    userAgent?: string
  ): Promise<PortfolioInquiry> {
    const subject = input.budget?.trim()
      ? `${input.service.trim()} | Budget: ${input.budget.trim()}`
      : input.service.trim();

    const created = await db.contactMessage.create({
      data: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        subject,
        message: input.message.trim(),
        status: MessageStatus.NEW,
        isRead: false,
        isSpam: false,
        ipHash: clientIp ? crypto.createHash('sha256').update(clientIp).digest('hex') : null,
        userAgent: userAgent || null,
      },
    });

    return mapMessageToInquiry(created);
  }

  static async listInquiries(): Promise<PortfolioInquiry[]> {
    const rows = await db.contactMessage.findMany({
      where: {
        deletedAt: null,
        isSpam: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(mapMessageToInquiry);
  }

  static async updateInquiryStatus(
    id: string,
    status: 'new' | 'read' | 'replied'
  ): Promise<PortfolioInquiry> {
    const mappedStatus =
      status === 'replied'
        ? MessageStatus.REPLIED
        : status === 'read'
          ? MessageStatus.READ
          : MessageStatus.NEW;

    const updated = await db.contactMessage.update({
      where: { id },
      data: {
        status: mappedStatus,
        isRead: status !== 'new',
        repliedAt: status === 'replied' ? new Date() : null,
      },
    });

    return mapMessageToInquiry(updated);
  }

  static async deleteInquiry(id: string): Promise<void> {
    await db.contactMessage.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  private static async removeLocalUploadByUrl(url?: string | null): Promise<void> {
    if (!url || !url.startsWith('/api/uploads/')) return;
    const safeName = path.basename(url.slice('/api/uploads/'.length));
    if (!safeName || safeName.includes('..')) return;
    await fs.unlink(path.join(UPLOADS_DIR, safeName)).catch(() => {});
  }

  static async clearUploadedResume(): Promise<typeof DEFAULT_PORTFOLIO_CONFIG> {
    const config = await this.getSiteConfig();
    await this.removeLocalUploadByUrl(config.resume.externalPdfUrl);
    return this.saveSiteConfig({
      ...config,
      resume: {
        ...config.resume,
        pdfFileName: '',
        externalPdfUrl: '',
      },
    });
  }

  static async saveUploadedFile(
    file: File,
    kind: 'image' | 'pdf',
    uploadedById?: string
  ): Promise<{ id: string; url: string; fileName: string; size: number; mimeType: string }> {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    const mime = file.type || (kind === 'pdf' ? 'application/pdf' : 'image/png');

    if (kind === 'pdf' && mime !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new AppError('Please upload a valid PDF file (.pdf).', 'INVALID_FILE_TYPE', 400);
    }

    if (kind === 'image' && !allowedImages.includes(mime)) {
      throw new AppError(
        'Unsupported image format. Use PNG, JPG, WEBP, GIF, or AVIF.',
        'INVALID_FILE_TYPE',
        400
      );
    }

    const maxBytes = kind === 'pdf' ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new AppError(
        `File exceeds maximum size limit (${kind === 'pdf' ? '25 MB' : '10 MB'}).`,
        'FILE_TOO_LARGE',
        400
      );
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const extFromName = path
      .extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '');
    const ext = extFromName || (kind === 'pdf' ? '.pdf' : '.png');
    const safeStem = path
      .basename(file.name, path.extname(file.name))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48);
    const storedName = `${kind}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeStem || 'file'}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer);

    const publicUrl = `/api/uploads/${storedName}`;
    const publicId = `local/${storedName}`;

    const media = await db.media.create({
      data: {
        publicId,
        url: publicUrl,
        secureUrl: publicUrl,
        type: kind === 'pdf' ? MediaType.PDF : MediaType.IMAGE,
        mimeType: mime,
        size: buffer.length,
        byteSize: buffer.length,
        format: ext.replace(/^\./, '') || (kind === 'pdf' ? 'pdf' : 'png'),
        resourceType: kind === 'pdf' ? 'raw' : 'image',
        altText: file.name,
        uploadedById: uploadedById || null,
      },
    });

    if (kind === 'pdf') {
      const config = await this.getSiteConfig();
      const prevUrl = config.resume.externalPdfUrl;
      const updatedConfig = {
        ...config,
        resume: {
          ...config.resume,
          pdfFileName: file.name,
          externalPdfUrl: publicUrl,
        },
      };
      await this.saveSiteConfig(updatedConfig);
      if (prevUrl && prevUrl !== publicUrl) {
        await this.removeLocalUploadByUrl(prevUrl);
      }
    }

    return {
      id: media.id,
      url: publicUrl,
      fileName: file.name,
      size: buffer.length,
      mimeType: mime,
    };
  }
}
