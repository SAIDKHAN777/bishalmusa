import { PrismaClient, type Prisma } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';
import { captureException, captureMessage } from './sentry';
import { getErrorInfo } from './error-utils';

declare global {
  var __prismaRaw: PrismaClient | undefined;
  var __prisma: ExtendedPrismaClient | undefined;
}

const SLOW_QUERY_THRESHOLD_MS = 200;

type PrismaEventClient = PrismaClient<{
  log: [
    { emit: 'event'; level: 'query' },
    { emit: 'event'; level: 'error' },
    { emit: 'event'; level: 'warn' },
  ];
}>;

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient(prismaClientOptions) as PrismaEventClient;

  // Event-based structured logging for queries, slow queries, warnings and errors
  client.$on('query', (e: { query: string; params: string; duration: number }) => {
    if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({ query: e.query, durationMs: e.duration }, 'Slow database query detected');
      captureMessage(`Slow database query detected (${e.duration}ms)`, 'warning', {
        query: e.query,
        durationMs: e.duration,
      });
    } else if (env.NODE_ENV === 'development') {
      logger.debug({ query: e.query, durationMs: e.duration }, 'Prisma query executed');
    }
  });

  client.$on('error', (e: { message: string; target?: string }) => {
    logger.error({ target: e.target, message: e.message }, 'Prisma client database error');
    captureException(new Error(`Prisma Error: ${e.message}`), { target: e.target });
  });

  client.$on('warn', (e: { message: string }) => {
    logger.warn({ message: e.message }, 'Prisma client warning');
  });

  return client as unknown as PrismaClient;
}

export const rawDb: PrismaClient = globalThis.__prismaRaw ?? createPrismaClient();

type SoftDeleteArgs<T extends { where?: { deletedAt?: unknown } }> = T & {
  includeDeleted?: boolean;
};

function applySoftDeleteFilter<T extends { where?: { deletedAt?: unknown } }>(
  args: SoftDeleteArgs<T>
): T {
  if (args?.includeDeleted) {
    const { includeDeleted: _ignored, ...restArgs } = args;
    return restArgs as T;
  }
  if (args.where?.deletedAt === undefined) {
    args.where = { ...args.where, deletedAt: null };
  }
  return args;
}

/**
 * Soft Delete Extension for Project and BlogPost
 * Normal queries automatically exclude rows where deletedAt is set.
 * Pass `{ includeDeleted: true }` to explicitly include soft-deleted records.
 */
export function createExtendedClient(baseClient: PrismaClient) {
  return baseClient.$extends({
    name: 'softDeleteExtension',
    query: {
      project: {
        async findMany({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
        async findFirst({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
        async count({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
      },
      blogPost: {
        async findMany({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
        async findFirst({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
        async count({ args, query }) {
          return query(applySoftDeleteFilter(args as SoftDeleteArgs<typeof args>));
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;
export const db: ExtendedPrismaClient = globalThis.__prisma ?? createExtendedClient(rawDb);

if (env.NODE_ENV !== 'production') {
  globalThis.__prismaRaw = rawDb;
  globalThis.__prisma = db;
}

logger.debug('Prisma client singleton with soft delete extension initialized');

/**
 * Health check function that executes `SELECT 1` against the database
 * Returns { ok: true, latencyMs } on success, or { ok: false, error } on failure
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = performance.now();
  try {
    await rawDb.$queryRawUnsafe('SELECT 1');
    const latencyMs = Math.round(performance.now() - startTime);
    return { ok: true, latencyMs };
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Database ping failed');
    const latencyMs = Math.round(performance.now() - startTime);
    logger.error({ err, latencyMs }, 'Database health check failed');
    captureException(err, { context: 'checkDatabaseHealth', latencyMs });
    return { ok: false, latencyMs, error: info.message };
  }
}
