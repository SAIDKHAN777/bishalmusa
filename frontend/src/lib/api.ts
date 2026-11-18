import type { SiteConfig } from '../data/siteStore';
import type { WorkCategoryId, WorkItem } from '../data/workStore';
import type { ContactInquiry, InquiryStatus } from '../data/inquiryStore';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !payload?.success) {
    const err = new Error(payload?.error?.message || `Request failed (${res.status})`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = payload?.error?.code;
    throw err;
  }

  return payload.data as T;
}

export async function fetchPublicPortfolio(): Promise<{
  siteConfig: SiteConfig;
  works: WorkItem[];
}> {
  return requestJson('/api/portfolio/public', { method: 'GET' });
}

export async function submitPublicInquiry(input: {
  name: string;
  email: string;
  service: string;
  budget?: string;
  message: string;
}): Promise<ContactInquiry> {
  return requestJson('/api/portfolio/inquiries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function checkAdminSession(): Promise<{
  authenticated: boolean;
  user?: { id: string; email: string; name: string; role: string };
}> {
  try {
    const data = await requestJson<{
      user: { id: string; email: string; name: string; role: string };
    }>('/api/admin/auth/me', { method: 'GET' });
    return { authenticated: true, user: data.user };
  } catch {
    return { authenticated: false };
  }
}

export async function adminLogin(password: string): Promise<{
  user: { id: string; email: string; name: string; role: string };
  expiresAt: string;
}> {
  return requestJson('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function adminLogout(): Promise<void> {
  try {
    await requestJson('/api/admin/auth/logout', { method: 'POST' });
  } catch {
    // ignore if already logged out
  }
}

export async function adminChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await requestJson('/api/admin/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchAdminBootstrap(): Promise<{
  user: { id: string; email: string; name: string; role: string } | null;
  database: string;
  siteConfig: SiteConfig;
  works: WorkItem[];
  inquiries: ContactInquiry[];
}> {
  return requestJson('/api/admin/portfolio/bootstrap', { method: 'GET' });
}

export async function saveAdminSiteConfig(config: SiteConfig): Promise<SiteConfig> {
  return requestJson('/api/admin/portfolio/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function createAdminWork(input: {
  categoryId: WorkCategoryId;
  title: string;
  workUrl?: string;
  thumbnailUrl: string;
  caption?: string;
  status?: 'published' | 'draft';
  tags?: string[];
}): Promise<{ item: WorkItem; items: WorkItem[] }> {
  return requestJson('/api/admin/portfolio/works', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminWork(
  id: string,
  input: {
    categoryId?: WorkCategoryId;
    title?: string;
    workUrl?: string | null;
    thumbnailUrl?: string;
    caption?: string;
    status?: 'published' | 'draft';
    tags?: string[];
  }
): Promise<{ item: WorkItem; items: WorkItem[] }> {
  return requestJson(`/api/admin/portfolio/works/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminWork(id: string): Promise<{ items: WorkItem[] }> {
  return requestJson(`/api/admin/portfolio/works/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function resetAdminDemoWorks(): Promise<{ items: WorkItem[] }> {
  return requestJson('/api/admin/portfolio/works/reset', {
    method: 'POST',
  });
}

export async function updateAdminInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<{ item: ContactInquiry; items: ContactInquiry[] }> {
  return requestJson(`/api/admin/portfolio/inquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminInquiry(id: string): Promise<{ items: ContactInquiry[] }> {
  return requestJson(`/api/admin/portfolio/inquiries/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadAdminFile(
  file: File,
  kind: 'image' | 'pdf'
): Promise<{ id: string; url: string; fileName: string; size: number; mimeType: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  return requestJson('/api/admin/portfolio/upload', {
    method: 'POST',
    body: form,
  });
}

export async function clearAdminResume(): Promise<SiteConfig> {
  return requestJson('/api/admin/portfolio/resume', {
    method: 'DELETE',
  });
}
