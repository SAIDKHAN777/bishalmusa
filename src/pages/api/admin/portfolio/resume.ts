import type { APIRoute } from 'astro';
import { PortfolioService } from '../../../../services/portfolio.service';
import { logger } from '../../../../lib/logger';
import { getErrorInfo } from '../../../../lib/error-utils';

export const prerender = false;

export const DELETE: APIRoute = async () => {
  try {
    const updated = await PortfolioService.clearUploadedResume();
    return new Response(JSON.stringify({ success: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Failed to remove resume');
    logger.error({ err }, 'Failed to clear uploaded resume');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: info.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
