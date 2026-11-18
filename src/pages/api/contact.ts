import { getErrorInfo } from '../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ContactService } from '../../services/contact.service';
import { contactFormSchema } from '../../lib/validators/contact';
import { logger } from '../../lib/logger';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Request body must be a valid JSON object' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsed = contactFormSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid contact form input',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine client IP safely
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      clientAddress ||
      '127.0.0.1';

    const result = await ContactService.submitMessage(parsed.data, clientIp);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    if (errInfo.statusCode && errInfo.code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: errInfo.code, message: errInfo.message },
        }),
        { status: errInfo.statusCode, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.error({ err }, 'Unexpected error handling contact form submission');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred while processing your message' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
