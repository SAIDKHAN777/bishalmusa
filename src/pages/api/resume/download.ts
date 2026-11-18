import type { APIRoute } from 'astro';
import { MediaService } from '../../../services/media.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ request, clientAddress }) => {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      clientAddress ||
      '127.0.0.1';

    const referrer = request.headers.get('referer') || undefined;

    const result = await MediaService.trackResumeDownload(clientIp, referrer);

    // 302 Redirect to the resume asset while providing JSON body
    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 302,
        headers: {
          Location: result.resumeUrl,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to process resume download tracking');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to process resume download' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
