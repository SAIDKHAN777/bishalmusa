import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { AnalyticsService } from '../../../../services/analytics.service';
import { analyticsStatsQuerySchema } from '../../../../lib/validators/analytics';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = analyticsStatsQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid stats query parameters',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stats = await AnalyticsService.getStats(parsed.data);

    return new Response(
      JSON.stringify({
        success: true,
        data: stats,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch admin analytics stats');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
