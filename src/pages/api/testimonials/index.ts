import { getErrorInfo } from '../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { TestimonialService } from '../../../services/testimonial.service';
import { logger } from '../../../lib/logger';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const featuredOnly = url.searchParams.get('featured') === 'true';
    const testimonials = await TestimonialService.list(true, featuredOnly);
    return new Response(
      JSON.stringify({
        success: true,
        data: testimonials,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    logger.error({ err }, 'Failed to fetch public testimonials');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
