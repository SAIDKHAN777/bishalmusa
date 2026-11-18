import type { APIRoute } from 'astro';
import { z } from 'zod';
import { PortfolioService } from '../../../../services/portfolio.service';
import { logger } from '../../../../lib/logger';
import { getErrorInfo } from '../../../../lib/error-utils';

export const prerender = false;

function isSafeHref(val: string): boolean {
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

const safeHrefSchema = z.string().max(500).refine(isSafeHref, 'Unsafe or invalid URL protocol.');

const quickNoteSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().max(2000),
  subtext: z.string().max(2000).optional(),
  author: z.string().max(200).optional(),
});

const aboutSectionSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(300),
  subLabel: z.string().max(200),
  body: z.string().max(10000),
  quickNotes: z.array(quickNoteSchema).max(30).default([]),
});

const categoryOverrideSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(2000),
  ctaLabel: z.string().min(1).max(120),
});

const socialLinkSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(80),
  href: safeHrefSchema,
  external: z.boolean(),
});

const siteConfigSchema = z
  .object({
    tabTitle: z.string().max(160).optional(),
    headerRole: z.string().max(120).optional(),
    hero: z
      .object({
        greetingLine: z.string().max(160),
        displayName: z.string().min(1).max(160),
        introText: z.string().max(2000),
      })
      .optional(),
    about: z
      .object({
        sections: z.array(aboutSectionSchema).max(20),
      })
      .optional(),
    worksIntro: z
      .object({
        headline: z.string().max(200),
        introText: z.string().max(4000),
        categories: z.record(categoryOverrideSchema),
      })
      .optional(),
    contact: z
      .object({
        headlineFirst: z.string().max(120),
        headlineAccent: z.string().max(120),
        description: z.string().max(2000),
        socialLinks: z.array(socialLinkSchema).max(20),
        footerCreditName: z.string().max(120),
        copyrightText: z.string().max(160),
      })
      .optional(),
    resume: z
      .object({
        fullName: z.string().max(160).optional(),
        subtitle: z.string().max(240).optional(),
        coreFocus: z.string().max(1000).optional(),
        selectedExperience: z.string().max(1000).optional(),
        pdfFileName: z.string().max(260).optional(),
        externalPdfUrl: safeHrefSchema.optional(),
      })
      .optional(),
  })
  .passthrough();

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = siteConfigSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid site configuration payload.',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const saved = await PortfolioService.saveSiteConfig(parsed.data);
    return new Response(JSON.stringify({ success: true, data: saved }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Database save failed');
    logger.error({ err }, 'Failed to save portfolio site config');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: info.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
