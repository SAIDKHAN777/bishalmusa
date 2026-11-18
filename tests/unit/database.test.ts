import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { db, rawDb, checkDatabaseHealth } from '../../src/lib/db';
import argon2 from 'argon2';
import { Status, Role, ClickType, ApprovalStatus } from '@prisma/client';
import { ProjectService } from '../../src/services/project.service';
import { BlogService } from '../../src/services/blog.service';
import { TestimonialService } from '../../src/services/testimonial.service';
import { seed } from '../../prisma/seed';

describe('Database Models, Integrity, Constraints & Data Access Layer (Prisma)', () => {
  const timestamp = Date.now();
  let testCatId: string;
  let testTagId: string;

  beforeAll(async () => {
    // Ensure test category and tag exist
    const cat = await db.category.create({
      data: {
        name: `Test Cat ${timestamp}`,
        slug: `test-cat-${timestamp}`,
        description: 'Test category description',
      },
    });
    testCatId = cat.id;

    const tag = await db.tag.create({
      data: {
        name: `TestTag${timestamp}`,
        slug: `test-tag-${timestamp}`,
      },
    });
    testTagId = tag.id;
  });

  afterAll(async () => {
    // Clean up test records
    await db.projectClick.deleteMany({
      where: { ipHash: { startsWith: 'test-' } },
    });
    await db.project.deleteMany({
      where: { slug: { startsWith: 'test-' } },
    });
    await db.blogPost.deleteMany({
      where: { slug: { startsWith: 'test-' } },
    });
    await db.category.deleteMany({
      where: { slug: { startsWith: 'test-' } },
    });
    await db.tag.deleteMany({
      where: { slug: { startsWith: 'test-' } },
    });
    await db.skill.deleteMany({
      where: { name: { startsWith: 'Test Skill' } },
    });
    await db.testimonial.deleteMany({
      where: { authorName: { startsWith: 'Test Author' } },
    });
    await db.user.deleteMany({
      where: { email: { startsWith: 'test-cascade-' } },
    });
    await db.$disconnect();
  });

  // 1. Health Ping
  it('should successfully execute checkDatabaseHealth SELECT 1 ping', async () => {
    const health = await checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.error).toBeUndefined();
  });

  // 2. Seeded Admin & SiteSetting
  it('should verify the seeded Admin user and Argon2 password hash', async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';

    const admin = await db.user.findUnique({
      where: { email: adminEmail },
    });

    expect(admin).toBeDefined();
    expect(admin?.role).toBe(Role.ADMIN);
    expect(admin?.email).toBe(adminEmail);

    const isPasswordValid = await argon2.verify(admin!.passwordHash, adminPassword);
    expect(isPasswordValid).toBe(true);

    const isWrongPasswordValid = await argon2.verify(admin!.passwordHash, 'WrongPassword123!');
    expect(isWrongPasswordValid).toBe(false);
  });

  it('should verify the seeded default SiteSetting', async () => {
    const settings = await db.siteSetting.findUnique({
      where: { id: 'default' },
    });

    expect(settings).toBeDefined();
    expect(settings?.siteName).toMatch(/Said Khan Portfolio/);
    expect(settings?.contactEmail).toBe(process.env.ADMIN_EMAIL || 'admin@saidkhan.dev');
  });

  // 3. Unique Constraints
  it('should enforce unique constraint on User email', async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
    await expect(
      db.user.create({
        data: {
          email: adminEmail,
          name: 'Duplicate Admin',
          passwordHash: 'dummy_hash',
          role: Role.ADMIN,
        },
      })
    ).rejects.toThrowError();
  });

  it('should enforce unique constraint on Category slug', async () => {
    const slug = `test-cat-unique-${Date.now()}`;
    await db.category.create({
      data: { name: `Cat 1 ${slug}`, slug },
    });

    await expect(
      db.category.create({
        data: { name: `Cat 2 ${slug}`, slug },
      })
    ).rejects.toThrowError();
  });

  it('should enforce unique constraint on Project slug', async () => {
    const slug = `test-proj-unique-${Date.now()}`;
    await db.project.create({
      data: {
        title: 'Project 1',
        slug,
        summary: 'Summary 1',
        description: 'Desc 1',
        categoryId: testCatId,
      },
    });

    await expect(
      db.project.create({
        data: {
          title: 'Project 2',
          slug,
          summary: 'Summary 2',
          description: 'Desc 2',
          categoryId: testCatId,
        },
      })
    ).rejects.toThrowError();
  });

  it('should enforce unique constraint on BlogPost slug', async () => {
    const slug = `test-blog-unique-${Date.now()}`;
    await db.blogPost.create({
      data: {
        title: 'Blog 1',
        slug,
        content: '# Blog 1 content',
      },
    });

    await expect(
      db.blogPost.create({
        data: {
          title: 'Blog 2',
          slug,
          content: '# Blog 2 content',
        },
      })
    ).rejects.toThrowError();
  });

  // 4. Relations
  it('should create and verify Category -> Project (many-to-one) relation', async () => {
    const testProject = await db.project.create({
      data: {
        title: 'Test Project Title',
        slug: 'test-project-' + Date.now(),
        summary: 'A test project summary',
        description: 'Detailed description for test project',
        status: Status.PUBLISHED,
        featured: true,
        categoryId: testCatId,
        tags: ['TypeScript', 'Astro'],
      },
      include: {
        category: true,
      },
    });

    expect(testProject.id).toBeDefined();
    expect(testProject.category?.id).toBe(testCatId);
    expect(testProject.status).toBe(Status.PUBLISHED);
    expect(testProject.featured).toBe(true);
  });

  it('should create and verify BlogPost <-> Tag (many-to-many) relation', async () => {
    const testPost = await db.blogPost.create({
      data: {
        title: 'Test Blog Post',
        slug: 'test-post-' + Date.now(),
        content: '# Heading 1\nThis is a test blog post in markdown.',
        status: Status.DRAFT,
        readingTimeMinutes: 3,
        tags: {
          connect: { id: testTagId },
        },
      },
      include: {
        tags: true,
      },
    });

    expect(testPost.id).toBeDefined();
    expect(testPost.status).toBe(Status.DRAFT);
    expect(testPost.tags).toHaveLength(1);
    expect(testPost.tags[0].id).toBe(testTagId);
  });

  // 5. Cascade Deletes
  it('should cascade delete Sessions when User is deleted', async () => {
    const tempEmail = `test-cascade-user-${Date.now()}@example.com`;
    const tempUser = await db.user.create({
      data: {
        email: tempEmail,
        name: 'Cascade Test User',
        passwordHash: 'dummy_hash',
      },
    });

    const session = await db.session.create({
      data: {
        userId: tempUser.id,
        tokenHash: `test-cascade-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    expect(session.id).toBeDefined();

    // Delete user
    await db.user.delete({ where: { id: tempUser.id } });

    // Session should be cascade deleted
    const foundSession = await db.session.findUnique({
      where: { id: session.id },
    });
    expect(foundSession).toBeNull();
  });

  it('should cascade delete ProjectClicks when Project is deleted', async () => {
    const testProj = await db.project.create({
      data: {
        title: 'Cascade Click Project',
        slug: `test-cascade-click-proj-${Date.now()}`,
        summary: 'Summary',
        description: 'Description',
        categoryId: testCatId,
      },
    });

    const click = await db.projectClick.create({
      data: {
        projectId: testProj.id,
        type: ClickType.LIVE,
        ipHash: `test-ip-hash-${Date.now()}`,
      },
    });

    expect(click.id).toBeDefined();

    // Delete project
    await db.project.delete({ where: { id: testProj.id } });

    // ProjectClick must be automatically deleted
    const clicks = await db.projectClick.findMany({
      where: { projectId: testProj.id },
    });
    expect(clicks).toHaveLength(0);
  });

  // 6. Soft Delete
  it('should automatically exclude soft-deleted projects from normal queries and allow explicit inclusion', async () => {
    const slug = 'test-soft-del-' + Date.now();
    const created = await db.project.create({
      data: {
        title: 'Soft Deleted Project',
        slug,
        summary: 'A project marked as deleted',
        description: 'Testing soft delete filter',
        status: Status.PUBLISHED,
        deletedAt: new Date(),
        categoryId: testCatId,
      },
    });

    // 1. Normal query should NOT return the soft-deleted project
    const normalQuery = await db.project.findMany({
      where: { slug },
    });
    expect(normalQuery).toHaveLength(0);

    const normalFindFirst = await db.project.findFirst({
      where: { slug },
    });
    expect(normalFindFirst).toBeNull();

    // 2. Query with includeDeleted: true should find it
    const explicitQuery = await (db.project.findMany as any)({
      where: { slug },
      includeDeleted: true,
    });
    expect(explicitQuery).toHaveLength(1);
    expect(explicitQuery[0].id).toBe(created.id);

    // Clean up
    await db.project.delete({ where: { id: created.id } });
  });

  it('should perform soft delete via ProjectService.delete without dropping row from database', async () => {
    const slug = `test-service-softdel-${Date.now()}`;
    const project = await db.project.create({
      data: {
        title: 'Service Soft Delete Test',
        slug,
        summary: 'Test summary',
        description: 'Test description',
        categoryId: testCatId,
      },
    });

    await ProjectService.delete(project.id);

    // Excluded from standard ProjectService retrieval
    const fetched = await ProjectService.getBySlug(slug);
    expect(fetched).toBeNull();

    // Still present in raw database with deletedAt timestamp
    const rawRecord = await rawDb.project.findUnique({
      where: { id: project.id },
    });
    expect(rawRecord).not.toBeNull();
    expect(rawRecord?.deletedAt).toBeInstanceOf(Date);

    // Hard cleanup
    await rawDb.project.delete({ where: { id: project.id } });
  });

  // 7. CHECK Constraints
  it('should reject invalid skill level (< 0 or > 100) via database CHECK constraint', async () => {
    await expect(
      rawDb.$executeRawUnsafe(
        `INSERT INTO "Skill" (id, name, level, "proficiencyLevel", category, "order", "isVisible", featured, "createdAt", "updatedAt") 
         VALUES ('test-skill-invalid', 'Invalid Skill', 150, 150, 'Backend', 0, true, false, NOW(), NOW())`
      )
    ).rejects.toThrowError(/violates check constraint "skill_level_check"/i);
  });

  it('should reject invalid testimonial rating (< 1 or > 5) via database CHECK constraint', async () => {
    await expect(
      rawDb.$executeRawUnsafe(
        `INSERT INTO "Testimonial" (id, "authorName", "authorTitle", content, rating, "isApproved", featured, status, "order", "createdAt", "updatedAt") 
         VALUES ('test-rating-invalid', 'Jane Doe', 'VP', 'Excellent work', 10, true, false, 'APPROVED', 0, NOW(), NOW())`
      )
    ).rejects.toThrowError(/violates check constraint "testimonial_rating_check"/i);
  });

  // 8. Seed Idempotency
  it('should execute seed idempotently without throwing errors or duplicating data', async () => {
    const userCountBefore = await db.user.count();
    const settingsCountBefore = await db.siteSetting.count();

    // Re-run seed
    await seed();

    const userCountAfter = await db.user.count();
    const settingsCountAfter = await db.siteSetting.count();

    expect(userCountAfter).toBe(userCountBefore);
    expect(settingsCountAfter).toBe(settingsCountBefore);
    expect(settingsCountAfter).toBe(1);
  });

  // 9. Pagination & Filtering in Data Access Layer
  it('should correctly paginate and filter projects via ProjectService.list', async () => {
    // Create 3 projects in test category
    const p1 = await db.project.create({
      data: {
        title: 'Pagination Project 1',
        slug: `test-page-proj-1-${Date.now()}`,
        summary: 'P1',
        description: 'D1',
        status: Status.PUBLISHED,
        order: 1,
        categoryId: testCatId,
      },
    });
    const p2 = await db.project.create({
      data: {
        title: 'Pagination Project 2',
        slug: `test-page-proj-2-${Date.now()}`,
        summary: 'P2',
        description: 'D2',
        status: Status.PUBLISHED,
        order: 2,
        categoryId: testCatId,
      },
    });

    const page1 = await ProjectService.list({
      limit: 1,
      page: 1,
      category: `test-cat-${timestamp}`,
      isAdmin: false,
    });
    expect(page1.items).toHaveLength(1);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(2);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.limit).toBe(1);

    const page2 = await ProjectService.list({
      limit: 1,
      page: 2,
      category: `test-cat-${timestamp}`,
      isAdmin: false,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);

    await db.project.deleteMany({
      where: { id: { in: [p1.id, p2.id] } },
    });
  });

  it('should filter blog posts by tag via BlogService.listPosts', async () => {
    const postWithTag = await db.blogPost.create({
      data: {
        title: 'Tagged Post',
        slug: `test-tagged-post-${Date.now()}`,
        content: '# Tagged post markdown content',
        status: Status.PUBLISHED,
        tags: { connect: { id: testTagId } },
      },
    });

    const postWithoutTag = await db.blogPost.create({
      data: {
        title: 'Untagged Post',
        slug: `test-untagged-post-${Date.now()}`,
        content: '# Untagged post markdown content',
        status: Status.PUBLISHED,
      },
    });

    const result = await BlogService.listPosts({
      page: 1,
      limit: 20,
      tag: `test-tag-${timestamp}`,
      isAdmin: false,
    });

    expect(result.items.some((p) => p.id === postWithTag.id)).toBe(true);
    expect(result.items.some((p) => p.id === postWithoutTag.id)).toBe(false);

    await db.blogPost.deleteMany({
      where: { id: { in: [postWithTag.id, postWithoutTag.id] } },
    });
  });

  // 10. Public vs Admin Visibility Rules
  it('should enforce public vs admin visibility rules for published, draft, and soft-deleted projects', async () => {
    const pubProj = await db.project.create({
      data: {
        title: 'Public Active',
        slug: `test-vis-pub-${Date.now()}`,
        summary: 'Pub',
        description: 'Pub Desc',
        status: Status.PUBLISHED,
        categoryId: testCatId,
      },
    });
    const draftProj = await db.project.create({
      data: {
        title: 'Draft Project',
        slug: `test-vis-draft-${Date.now()}`,
        summary: 'Draft',
        description: 'Draft Desc',
        status: Status.DRAFT,
        categoryId: testCatId,
      },
    });

    // Public list should include PUBLISHED and exclude DRAFT
    const publicList = await ProjectService.list({ page: 1, limit: 50, isAdmin: false });
    expect(publicList.items.some((p) => p.id === pubProj.id)).toBe(true);
    expect(publicList.items.some((p) => p.id === draftProj.id)).toBe(false);

    // Admin list can filter drafts
    const adminDrafts = await ProjectService.list({ page: 1, limit: 50, isAdmin: true, status: Status.DRAFT });
    expect(adminDrafts.items.some((p) => p.id === draftProj.id)).toBe(true);

    await db.project.deleteMany({
      where: { id: { in: [pubProj.id, draftProj.id] } },
    });
  });

  it('should enforce public visibility rules for Testimonials (APPROVED only)', async () => {
    const approved = await TestimonialService.create({
      authorName: 'Test Author Approved',
      authorTitle: 'VP',
      content: 'Great engineer',
      rating: 5,
      status: ApprovalStatus.APPROVED,
      order: 0,
      featured: true,
    });

    const pending = await TestimonialService.create({
      authorName: 'Test Author Pending',
      authorTitle: 'Manager',
      content: 'Awaiting moderation',
      rating: 4,
      status: ApprovalStatus.PENDING,
      order: 1,
      featured: false,
    });

    // Public list: approvedOnly = true
    const publicList = await TestimonialService.list(true);
    expect(publicList.some((t) => t.id === approved.id)).toBe(true);
    expect(publicList.some((t) => t.id === pending.id)).toBe(false);

    // Admin list: approvedOnly = false
    const adminList = await TestimonialService.list(false);
    expect(adminList.some((t) => t.id === approved.id)).toBe(true);
    expect(adminList.some((t) => t.id === pending.id)).toBe(true);

    await db.testimonial.deleteMany({
      where: { id: { in: [approved.id, pending.id] } },
    });
  });
});
