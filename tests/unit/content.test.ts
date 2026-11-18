import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/lib/db';
import { CategoryService } from '../../src/services/category.service';
import { ProjectService } from '../../src/services/project.service';
import { SkillService } from '../../src/services/skill.service';
import { ServiceService } from '../../src/services/service.service';
import { ExperienceService } from '../../src/services/experience.service';
import { EducationService } from '../../src/services/education.service';
import { TestimonialService } from '../../src/services/testimonial.service';
import { SettingService } from '../../src/services/setting.service';
import { Status, ApprovalStatus } from '@prisma/client';

describe('Content Services (Domain Layer)', () => {
  let testCategoryId: string;
  let testProjectId: string;
  let testSkillId: string;
  let testServiceId: string;
  let testExpId: string;
  let testEduId: string;
  let testTestimonialId: string;

  beforeAll(async () => {
    // Clean up past test fixtures if any
    await db.project.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
    await db.category.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
    await db.service.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
  });

  afterAll(async () => {
    await db.project.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
    await db.category.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
    await db.skill.deleteMany({ where: { name: { startsWith: 'Unit Skill' } } });
    await db.service.deleteMany({ where: { slug: { startsWith: 'unit-' } } });
    await db.experience.deleteMany({ where: { company: 'Unit Test Co' } });
    await db.education.deleteMany({ where: { institution: 'Unit Test University' } });
    await db.testimonial.deleteMany({ where: { authorName: 'Unit Test Client' } });
    await db.$disconnect();
  });

  it('should perform CRUD operations on CategoryService', async () => {
    const category = await CategoryService.create({
      name: 'Unit Category',
      slug: 'unit-cat-' + Date.now(),
      description: 'Test category description',
    });

    expect(category.id).toBeDefined();
    testCategoryId = category.id;

    const list = await CategoryService.list();
    expect(list.some((c) => c.id === category.id)).toBe(true);

    const updated = await CategoryService.update(category.id, {
      name: 'Updated Unit Category',
    });
    expect(updated.name).toBe('Updated Unit Category');

    await CategoryService.delete(category.id);
    const afterDelete = await CategoryService.getById(category.id);
    expect(afterDelete).toBeNull();
  });

  it('should test ProjectService with pagination, filtering, and view counting', async () => {
    // 1. Create a fresh category
    const cat = await CategoryService.create({
      name: 'Web Dev',
      slug: 'unit-web-' + Date.now(),
    });

    // 2. Create Published and Draft projects
    const p1 = await ProjectService.create({
      title: 'Unit Published Project',
      slug: 'unit-published-' + Date.now(),
      summary: 'Published project summary',
      description: 'Full description',
      status: Status.PUBLISHED,
      featured: true,
      categoryId: cat.id,
      tags: ['Astro', 'TypeScript'],
      order: 1,
    });
    testProjectId = p1.id;

    const p2 = await ProjectService.create({
      title: 'Unit Draft Project',
      slug: 'unit-draft-' + Date.now(),
      summary: 'Draft project summary',
      description: 'Full description',
      status: Status.DRAFT,
      featured: false,
      categoryId: cat.id,
      tags: ['Draft'],
      order: 2,
    });

    // 3. Public list (isAdmin = false) should ONLY return published project
    const publicList = await ProjectService.list({ page: 1, limit: 100, isAdmin: false });
    expect(publicList.items.some((item) => item.id === p1.id)).toBe(true);
    expect(publicList.items.some((item) => item.id === p2.id)).toBe(false);

    // 4. Admin list (isAdmin = true) should return both
    const adminList = await ProjectService.list({ page: 1, limit: 100, isAdmin: true });
    expect(adminList.items.some((item) => item.id === p2.id)).toBe(true);

    // 5. Featured filter
    const featuredList = await ProjectService.list({ page: 1, limit: 100, featured: true, isAdmin: false });
    expect(featuredList.items.some((item) => item.id === p1.id)).toBe(true);

    // 6. View count increment
    const initialViews = p1.viewsCount;
    const viewedProject = await ProjectService.getBySlug(p1.slug, true);
    expect(viewedProject?.viewsCount).toBe(initialViews + 1);

    // Clean up
    await ProjectService.delete(p1.id);
    await ProjectService.delete(p2.id);
    await CategoryService.delete(cat.id);
  });

  it('should perform CRUD on SkillService', async () => {
    const skill = await SkillService.create({
      name: 'Unit Skill - Fastify',
      category: 'Backend',
      proficiencyLevel: 90,
      featured: true,
      order: 1,
    });
    testSkillId = skill.id;

    expect(skill.name).toBe('Unit Skill - Fastify');

    const featuredSkills = await SkillService.list(true);
    expect(featuredSkills.some((s) => s.id === skill.id)).toBe(true);

    const updated = await SkillService.update(skill.id, { proficiencyLevel: 98 });
    expect(updated.proficiencyLevel).toBe(98);

    await SkillService.delete(skill.id);
    const afterDelete = await SkillService.getById(skill.id);
    expect(afterDelete).toBeNull();
  });

  it('should perform CRUD on ServiceService', async () => {
    const service = await ServiceService.create({
      title: 'Unit Service Architecture',
      slug: 'unit-arch-' + Date.now(),
      description: 'Distributed architecture consulting',
      active: true,
      order: 1,
      features: ['High Availability', 'Zero Downtime'],
    });
    testServiceId = service.id;

    const list = await ServiceService.list(true);
    expect(list.some((s) => s.id === service.id)).toBe(true);

    await ServiceService.delete(service.id);
    const afterDelete = await ServiceService.getById(service.id);
    expect(afterDelete).toBeNull();
  });

  it('should perform CRUD on ExperienceService and EducationService', async () => {
    const exp = await ExperienceService.create({
      company: 'Unit Test Co',
      role: 'Staff Engineer',
      startDate: new Date('2024-01-01'),
      isCurrent: true,
      description: 'Building large scale infrastructure',
      technologies: ['Node.js', 'PostgreSQL', 'Redis'],
      employmentType: 'Full-time',
      order: 0,
    });
    testExpId = exp.id;

    expect(exp.role).toBe('Staff Engineer');
    const expList = await ExperienceService.list();
    expect(expList.some((e) => e.id === exp.id)).toBe(true);
    await ExperienceService.delete(exp.id);

    const edu = await EducationService.create({
      institution: 'Unit Test University',
      degree: 'B.Sc. in Computer Science',
      startDate: new Date('2018-01-01'),
      endDate: new Date('2022-01-01'),
      order: 0,
    });
    testEduId = edu.id;

    const eduList = await EducationService.list();
    expect(eduList.some((e) => e.id === edu.id)).toBe(true);
    await EducationService.delete(edu.id);
  });

  it('should perform CRUD on TestimonialService with approval filtering', async () => {
    const approved = await TestimonialService.create({
      authorName: 'Unit Test Client',
      authorTitle: 'CTO',
      content: 'Said delivers incredible quality.',
      rating: 5,
      status: ApprovalStatus.APPROVED,
      featured: true,
      order: 0,
    });
    testTestimonialId = approved.id;

    const pending = await TestimonialService.create({
      authorName: 'Unit Test Client Pending',
      authorTitle: 'Manager',
      content: 'Pending review',
      rating: 4,
      status: ApprovalStatus.PENDING,
      featured: false,
      order: 1,
    });

    const publicList = await TestimonialService.list(true);
    expect(publicList.some((t) => t.id === approved.id)).toBe(true);
    expect(publicList.some((t) => t.id === pending.id)).toBe(false);

    await TestimonialService.delete(approved.id);
    await TestimonialService.delete(pending.id);
  });

  it('should verify SettingService public vs admin fields and update logic', async () => {
    const full = await SettingService.get();
    expect(full.id).toBe('default');

    const publicSettings = await SettingService.getPublic();
    expect(publicSettings.siteName).toBeDefined();
    // Public settings should NOT expose internal keys like id or turnstileEnabled
    expect((publicSettings as any).id).toBeUndefined();
    expect((publicSettings as any).turnstileEnabled).toBeUndefined();

    const updated = await SettingService.update({
      tagline: 'Senior Backend Engineer & Distributed Systems Lead',
    });
    expect(updated.tagline).toBe('Senior Backend Engineer & Distributed Systems Lead');
  });
});
