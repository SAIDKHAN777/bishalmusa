import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { SettingService } from '../../../services/setting.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const settings = await SettingService.getPublic();
    return new Response(
      JSON.stringify({
        success: true,
        data: settings,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800',
        },
      }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch public site settings');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
