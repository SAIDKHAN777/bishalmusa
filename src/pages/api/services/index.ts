import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ServiceService } from '../../../services/service.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const services = await ServiceService.list(true);
    return new Response(
      JSON.stringify({
        success: true,
        data: services,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch public services');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
