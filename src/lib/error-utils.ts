export interface AppErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
}

export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function getErrorInfo(err: unknown, fallback = 'Internal server error'): AppErrorInfo {
  if (err instanceof AppError) {
    return { message: err.message, code: err.code, statusCode: err.statusCode };
  }
  if (err instanceof Error) {
    const rec = err as Error & { code?: unknown; statusCode?: unknown };
    return {
      message: err.message || fallback,
      code: typeof rec.code === 'string' ? rec.code : undefined,
      statusCode: typeof rec.statusCode === 'number' ? rec.statusCode : undefined,
    };
  }
  if (typeof err === 'object' && err !== null) {
    const rec = err as Record<string, unknown>;
    return {
      message: typeof rec.message === 'string' && rec.message ? rec.message : fallback,
      code: typeof rec.code === 'string' ? rec.code : undefined,
      statusCode: typeof rec.statusCode === 'number' ? rec.statusCode : undefined,
    };
  }
  return { message: fallback };
}
