import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ProjectService } from '../../../../services/project.service';
import { createProjectSchema, paginationQuerySchema } from '../../../../lib/validators/content';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const parsed = paginationQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await ProjectService.list({ ...parsed.data, isAdmin: true });
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to fetch projects');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const project = await ProjectService.create(parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: project }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to create project');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
