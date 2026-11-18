import pino from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: {
    paths: [
      'password',
      'adminPassword',
      'passwordHash',
      'token',
      'secret',
      'sessionToken',
      'cookie',
      'authorization',
      'headers.authorization',
      'headers.cookie',
      'CLOUDINARY_API_SECRET',
      'RESEND_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TURNSTILE_SECRET_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
