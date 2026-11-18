import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { AnalyticsService } from '../../../services/analytics.service';
import { projectClickSchema } from '../../../lib/validators/analytics';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Request body must be a JSON object' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsed = projectClickSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project click payload',
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

    const result = await AnalyticsService.recordProjectClick(parsed.data, clientIp, userAgent);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    if (status !== 500) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: errInfo.code, message: errInfo.message },
        }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.error({ err }, 'Failed to record project click');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to record project click' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
