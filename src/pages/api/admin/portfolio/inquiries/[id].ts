import { getErrorInfo } from '../../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { PortfolioService } from '../../../../../services/portfolio.service';
import { logger } from '../../../../../lib/logger';

export const prerender = false;

const statusSchema = z.object({
  status: z.enum(['new', 'read', 'replied']),
});

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_ID', message: 'ID required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid status' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await PortfolioService.updateInquiryStatus(id, parsed.data.status);
    const items = await PortfolioService.listInquiries();
    return new Response(JSON.stringify({ success: true, data: { item: updated, items } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to update inquiry status');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Update failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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

    await PortfolioService.deleteInquiry(id);
    const items = await PortfolioService.listInquiries();
    return new Response(JSON.stringify({ success: true, data: { items } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to delete inquiry');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Delete failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
