import { PrismaClient, Role, Status } from '@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { logger } from '../src/lib/logger';

dotenv.config();

const prisma = new PrismaClient();

export async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD;

  logger.info({ email: adminEmail }, 'Starting database seeding process');

  // Strict Password Strength Check
  if (!adminPassword || adminPassword.trim().length < 8) {
    logger.error('Database seed aborted: ADMIN_PASSWORD is missing or too weak (minimum 8 characters required).');
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  }

  // Hash admin password using Argon2id
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 1. Upsert Admin User (Essential in all environments)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.ADMIN,
      name: 'Said Khan',
    },
    create: {
      email: adminEmail,
      name: 'Said Khan',
      passwordHash,
      role: Role.ADMIN,
    },
  });
  logger.info({ adminId: admin.id, email: admin.email }, 'Admin user seeded successfully');

  // 2. Upsert Default SiteSetting (Essential in all environments)
  const settings = await prisma.siteSetting.upsert({
    where: { id: 'default' },
    update: {
      siteName: 'Said Khan Portfolio',
      contactEmail: adminEmail,
      email: adminEmail,
    },
    create: {
      id: 'default',
      siteName: 'Said Khan Portfolio',
      heroTitle: 'Senior Full-Stack Engineer & System Architect',
      heroSubtitle: 'Building scalable distributed systems, high-performance backends, and AI pipelines.',
      tagline: 'System Architect & Senior Backend Engineer',
      bio: 'Enterprise software engineer with deep expertise in PostgreSQL, distributed systems, Node.js, and autonomous AI systems.',
      contactEmail: adminEmail,
      email: adminEmail,
      phone: '+880 1700 000000',
      location: 'Dhaka, Bangladesh',
      socialLinks: {
        github: 'https://github.com/saidkhan',
        linkedin: 'https://linkedin.com/in/saidkhan',
        twitter: 'https://twitter.com/saidkhan',
      },
      resumeUrl: 'https://res.cloudinary.com/demo/image/upload/sample_resume.pdf',
      defaultSeoTitle: 'Said Khan | Senior Software Engineer & System Architect',
      defaultSeoDescription: 'Official portfolio, engineering articles, and software architecture case studies of Said Khan.',
      defaultOgImage: 'https://res.cloudinary.com/demo/image/upload/og-cover.png',
      seoTitle: 'Said Khan - Senior Backend Engineer & System Architect',
      seoDescription: 'Personal portfolio and technical blog of Said Khan.',
      maintenanceMode: false,
      turnstileEnabled: false,
    },
  });
  logger.info({ settingId: settings.id, siteName: settings.siteName }, 'SiteSetting singleton seeded successfully');

  // 3. Upsert Default Categories (Essential in all environments)
  const defaultCategories = [
    { name: 'Full-Stack Engineering', slug: 'full-stack', description: 'Web applications and interactive user interfaces' },
    { name: 'Distributed Systems & Cloud', slug: 'cloud-systems', description: 'Microservices, Docker, Kubernetes, and high availability backends' },
    { name: 'AI & Workflow Automation', slug: 'ai-automation', description: 'Autonomous agents, BullMQ workers, and LLM integrations' },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: { name: cat.name, slug: cat.slug, description: cat.description },
    });
  }
  logger.info({ count: defaultCategories.length }, 'Default categories seeded successfully');

  // 4. Sample Data (Seeded ONLY in development or when explicitly requested)
  const isDev = process.env.NODE_ENV === 'development' || process.env.SEED_SAMPLE_DATA === 'true';

  if (isDev) {
    logger.info('Development environment detected; seeding sample Skills and Services');

    const sampleSkills = [
      { name: 'TypeScript & Node.js', category: 'Backend', level: 95, icon: 'nodejs', order: 1 },
      { name: 'PostgreSQL & Prisma', category: 'Database', level: 95, icon: 'postgresql', order: 2 },
      { name: 'Docker & Kubernetes', category: 'DevOps', level: 90, icon: 'docker', order: 3 },
      { name: 'React & Astro', category: 'Frontend', level: 90, icon: 'react', order: 4 },
      { name: 'Redis & BullMQ', category: 'Backend', level: 92, icon: 'redis', order: 5 },
    ];

    for (const skill of sampleSkills) {
      const existing = await prisma.skill.findFirst({ where: { name: skill.name } });
      if (existing) {
        await prisma.skill.update({
          where: { id: existing.id },
          data: {
            category: skill.category,
            level: skill.level,
            proficiencyLevel: skill.level,
            icon: skill.icon,
            order: skill.order,
          },
        });
      } else {
        await prisma.skill.create({
          data: {
            name: skill.name,
            category: skill.category,
            level: skill.level,
            proficiencyLevel: skill.level,
            icon: skill.icon,
            order: skill.order,
            isVisible: true,
          },
        });
      }
    }

    const sampleServices = [
      {
        title: 'Enterprise Backend Architecture',
        slug: 'enterprise-backend',
        description: 'Design and implementation of resilient, high-throughput REST and GraphQL backend services.',
        icon: 'server',
        order: 1,
      },
      {
        title: 'Database Design & Optimization',
        slug: 'database-optimization',
        description: 'PostgreSQL schema normalization, indexing strategies, query optimization, and connection pooling.',
        icon: 'database',
        order: 2,
      },
      {
        title: 'AI Agents & Background Queues',
        slug: 'ai-agents-automation',
        description: 'Autonomous worker pipelines, Redis-backed job queues with BullMQ, and LLM integrations.',
        icon: 'cpu',
        order: 3,
      },
    ];

    for (const srv of sampleServices) {
      await prisma.service.upsert({
        where: { slug: srv.slug },
        update: {
          title: srv.title,
          description: srv.description,
          icon: srv.icon,
          order: srv.order,
        },
        create: {
          title: srv.title,
          slug: srv.slug,
          description: srv.description,
          icon: srv.icon,
          order: srv.order,
          isVisible: true,
          active: true,
        },
      });
    }

    logger.info('Sample development skills and services seeded successfully');
  } else {
    logger.info('Non-development environment detected; skipping sample demo data');
  }

  logger.info('Database seeding process completed cleanly');
  return { admin, settings };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('seed.ts')) {
  seed()
    .catch((e) => {
      logger.error({ err: e }, 'Fatal seeding failure');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
