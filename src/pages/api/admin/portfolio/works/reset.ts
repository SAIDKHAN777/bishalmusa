import { getErrorInfo } from '../../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { PortfolioService } from '../../../../../services/portfolio.service';
import { logger } from '../../../../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async () => {
  try {
    const items = await PortfolioService.resetDemoWorks();
    return new Response(JSON.stringify({ success: true, data: { items } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to reset demo works');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message || 'Reset failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
