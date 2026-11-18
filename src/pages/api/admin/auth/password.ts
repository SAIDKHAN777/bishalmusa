import type { APIRoute } from 'astro';
import { changePasswordSchema } from '../../../../lib/validators/auth';
import { AuthService } from '../../../../services/auth.service';
import { getErrorInfo } from '../../../../lib/error-utils';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid password payload',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await AuthService.changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );

    return new Response(
      JSON.stringify({ success: true, data: { message: 'Admin password updated successfully.' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Failed to update password');
    const status = info.message.includes('INVALID_CREDENTIALS') ? 401 : 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: status === 401 ? 'INVALID_CREDENTIALS' : 'INTERNAL_ERROR', message: info.message },
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
