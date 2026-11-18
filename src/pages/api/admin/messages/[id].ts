import { getErrorInfo } from '../../../../lib/error-utils';
import type { APIRoute } from 'astro';
import { ContactService } from '../../../../services/contact.service';
import { messageUpdateSchema } from '../../../../lib/validators/contact';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Message ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = await ContactService.getMessageById(id);
    return new Response(
      JSON.stringify({ success: true, data: message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Message ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = messageUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.issues,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await ContactService.updateMessage(id, parsed.data);
    return new Response(
      JSON.stringify({ success: true, data: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_ID', message: 'Message ID is required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await ContactService.deleteMessage(id);
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errInfo = getErrorInfo(err);
    const status = errInfo.statusCode || (errInfo.code === 'NOT_FOUND' ? 404 : 500);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: errInfo.code || 'INTERNAL_ERROR', message: errInfo.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
