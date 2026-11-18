import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ProjectService } from '../../../services/project.service';
import { paginationQuerySchema } from '../../../lib/validators/content';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = paginationQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await ProjectService.list({ ...parsed.data, isAdmin: false });
    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch public projects');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
