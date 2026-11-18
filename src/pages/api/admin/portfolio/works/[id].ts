import { getErrorInfo } from '../../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { PortfolioService, isPortfolioCategory } from '../../../../../services/portfolio.service';
import { logger } from '../../../../../lib/logger';

export const prerender = false;

const updateWorkSchema = z.object({
  categoryId: z.string().refine(isPortfolioCategory, 'Invalid category').optional(),
  title: z.string().trim().min(1).max(200).optional(),
  workUrl: z.string().trim().optional().nullable(),
  thumbnailUrl: z.string().trim().min(1).optional(),
  caption: z.string().trim().max(300).optional(),
  status: z.enum(['published', 'draft']).optional(),
  tags: z.array(z.string()).optional(),
});

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_ID', message: 'ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateWorkSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid update payload',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const item = await PortfolioService.updateWork(id, parsed.data);
    const items = await PortfolioService.listWorks(true);
    return new Response(JSON.stringify({ success: true, data: { item, items } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to update portfolio work item');
    const status = errInfo.statusCode || 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: errInfo.code || 'INTERNAL_ERROR',
          message: errInfo.message || 'Update failed',
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_ID', message: 'ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await PortfolioService.deleteWork(id);
    const items = await PortfolioService.listWorks(true);
    return new Response(JSON.stringify({ success: true, data: { items } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to delete portfolio work item');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Delete failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
