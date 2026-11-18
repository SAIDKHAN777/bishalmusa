import type { APIRoute } from 'astro';
import { AnalyticsService } from '../../../services/analytics.service';
import { pageViewSchema } from '../../../lib/validators/analytics';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = pageViewSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid pageview payload',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      clientAddress ||
      '127.0.0.1';

    const userAgent = request.headers.get('user-agent');

    const result = await AnalyticsService.recordPageView(parsed.data, clientIp, userAgent);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to record pageview');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to record pageview' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
