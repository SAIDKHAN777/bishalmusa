import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { TestimonialService } from '../../../../services/testimonial.service';
import { createTestimonialSchema } from '../../../../lib/validators/content';
import { logger } from '../../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const testimonials = await TestimonialService.list(false, false);
    return new Response(
      JSON.stringify({ success: true, data: testimonials }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to fetch testimonials');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createTestimonialSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.issues },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const testimonial = await TestimonialService.create(parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: testimonial }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Admin failed to create testimonial');
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: errInfo.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
