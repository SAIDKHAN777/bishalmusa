import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ProjectService } from '../../../services/project.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { slug } = params;
    if (!slug) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Project slug is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const project = await ProjectService.getBySlug(slug, true);

    if (!project || project.status !== 'PUBLISHED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: project,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch project by slug');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
