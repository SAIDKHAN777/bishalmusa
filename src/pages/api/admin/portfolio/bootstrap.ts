import type { APIRoute } from 'astro';
import { PortfolioService } from '../../../../services/portfolio.service';
import { logger } from '../../../../lib/logger';
import { getErrorInfo } from '../../../../lib/error-utils';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const [siteConfig, works, inquiries] = await Promise.all([
      PortfolioService.getSiteConfig(),
      PortfolioService.listWorks(true),
      PortfolioService.listInquiries(),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: locals.user ?? null,
          database: 'connected',
          siteConfig,
          works,
          inquiries,
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
    logger.error({ err }, 'Failed to load admin portfolio bootstrap');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: info.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
