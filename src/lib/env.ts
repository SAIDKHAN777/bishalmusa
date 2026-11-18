import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4321),
  HOST: z.string().default('0.0.0.0'),
  SITE_URL: z.string().url().default('http://localhost:4321'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional().default(''),
  TEST_DATABASE_URL: z.string().optional().default(''),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  CLOUDINARY_CLOUD_NAME: z.string().default('demo_cloud'),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  CONTACT_RECEIVER_EMAIL: z.string().email().default('contact@saidkhan.dev'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  ANALYTICS_SALT: z.string().min(16, 'ANALYTICS_SALT must be at least 16 characters').default('internal_default_salt_32_characters_min'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    const isSsl =
      data.DATABASE_URL.includes('sslmode=require') ||
      data.DATABASE_URL.includes('sslmode=verify-full') ||
      data.DATABASE_URL.includes('sslmode=verify-ca') ||
      data.DATABASE_URL.includes('ssl=true');
    if (!isSsl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Security requirement: DATABASE_URL must require SSL (e.g., sslmode=require) in production environments.',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Environment variable validation failed. Server exiting.');
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
