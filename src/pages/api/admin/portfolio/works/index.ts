import { getErrorInfo } from '../../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { PortfolioService, isPortfolioCategory } from '../../../../../services/portfolio.service';
import { logger } from '../../../../../lib/logger';

export const prerender = false;

const createWorkSchema = z.object({
  categoryId: z.string().refine(isPortfolioCategory, 'Invalid category'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  workUrl: z.string().trim().optional().nullable(),
  thumbnailUrl: z.string().trim().min(1, 'Image / Thumbnail is required'),
  caption: z.string().trim().max(300).optional(),
  status: z.enum(['published', 'draft']).optional().default('published'),
  tags: z.array(z.string()).optional().default([]),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createWorkSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid work payload',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await PortfolioService.createWork({
      ...parsed.data,
      workUrl: parsed.data.workUrl || undefined,
    });
    const allWorks = await PortfolioService.listWorks(true);

    return new Response(
      JSON.stringify({
        success: true,
        data: { item: created, items: allWorks },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to create portfolio work item');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Failed to create work' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
