import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ExperienceService } from '../../../services/experience.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const experiences = await ExperienceService.list();
    return new Response(
      JSON.stringify({
        success: true,
        data: experiences,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch public experiences');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
