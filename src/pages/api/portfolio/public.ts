import type { APIRoute } from 'astro';
import { PortfolioService } from '../../../services/portfolio.service';
import { logger } from '../../../lib/logger';
import { getErrorInfo } from '../../../lib/error-utils';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [siteConfig, works] = await Promise.all([
      PortfolioService.getSiteConfig(),
      PortfolioService.listWorks(false),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          siteConfig,
          works,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Database error');
    logger.error({ err }, 'Failed to fetch public portfolio data');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: info.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
