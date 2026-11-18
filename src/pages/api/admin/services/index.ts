import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ServiceService } from '../../../../services/service.service';
import { createServiceSchema } from '../../../../lib/validators/content';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const services = await ServiceService.list(false);
    return new Response(
      JSON.stringify({ success: true, data: services }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to fetch services');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createServiceSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const service = await ServiceService.create(parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: service }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to create service');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
