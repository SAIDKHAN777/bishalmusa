import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  WORK_CATEGORIES,
  saveWorkItems,
  type WorkCategoryId,
  type WorkItem,
} from '../data/workStore';
import {
  DEFAULT_SITE_CONFIG,
  saveSiteConfig,
  type SiteConfig,
  type SocialLink,
} from '../data/siteStore';
import {
  clearResumePdfFile,
  formatBytes,
  loadResumePdfFile,
  type StoredResumePdf,
} from '../data/resumePdfStore';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { saveInquiries, type ContactInquiry, type InquiryStatus } from '../data/inquiryStore';
import {
  adminChangePassword,
  adminLogin,
  adminLogout,
  checkAdminSession,
  clearAdminResume,
  createAdminWork,
  deleteAdminInquiry,
  deleteAdminWork,
  fetchAdminBootstrap,
  resetAdminDemoWorks,
  saveAdminSiteConfig,
  updateAdminInquiryStatus,
  updateAdminWork,
  uploadAdminFile,
} from '../lib/api';

interface AdminWorkPageProps {
  initialCategory?: WorkCategoryId;
  items: WorkItem[];
  siteConfig: SiteConfig;
  inquiries: ContactInquiry[];
  onItemsChange: (items: WorkItem[]) => void;
  onSiteConfigChange: (config: SiteConfig) => void;
  onInquiriesChange: (inquiries: ContactInquiry[]) => void;
  onBackHome: () => void;
  onOpenCategory: (id: WorkCategoryId) => void;
}

type AdminTab =
  'dashboard' | 'hero-about' | 'works-studio' | 'resume' | 'contact-inquiries' | 'security';

const ADMIN_AUTH_KEY = 'bishal_admin_unlocked_v1';

const inputClass =
  'w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black';
const labelClass = 'block text-[11px] uppercase tracking-wider font-semibold text-black/65 mb-1.5';

function getErrMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AdminWorkPage({
  initialCategory,
  items,
  siteConfig,
  inquiries,
  onItemsChange,
  onSiteConfigChange,
  onInquiriesChange,
  onBackHome,
  onOpenCategory,
}: AdminWorkPageProps) {
  // Real PostgreSQL Session Auth State
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState<boolean>(false);
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);

  // Active Navigation Tab & Works Studio Sidebar Dropdown
  const [activeTab, setActiveTab] = useState<AdminTab>(
    initialCategory ? 'works-studio' : 'dashboard'
  );
  const [worksMenuOpen, setWorksMenuOpen] = useState<boolean>(Boolean(initialCategory));
  /** null = Works Studio (Selected Works copy & 4 category descriptions); WorkCategoryId = Dedicated track uploader */
  const [activeWorkTrack, setActiveWorkTrack] = useState<WorkCategoryId | null>(
    initialCategory ?? null
  );
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Works Studio Track Upload / Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<WorkCategoryId>(initialCategory ?? 'video-editing');
  const [title, setTitle] = useState('');
  const [workUrl, setWorkUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Contact Inquiries Filter
  const [inquiryFilter, setInquiryFilter] = useState<'all' | InquiryStatus>('all');
  const [showContactSettings, setShowContactSettings] = useState(false);

  // Editable Draft of SiteConfig & Uploaded Resume PDF (IndexedDB)
  const [draft, setDraft] = useState<SiteConfig>(siteConfig);
  const [storedResumePdf, setStoredResumePdf] = useState<StoredResumePdf | null>(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string>('/resume-default.pdf');
  const resumePdfInputRef = useRef<HTMLInputElement | null>(null);

  const callbacksRef = useRef({ onSiteConfigChange, onItemsChange, onInquiriesChange });
  callbacksRef.current = { onSiteConfigChange, onItemsChange, onInquiriesChange };

  // Bootstrap live PostgreSQL data into Admin Console
  const hydrateFromDatabase = useCallback(async () => {
    const boot = await fetchAdminBootstrap();
    setDbConnected(boot.database === 'connected');
    setDraft(boot.siteConfig);
    callbacksRef.current.onSiteConfigChange(boot.siteConfig);
    callbacksRef.current.onItemsChange(boot.works);
    callbacksRef.current.onInquiriesChange(boot.inquiries);
    saveSiteConfig(boot.siteConfig);
    saveWorkItems(boot.works);
    saveInquiries(boot.inquiries);
  }, []);

  // Verify existing HttpOnly PostgreSQL session on mount
  useEffect(() => {
    let cancelled = false;
    checkAdminSession()
      .then(async (res) => {
        if (cancelled) return;
        if (res.authenticated) {
          setUnlocked(true);
          try {
            await hydrateFromDatabase();
          } catch {
            // keep warm state if bootstrap fails
          }
        } else {
          setUnlocked(false);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrateFromDatabase]);

  useEffect(() => {
    let objUrl: string | null = null;
    let cancelled = false;

    const loadPdf = async () => {
      // Prefer PostgreSQL/server-hosted Resume PDF URL first
      if (draft.resume.externalPdfUrl?.trim()) {
        setStoredResumePdf(null);
        setResumePreviewUrl(draft.resume.externalPdfUrl.trim());
        return;
      }
      const rec = await loadResumePdfFile();
      if (cancelled) return;
      setStoredResumePdf(rec);
      if (rec) {
        objUrl = URL.createObjectURL(rec.blob);
        setResumePreviewUrl(objUrl);
      } else {
        setResumePreviewUrl('/resume-default.pdf');
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [draft.resume.externalPdfUrl, storedResumePdf?.updatedAt]);

  // Security & Backup State
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setAuthError('Please enter your admin password.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      await adminLogin(passwordInput);
      try {
        window.sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      } catch {
        // ignore
      }
      setUnlocked(true);
      setPasswordInput('');
      await hydrateFromDatabase();
    } catch (err: unknown) {
      setAuthError(
        getErrMessage(err, 'Incorrect password. Please try again.').replace(
          /^INVALID_CREDENTIALS:\s*/i,
          ''
        )
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLock = async () => {
    await adminLogout();
    try {
      window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {
      // ignore
    }
    setUnlocked(false);
    setDbConnected(false);
    setPasswordInput('');
    setAuthError(null);
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-black">
        <p className="text-xs uppercase tracking-[0.2em] text-black/55">
          Connecting to database...
        </p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-screen items-center justify-center bg-white px-4 py-16 text-black"
      >
        <div className="w-full max-w-md rounded-2xl border border-black/15 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#141517] text-sm font-semibold text-white">
              {siteConfig.hero.displayName.charAt(0).toUpperCase() || 'B'}
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-black">
                {siteConfig.hero.displayName} Portfolio
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">● Protected Admin Console</p>
            </div>
          </div>

          <h1 className="font-accent mb-1.5 text-4xl font-normal text-black">
            Admin <span className="text-coralRed">Access</span>
          </h1>
          <p className="mb-6 text-sm font-light text-black/65">
            Enter your admin password to manage works, hero/about content, and client inquiries.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter admin password"
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs uppercase tracking-wider text-black/50 hover:text-black"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {authError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full cursor-pointer rounded-xl bg-[#141517] py-3 text-xs font-medium uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {authSubmitting ? 'Verifying...' : 'Unlock Admin Console'}
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="w-full cursor-pointer rounded-xl border border-black/15 py-2.5 text-xs uppercase tracking-wider text-black/65 transition-colors hover:text-black"
            >
              ← Back to Portfolio
            </button>
          </form>
        </div>
      </motion.div>
    );
  }

  // --- Computed Stats ---
  const publishedCount = items.filter((i) => i.status !== 'draft').length;
  const unreadInquiriesCount = inquiries.filter((inq) => inq.status === 'new').length;
  const firstName = draft.hero.displayName.split(' ')[0] || 'Bishal';

  // --- Works Handlers ---
  const resetWorkForm = () => {
    setEditingId(null);
    setTitle('');
    setWorkUrl('');
    setThumbnailUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const uploaded = await uploadAdminFile(file, 'image');
      setThumbnailUrl(uploaded.url);
      flash('ok', 'Image uploaded & saved to server storage.');
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Could not upload image. Please try PNG, JPG, or WebP.'));
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const isPhotoOnly = categoryId === 'digital-marketing';
    let normalizedUrl = workUrl.trim();
    const trimmedThumb = thumbnailUrl.trim();

    if (!trimmedTitle) return flash('err', 'Please enter a title.');
    if (!trimmedThumb) {
      return flash(
        'err',
        isPhotoOnly
          ? 'Please upload a photo from your computer.'
          : 'Please upload a thumbnail image from your computer.'
      );
    }
    if (!isPhotoOnly) {
      if (!normalizedUrl) return flash('err', 'Please enter the direct video/project link.');
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
    }

    const payload = {
      categoryId,
      title: trimmedTitle,
      thumbnailUrl: trimmedThumb,
      workUrl: isPhotoOnly ? undefined : normalizedUrl,
      status: 'published' as const,
    };

    try {
      if (editingId) {
        const res = await updateAdminWork(editingId, payload);
        saveWorkItems(res.items);
        onItemsChange(res.items);
        resetWorkForm();
        flash('ok', `Updated "${trimmedTitle}" in PostgreSQL!`);
      } else {
        const res = await createAdminWork(payload);
        saveWorkItems(res.items);
        onItemsChange(res.items);
        resetWorkForm();
        const catName = draft.worksIntro.categories[categoryId]?.title ?? categoryId;
        flash('ok', `Published "${trimmedTitle}" to ${catName}!`);
      }
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to save work to database.'));
    }
  };

  const startEditingWork = (item: WorkItem) => {
    setActiveTab('works-studio');
    setWorksMenuOpen(true);
    setActiveWorkTrack(item.categoryId);
    setEditingId(item.id);
    setCategoryId(item.categoryId);
    setTitle(item.title);
    setWorkUrl(item.workUrl ?? '');
    setThumbnailUrl(item.thumbnailUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteWork = async (id: string) => {
    try {
      const res = await deleteAdminWork(id);
      saveWorkItems(res.items);
      onItemsChange(res.items);
      if (editingId === id) resetWorkForm();
      flash('ok', 'Work item deleted from database.');
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to delete work item.'));
    }
  };

  // --- Site Config Save (PostgreSQL SiteSetting) ---
  const commitSiteConfig = async (
    nextConfig: SiteConfig,
    label = 'Changes saved to PostgreSQL & live on portfolio!'
  ) => {
    setDraft(nextConfig);
    try {
      const saved = await saveAdminSiteConfig(nextConfig);
      setDraft(saved);
      saveSiteConfig(saved);
      onSiteConfigChange(saved);
      flash('ok', label);
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to save settings to database.'));
    }
  };

  // --- Resume PDF Upload (Persisted on Backend Server + PostgreSQL Media & SiteSetting) ---
  const handleResumePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return flash('err', 'Please select a valid PDF (.pdf) file.');
    }
    if (file.size > 25 * 1024 * 1024) {
      return flash('err', 'PDF exceeds 25 MB. Please compress it first.');
    }
    setUploadingResume(true);
    try {
      const uploaded = await uploadAdminFile(file, 'pdf');
      const nextConfig: SiteConfig = {
        ...draft,
        resume: {
          ...draft.resume,
          pdfFileName: uploaded.fileName,
          externalPdfUrl: uploaded.url,
        },
      };
      setDraft(nextConfig);
      saveSiteConfig(nextConfig);
      onSiteConfigChange(nextConfig);
      await clearResumePdfFile().catch(() => {});
      setStoredResumePdf(null);
      setResumePreviewUrl(uploaded.url);
      window.dispatchEvent(new CustomEvent('portfolio-resume-updated'));
      if (resumePdfInputRef.current) resumePdfInputRef.current.value = '';
      flash('ok', `Resume PDF "${file.name}" saved to server & live on portfolio!`);
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to upload PDF file.'));
    } finally {
      setUploadingResume(false);
    }
  };

  const handleRemoveResumePdf = async () => {
    try {
      const updated = await clearAdminResume();
      await clearResumePdfFile().catch(() => {});
      setStoredResumePdf(null);
      setDraft(updated);
      saveSiteConfig(updated);
      onSiteConfigChange(updated);
      setResumePreviewUrl('/resume-default.pdf');
      window.dispatchEvent(new CustomEvent('portfolio-resume-updated'));
      flash('ok', 'Custom Resume PDF removed (reverted to default starter PDF).');
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to remove Resume PDF.'));
    }
  };

  // --- Social Links Helpers ---
  const updateSocialLink = (index: number, patch: Partial<SocialLink>) => {
    const nextLinks = draft.contact.socialLinks.map((link, i) =>
      i === index ? { ...link, ...patch } : link
    );
    setDraft({ ...draft, contact: { ...draft.contact, socialLinks: nextLinks } });
  };

  const addSocialLink = () => {
    setDraft({
      ...draft,
      contact: {
        ...draft.contact,
        socialLinks: [
          ...draft.contact.socialLinks,
          {
            id: `soc_${Date.now()}`,
            label: 'YouTube',
            href: 'https://youtube.com/',
            external: true,
          },
        ],
      },
    });
  };

  const removeSocialLink = (index: number) => {
    setDraft({
      ...draft,
      contact: {
        ...draft.contact,
        socialLinks: draft.contact.socialLinks.filter((_, i) => i !== index),
      },
    });
  };

  // --- Inquiry Actions (PostgreSQL ContactMessage) ---
  const handleInquiryStatus = async (id: string, status: InquiryStatus) => {
    try {
      const res = await updateAdminInquiryStatus(id, status);
      saveInquiries(res.items);
      onInquiriesChange(res.items);
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to update inquiry status.'));
    }
  };

  const handleInquiryDelete = async (id: string) => {
    try {
      const res = await deleteAdminInquiry(id);
      saveInquiries(res.items);
      onInquiriesChange(res.items);
      flash('ok', 'Inquiry removed from database.');
    } catch (err: unknown) {
      flash('err', getErrMessage(err, 'Failed to delete inquiry.'));
    }
  };

  // --- Password & Backup ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassInput.trim()) {
      return flash('err', 'Please enter your current password.');
    }
    if (newPassInput.trim().length < 4) {
      return flash('err', 'New password must be at least 4 characters.');
    }
    if (newPassInput !== confirmPassInput) {
      return flash('err', 'New password and confirmation do not match.');
    }
    try {
      await adminChangePassword(currentPassInput, newPassInput);
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      flash('ok', 'Admin password updated in PostgreSQL!');
    } catch (err: unknown) {
      flash(
        'err',
        getErrMessage(err, 'Failed to update password.').replace(/^INVALID_CREDENTIALS:\s*/i, '')
      );
    }
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      siteConfig: draft,
      workItems: items,
      inquiries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bishal-musa-portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('ok', 'Full backup (works, content & inquiries) downloaded!');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (Array.isArray(parsed.workItems)) {
        saveWorkItems(parsed.workItems);
        onItemsChange(parsed.workItems);
      }
      if (Array.isArray(parsed.inquiries)) {
        saveInquiries(parsed.inquiries);
        onInquiriesChange(parsed.inquiries);
      }
      if (parsed.siteConfig && typeof parsed.siteConfig === 'object') {
        commitSiteConfig({ ...draft, ...parsed.siteConfig }, 'Full backup restored!');
      } else {
        flash('ok', 'Backup restored!');
      }
    } catch {
      flash('err', 'Invalid backup JSON file.');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const visibleWorks = items.filter((item) => {
    const matchesCat = !activeWorkTrack || item.categoryId === activeWorkTrack;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.caption ?? '').toLowerCase().includes(q) ||
      (item.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
      (item.workUrl ?? '').toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const visibleInquiries =
    inquiryFilter === 'all' ? inquiries : inquiries.filter((inq) => inq.status === inquiryFilter);

  const navItems: {
    id: AdminTab;
    label: string;
    badge?: number;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1v-9.5Z"
          />
        </svg>
      ),
    },
    {
      id: 'hero-about',
      label: 'Hero & About',
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-7.5 9a7.5 7.5 0 0 1 15 0"
          />
        </svg>
      ),
    },
    {
      id: 'works-studio',
      label: 'Works Studio',
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 7.5A2.25 2.25 0 0 1 6 5.25h12a2.25 2.25 0 0 1 2.25 2.25v9A2.25 2.25 0 0 1 18 18.75H6a2.25 2.25 0 0 1-2.25-2.25v-9Zm5.25 1.5 6 3-6 3v-6Z"
          />
        </svg>
      ),
    },
    {
      id: 'resume',
      label: 'Resume',
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      ),
    },
    {
      id: 'contact-inquiries',
      label: 'Contact Inquiries',
      badge: unreadInquiriesCount > 0 ? unreadInquiriesCount : undefined,
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5v10.5H3.75V6.75Zm0 0L12 12.75l8.25-6"
          />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Settings & Security',
      icon: (
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.7}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V7.875a4.5 4.5 0 1 0-9 0V10.5m-1.875 0h12.75A1.125 1.125 0 0 1 19.5 11.625v8.25A1.125 1.125 0 0 1 18.375 21H5.625A1.125 1.125 0 0 1 4.5 19.875v-8.25A1.125 1.125 0 0 1 5.625 10.5Z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white text-black lg:flex-row">
      {/* FIXED DARK LEFT SIDEBAR (Matching Reference Screenshot) */}
      <aside className="z-30 flex w-full flex-col justify-between border-b border-white/10 bg-[#141517] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div>
          {/* Brand Monogram Header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#141517]">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{firstName} Portfolio</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
                {dbConnected ? 'Database Connected' : 'Admin CMS Active'}
              </p>
            </div>
          </div>

          {/* Sidebar Navigation Links */}
          <nav
            aria-label="Admin navigation"
            className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible"
          >
            {navItems.map((nav) => {
              const active = activeTab === nav.id;
              const isWorksStudio = nav.id === 'works-studio';

              if (isWorksStudio) {
                const isParentActive = active && activeWorkTrack === null;
                return (
                  <div key={nav.id} className="flex shrink-0 flex-col">
                    <div
                      className={`flex items-center justify-between rounded-xl transition-colors ${
                        isParentActive
                          ? 'shadow-xs bg-white text-[#141517]'
                          : active
                            ? 'bg-white/12 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('works-studio');
                          setActiveWorkTrack(null);
                          setEditingId(null);
                        }}
                        className="flex flex-1 cursor-pointer items-center gap-2.5 py-2.5 pl-3.5 text-left text-xs font-medium"
                      >
                        {nav.icon}
                        <span>{nav.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorksMenuOpen((open) => !open)}
                        aria-label="Toggle Works Studio categories"
                        aria-expanded={worksMenuOpen}
                        className={`flex cursor-pointer items-center justify-center rounded-r-xl px-3 py-2.5 transition-colors ${
                          isParentActive ? 'hover:bg-black/5' : 'hover:bg-white/10'
                        }`}
                      >
                        <svg
                          aria-hidden="true"
                          className={`size-3.5 transition-transform duration-200 ${
                            worksMenuOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    {/* 4-Category Dropdown Sub-menu (Dedicated Uploaders) */}
                    {worksMenuOpen && (
                      <div className="border-white/12 ml-4 mt-1 flex flex-col gap-0.5 border-l py-1 pl-3">
                        {WORK_CATEGORIES.map((cat) => {
                          const catCount = items.filter((i) => i.categoryId === cat.id).length;
                          const isCatSelected =
                            activeTab === 'works-studio' && activeWorkTrack === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('works-studio');
                                setActiveWorkTrack(cat.id);
                                setCategoryId(cat.id);
                                setSearchQuery('');
                                resetWorkForm();
                              }}
                              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors ${
                                isCatSelected
                                  ? 'shadow-xs bg-white font-semibold text-[#141517]'
                                  : 'hover:bg-white/8 text-white/60 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{cat.title}</span>
                              <span className="text-[10px] tabular-nums opacity-65">
                                {catCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`flex shrink-0 cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    active
                      ? 'shadow-xs bg-white text-[#141517]'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {nav.icon}
                    <span>{nav.label}</span>
                  </span>
                  {nav.badge !== undefined && (
                    <span className="bg-coralRed rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                      {nav.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Utilities */}
        <div className="hidden flex-col gap-2 border-t border-white/10 p-4 lg:flex">
          <button
            type="button"
            onClick={onBackHome}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/15 px-3.5 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span>Live Preview</span>
            <span>↗</span>
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="w-full cursor-pointer rounded-xl px-3.5 py-2 text-left text-xs text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
          >
            Lock / Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONSOLE WORKSPACE */}
      <div className="min-w-0 flex-1 lg:pl-64">
        <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-8 sm:py-10">
          {/* Mobile Quick Actions */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={onBackHome}
              className="cursor-pointer rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black"
            >
              ← Preview Site
            </button>
            <button
              type="button"
              onClick={handleLock}
              className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700"
            >
              Lock / Logout
            </button>
          </div>

          {/* Live Toast Banner */}
          {toast && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
                toast.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="cursor-pointer text-[11px] uppercase opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 1: DASHBOARD                                      */}
          {/* ===================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-7">
              {/* Open Welcome Header (No Box, Black Text, Clean Preview Work Link) */}
              <div className="flex flex-col gap-4 bg-white pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                    Welcome back, {firstName}
                  </h1>
                  <p className="mt-1 text-xs text-black/60 sm:text-sm">
                    Everything on the public portfolio is driven dynamically from this console.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onBackHome}
                  className="w-fit shrink-0 cursor-pointer bg-white text-sm font-medium text-black transition-opacity hover:opacity-70"
                >
                  Preview Work
                </button>
              </div>

              {/* 4 KPI Stat Cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl bg-[#18191c] p-5 text-white sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Total Works
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{items.length}</p>
                  <p className="mt-1.5 text-xs text-white/45">Showcase items in studio</p>
                </div>

                <div className="rounded-2xl bg-[#18191c] p-5 text-white sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Published Works
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{publishedCount}</p>
                  <p className="mt-1.5 text-xs text-white/45">
                    Active across site &amp; categories
                  </p>
                </div>

                <div className="rounded-2xl bg-[#18191c] p-5 text-white sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Active Categories
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{WORK_CATEGORIES.length}</p>
                  <p className="mt-1.5 text-xs text-white/45">Fixed core creative tracks</p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('contact-inquiries')}
                  className="cursor-pointer rounded-2xl bg-[#18191c] p-5 text-left text-white transition-colors hover:bg-[#1f2126] sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                      Contact Inquiries
                    </p>
                    {unreadInquiriesCount > 0 && (
                      <span className="bg-coralRed rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                        {unreadInquiriesCount} new
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{inquiries.length}</p>
                  <p className="mt-1.5 text-xs text-white/45">Client requirements received</p>
                </button>
              </div>

              {/* 3 Quick-Action Shortcut Cards (Clean Typography Only — No Icons/Emojis) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('hero-about')}
                  className="cursor-pointer rounded-2xl bg-[#18191c] p-6 text-left text-white transition-colors hover:bg-[#202227]"
                >
                  <h2 className="text-sm font-semibold">Hero &amp; About Settings</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                    Edit greeting, display name, About bio sections, and inline quick notes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('works-studio')}
                  className="cursor-pointer rounded-2xl bg-[#18191c] p-6 text-left text-white transition-colors hover:bg-[#202227]"
                >
                  <h2 className="text-sm font-semibold">Works Studio</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                    Upload thumbnails, set direct video/work links, and edit across 4 tracks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('contact-inquiries')}
                  className="cursor-pointer rounded-2xl bg-[#18191c] p-6 text-left text-white transition-colors hover:bg-[#202227]"
                >
                  <h2 className="text-sm font-semibold">Contact Inquiries</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                    Review client requirements submitted from the Contact form &amp; reply.
                  </p>
                </button>
              </div>

              {/* Recent Client Inquiries Preview */}
              {inquiries.length > 0 && (
                <div className="rounded-2xl border border-black/10 bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-black">
                        Latest Client Requirements
                      </h2>
                      <p className="mt-0.5 text-xs text-black/55">
                        Recent submissions from your Contact form.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('contact-inquiries')}
                      className="text-coralRed cursor-pointer text-xs font-medium hover:underline"
                    >
                      Open Inquiries Inbox →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {inquiries.slice(0, 2).map((inq) => (
                      <div
                        key={inq.id}
                        className="flex flex-col justify-between gap-2 rounded-xl border border-black/10 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-black">{inq.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              inq.status === 'new'
                                ? 'bg-coralRed/15 text-coralRed'
                                : 'bg-black/8 text-black/60'
                            }`}
                          >
                            {inq.status}
                          </span>
                        </div>
                        <p className="text-xs text-black/55">
                          {inq.service} {inq.budget ? `· ${inq.budget}` : ''}
                        </p>
                        <p className="line-clamp-2 text-xs leading-relaxed text-black/80">
                          {inq.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 2: HERO & ABOUT (Hero + Dynamic About Bio + Inline Quick Notes) */}
          {/* ===================================================== */}
          {activeTab === 'hero-about' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitSiteConfig(draft, 'Hero & About updated live on portfolio!');
              }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                    Content Management
                  </p>
                  <h1 className="text-2xl font-semibold text-black sm:text-3xl">
                    Hero &amp; About Settings
                  </h1>
                  <p className="mt-1 text-xs text-black/60 sm:text-sm">
                    Update Hero greeting, name, intro text, and About bio sections with optional
                    inline quick notes.
                  </p>
                </div>
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90"
                >
                  Save All Changes
                </button>
              </div>

              {/* 01. Hero Section — Clean 3 Fields Only */}
              <div className="border-black/12 space-y-5 rounded-2xl border bg-white p-6">
                <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                  01. Hero Section
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="hero-greeting" className={labelClass}>
                      Small Greeting (Above Name)
                    </label>
                    <input
                      id="hero-greeting"
                      type="text"
                      value={draft.hero.greetingLine}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          hero: { ...draft.hero, greetingLine: e.target.value },
                        })
                      }
                      placeholder="Hello, I'm"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="hero-name" className={labelClass}>
                      Main Name Headline
                    </label>
                    <input
                      id="hero-name"
                      type="text"
                      value={draft.hero.displayName}
                      onChange={(e) =>
                        setDraft({ ...draft, hero: { ...draft.hero, displayName: e.target.value } })
                      }
                      placeholder="Bishal Musa"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="hero-intro-text" className={labelClass}>
                    Hero Bio / Intro Text
                  </label>
                  <textarea
                    id="hero-intro-text"
                    rows={3}
                    value={draft.hero.introText}
                    onChange={(e) =>
                      setDraft({ ...draft, hero: { ...draft.hero, introText: e.target.value } })
                    }
                    placeholder="Write your intro here — it will automatically adjust in the Hero font."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 02. About Bio Sections (Each with optional inline + Add Quick Note) */}
              <div className="border-black/12 space-y-5 rounded-2xl border bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                      02. About Bio Sections
                    </h2>
                    <p className="mt-1 text-xs text-black/55">
                      Each bio block has a Title, a small Sub-headline, a Content Box, and an
                      optional Quick Note / Quote inside it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        about: {
                          ...draft.about,
                          sections: [
                            ...draft.about.sections,
                            {
                              id: `bio_${Date.now()}`,
                              title: '',
                              subLabel: 'by passion',
                              body: '',
                              quickNotes: [],
                            },
                          ],
                        },
                      })
                    }
                    className="cursor-pointer rounded-xl border border-black/20 px-3.5 py-2 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
                  >
                    + Add Bio Section
                  </button>
                </div>

                <div className="space-y-4">
                  {draft.about.sections.map((section, idx) => {
                    const notes = section.quickNotes ?? [];
                    return (
                      <div
                        key={section.id}
                        className="space-y-4 rounded-xl border border-black/10 bg-[#fafafa] p-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-black/50">
                            Bio Section 0{idx + 1}
                          </span>
                          {draft.about.sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  about: {
                                    ...draft.about,
                                    sections: draft.about.sections.filter((_, i) => i !== idx),
                                  },
                                })
                              }
                              className="cursor-pointer text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>Title (Headline)</label>
                            <textarea
                              rows={2}
                              value={section.title}
                              onChange={(e) => {
                                const next = draft.about.sections.map((s, i) =>
                                  i === idx ? { ...s, title: e.target.value } : s
                                );
                                setDraft({ ...draft, about: { ...draft.about, sections: next } });
                              }}
                              placeholder="e.g. Designer, Developer"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              Small Sub-headline (Last word highlights in coral)
                            </label>
                            <input
                              type="text"
                              value={section.subLabel}
                              onChange={(e) => {
                                const next = draft.about.sections.map((s, i) =>
                                  i === idx ? { ...s, subLabel: e.target.value } : s
                                );
                                setDraft({ ...draft, about: { ...draft.about, sections: next } });
                              }}
                              placeholder="e.g. by profession"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>Content Box</label>
                          <textarea
                            rows={5}
                            value={section.body}
                            onChange={(e) => {
                              const next = draft.about.sections.map((s, i) =>
                                i === idx ? { ...s, body: e.target.value } : s
                              );
                              setDraft({ ...draft, about: { ...draft.about, sections: next } });
                            }}
                            placeholder="Write freely about your work, journey, or life..."
                            className={inputClass}
                          />
                        </div>

                        {/* Inline Quick Notes inside THIS Bio Section */}
                        <div className="border-black/8 space-y-3 border-t pt-3">
                          {notes.map((note, nIdx) => (
                            <div
                              key={note.id}
                              className="space-y-2.5 rounded-r-xl border-l-2 border-black/25 bg-white p-3.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-coralRed text-[10px] font-semibold uppercase tracking-wider">
                                  Quick Note 0{nIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextSections = draft.about.sections.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            quickNotes: notes.filter((_, ni) => ni !== nIdx),
                                          }
                                        : s
                                    );
                                    setDraft({
                                      ...draft,
                                      about: { ...draft.about, sections: nextSections },
                                    });
                                  }}
                                  className="cursor-pointer text-[11px] text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={note.text}
                                onChange={(e) => {
                                  const nextNotes = notes.map((n, ni) =>
                                    ni === nIdx ? { ...n, text: e.target.value } : n
                                  );
                                  const nextSections = draft.about.sections.map((s, i) =>
                                    i === idx ? { ...s, quickNotes: nextNotes } : s
                                  );
                                  setDraft({
                                    ...draft,
                                    about: { ...draft.about, sections: nextSections },
                                  });
                                }}
                                placeholder="Write a short quote, shayari, or personal note..."
                                className={inputClass}
                              />
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <input
                                  type="text"
                                  value={note.subtext ?? ''}
                                  onChange={(e) => {
                                    const nextNotes = notes.map((n, ni) =>
                                      ni === nIdx ? { ...n, subtext: e.target.value } : n
                                    );
                                    const nextSections = draft.about.sections.map((s, i) =>
                                      i === idx ? { ...s, quickNotes: nextNotes } : s
                                    );
                                    setDraft({
                                      ...draft,
                                      about: { ...draft.about, sections: nextSections },
                                    });
                                  }}
                                  placeholder="Optional translation / subtitle"
                                  className={inputClass}
                                />
                                <input
                                  type="text"
                                  value={note.author ?? ''}
                                  onChange={(e) => {
                                    const nextNotes = notes.map((n, ni) =>
                                      ni === nIdx ? { ...n, author: e.target.value } : n
                                    );
                                    const nextSections = draft.about.sections.map((s, i) =>
                                      i === idx ? { ...s, quickNotes: nextNotes } : s
                                    );
                                    setDraft({
                                      ...draft,
                                      about: { ...draft.about, sections: nextSections },
                                    });
                                  }}
                                  placeholder="Author name (shown as — Author)"
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const nextSections = draft.about.sections.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      quickNotes: [
                                        ...notes,
                                        { id: `note_${Date.now()}`, text: '', author: '' },
                                      ],
                                    }
                                  : s
                              );
                              setDraft({
                                ...draft,
                                about: { ...draft.about, sections: nextSections },
                              });
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-black/65 transition-colors hover:text-black"
                          >
                            + Add Quick Note
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-[#141517] px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90"
                  >
                    Save Hero &amp; About
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ===================================================== */}
          {/* TAB: DEDICATED RESUME PDF FILE UPLOAD & LIVE VIEWER   */}
          {/* ===================================================== */}
          {activeTab === 'resume' && (
            <div className="space-y-6">
              <div>
                <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  Resume File
                </p>
                <h1 className="text-2xl font-semibold text-black sm:text-3xl">Resume PDF Upload</h1>
                <p className="mt-1 text-xs text-black/60 sm:text-sm">
                  Upload your Resume PDF file here. When visitors click RESUME on your portfolio,
                  this exact full PDF opens directly inside the page.
                </p>
              </div>

              {/* Clean PDF Upload Card */}
              <div className="border-black/12 space-y-5 rounded-2xl border bg-white p-6">
                <label
                  htmlFor="resume-pdf-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/20 bg-[#fafafa] px-6 py-10 text-center transition-colors hover:border-black/50"
                >
                  <span className="text-sm font-semibold text-black">
                    Click to upload your Resume PDF
                  </span>
                  <span className="mt-1 text-xs text-black/55">
                    PDF format (.pdf) · Supports up to 25 MB
                  </span>
                  <span className="mt-4 inline-flex rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">
                    {uploadingResume
                      ? 'Uploading PDF...'
                      : storedResumePdf || draft.resume.externalPdfUrl?.trim()
                        ? 'Replace PDF File'
                        : 'Choose PDF File'}
                  </span>
                  <input
                    ref={resumePdfInputRef}
                    id="resume-pdf-upload"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleResumePdfUpload}
                    className="hidden"
                  />
                </label>

                {/* Active File Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-black/45">
                      Currently Active File
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-black">
                      {storedResumePdf
                        ? `${storedResumePdf.fileName} (${formatBytes(storedResumePdf.sizeBytes)})`
                        : draft.resume.externalPdfUrl?.trim()
                          ? draft.resume.pdfFileName?.trim() || draft.resume.externalPdfUrl.trim()
                          : 'Bishal-Musa-Resume.pdf (Starter PDF)'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={resumePreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-black/5"
                    >
                      Open PDF ↗
                    </a>
                    {(storedResumePdf || draft.resume.externalPdfUrl?.trim()) && (
                      <button
                        type="button"
                        onClick={handleRemoveResumePdf}
                        className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remove File
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Full Embedded PDF Preview (Pure White Background) */}
                <div className="space-y-2">
                  <p className={labelClass}>Live Full PDF Preview (Exactly what visitors see)</p>
                  <div className="max-h-[680px] w-full overflow-y-auto rounded-xl border border-black/15 bg-white">
                    <PdfCanvasViewer pdfUrl={resumePreviewUrl} scale={1.15} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 3: WORKS STUDIO                                   */}
          {/* - activeWorkTrack === null -> Selected Works & 4 Track Descriptions */}
          {/* - activeWorkTrack !== null -> Dedicated Track Uploader & Manager   */}
          {/* ===================================================== */}
          {activeTab === 'works-studio' && activeWorkTrack === null && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitSiteConfig(
                  draft,
                  'Selected Works & all 4 category descriptions updated live!'
                );
              }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                    Selected Works Copy
                  </p>
                  <h1 className="text-2xl font-semibold text-black sm:text-3xl">Works Studio</h1>
                  <p className="mt-1 text-xs text-black/60 sm:text-sm">
                    Update your Selected Works headline, intro copy, and descriptions for all 4
                    tracks. To upload videos or thumbnails, select a category from the sidebar
                    dropdown.
                  </p>
                </div>
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90"
                >
                  Save Changes
                </button>
              </div>

              {/* 01. Selected Works Headline & About Your Works Intro */}
              <div className="border-black/12 space-y-5 rounded-2xl border bg-white p-6">
                <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                  01. Selected Works — Headline &amp; Intro
                </h2>
                <div>
                  <label htmlFor="works-headline" className={labelClass}>
                    Section Headline (Last word highlights in coral)
                  </label>
                  <input
                    id="works-headline"
                    type="text"
                    value={draft.worksIntro.headline}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        worksIntro: { ...draft.worksIntro, headline: e.target.value },
                      })
                    }
                    placeholder="Selected works"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="works-intro-copy" className={labelClass}>
                    About Your Works (Left Column Intro — Leave a blank line for new paragraph)
                  </label>
                  <textarea
                    id="works-intro-copy"
                    rows={4}
                    value={draft.worksIntro.introText}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        worksIntro: { ...draft.worksIntro, introText: e.target.value },
                      })
                    }
                    placeholder="Write an overview about your work across your creative disciplines..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 02. Four Fixed Categories (Fixed Title + Editable Description) */}
              <div className="border-black/12 space-y-5 rounded-2xl border bg-white p-6">
                <div>
                  <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                    02. Four Creative Sections (Fixed Titles &amp; Descriptions)
                  </h2>
                  <p className="mt-1 text-xs text-black/55">
                    Update the description shown under each section on the homepage and category
                    page.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {WORK_CATEGORIES.map((cat) => {
                    const meta = draft.worksIntro.categories[cat.id];
                    const count = items.filter((i) => i.categoryId === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className="space-y-3.5 rounded-xl border border-black/10 bg-[#fafafa] p-5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-coralRed text-[11px] font-semibold uppercase tracking-wider">
                            {cat.number} Section
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setWorksMenuOpen(true);
                              setActiveWorkTrack(cat.id);
                              setCategoryId(cat.id);
                              resetWorkForm();
                            }}
                            className="cursor-pointer text-xs font-medium text-black/70 underline underline-offset-4 hover:text-black"
                          >
                            Upload Media ({count}) →
                          </button>
                        </div>

                        <div>
                          <label className={labelClass}>Title (Fixed)</label>
                          <input
                            type="text"
                            value={cat.title}
                            readOnly
                            className="w-full cursor-default rounded-xl border border-black/10 bg-black/[0.04] px-3.5 py-2.5 text-sm font-semibold text-black/80 outline-none"
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Description</label>
                          <textarea
                            rows={3}
                            value={meta.summary}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                worksIntro: {
                                  ...draft.worksIntro,
                                  categories: {
                                    ...draft.worksIntro.categories,
                                    [cat.id]: {
                                      ...meta,
                                      title: cat.title,
                                      summary: e.target.value,
                                    },
                                  },
                                },
                              })
                            }
                            placeholder={`Describe your ${cat.title} work...`}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-[#141517] px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90"
                  >
                    Save Selected Works
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* DEDICATED CATEGORY UPLOADER (Opened from Works Studio Dropdown!) */}
          {activeTab === 'works-studio' &&
            activeWorkTrack !== null &&
            (() => {
              const activeCat = WORK_CATEGORIES.find((c) => c.id === activeWorkTrack)!;
              const isVideoTrack =
                activeWorkTrack === 'video-editing' || activeWorkTrack === 'motion-graphics';
              const isPhotoOnlyTrack = activeWorkTrack === 'digital-marketing';

              return (
                <div className="space-y-7">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                        Works Studio · {activeCat.number}
                      </p>
                      <h1 className="text-2xl font-semibold text-black sm:text-3xl">
                        {activeCat.title}
                      </h1>
                      <p className="mt-1 text-xs text-black/60 sm:text-sm">
                        {isPhotoOnlyTrack ? (
                          <>
                            Add a title and upload photos for <strong>{activeCat.title}</strong>, or
                            edit existing items below.
                          </>
                        ) : (
                          <>
                            Upload thumbnails &amp; direct {isVideoTrack ? 'video' : 'project'}{' '}
                            links for <strong>{activeCat.title}</strong>, or edit existing items
                            below.
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWorkTrack(null);
                          resetWorkForm();
                        }}
                        className="cursor-pointer rounded-xl border border-black/15 bg-white px-3.5 py-2 text-xs font-medium text-black/75 hover:text-black"
                      >
                        ← Selected Works Texts
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCategory(activeWorkTrack)}
                        className="cursor-pointer rounded-xl border border-black/15 bg-white px-3.5 py-2 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
                      >
                        Preview {activeCat.title} ↗
                      </button>
                    </div>
                  </div>

                  {/* Clean Upload / Edit Form Dedicated to This Category */}
                  <form
                    onSubmit={handleWorkSubmit}
                    className="space-y-5 rounded-2xl border border-black/15 bg-white p-6 sm:p-7"
                  >
                    <div className="flex items-center justify-between border-b border-black/10 pb-3.5">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-black">
                        {editingId
                          ? `Update ${activeCat.title} Item`
                          : `Add New ${activeCat.title}`}
                      </h2>
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetWorkForm}
                          className="text-coralRed cursor-pointer text-xs font-medium hover:underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                      {/* Left: Title (+ Link unless Digital Marketing photo-only) */}
                      <div className="space-y-4 lg:col-span-7">
                        <div>
                          <label htmlFor="studio-title" className={labelClass}>
                            {isVideoTrack ? 'Video Title *' : 'Title *'}
                          </label>
                          <input
                            id="studio-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                              isPhotoOnlyTrack
                                ? 'e.g. Meta Ads Growth Campaign'
                                : isVideoTrack
                                  ? 'e.g. Commercial Reel 2026'
                                  : 'e.g. Brand Identity Showcase'
                            }
                            className={inputClass}
                          />
                        </div>

                        {!isPhotoOnlyTrack && (
                          <div>
                            <label htmlFor="studio-url" className={labelClass}>
                              {isVideoTrack
                                ? 'Video Link (YouTube, Facebook, Vimeo, etc.) *'
                                : 'Direct Link *'}
                            </label>
                            <input
                              id="studio-url"
                              type="text"
                              value={workUrl}
                              onChange={(e) => setWorkUrl(e.target.value)}
                              placeholder="https://youtube.com/... or https://facebook.com/..."
                              className={inputClass}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="submit"
                            className="cursor-pointer rounded-xl bg-[#141517] px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90"
                          >
                            {editingId ? 'Save Update' : `Publish to ${activeCat.title}`}
                          </button>
                          {editingId && (
                            <button
                              type="button"
                              onClick={resetWorkForm}
                              className="cursor-pointer rounded-xl border border-black/15 px-5 py-3 text-xs uppercase tracking-wider text-black/70 hover:text-black"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: Direct File-Manager Photo / Thumbnail Upload Box */}
                      <div className="lg:col-span-5">
                        <span className={labelClass}>
                          {isPhotoOnlyTrack
                            ? 'Upload Photo *'
                            : isVideoTrack
                              ? 'Upload Video Thumbnail *'
                              : 'Upload Thumbnail Image *'}
                        </span>
                        <label
                          htmlFor="studio-thumb"
                          className="group relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/20 bg-[#fafafa] text-center transition-colors hover:border-black/50"
                        >
                          {thumbnailUrl ? (
                            <>
                              <img
                                src={thumbnailUrl}
                                alt="Uploaded preview"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/45">
                                <span className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-black opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                  {isPhotoOnlyTrack ? 'Change Photo' : 'Change Thumbnail'}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="px-4 py-6">
                              <span className="mb-2 inline-flex rounded-lg bg-[#141517] px-4 py-2 text-xs font-semibold text-white">
                                {uploadingThumb
                                  ? 'Uploading...'
                                  : isPhotoOnlyTrack
                                    ? 'Upload Photo'
                                    : 'Upload Thumbnail'}
                              </span>
                              <p className="text-[11px] text-black/50">
                                Click to choose image from your computer
                              </p>
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            id="studio-thumb"
                            type="file"
                            accept="image/*"
                            onChange={handleThumbUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </form>

                  {/* Uploaded Items in THIS Category */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-black">
                        Uploaded in {activeCat.title} ({visibleWorks.length})
                      </h2>
                      <div className="flex items-center gap-3">
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Search ${activeCat.title}...`}
                          className="w-48 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs text-black outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await resetAdminDemoWorks();
                              saveWorkItems(res.items);
                              onItemsChange(res.items);
                              flash('ok', 'Demo works restored in PostgreSQL.');
                            } catch (err: unknown) {
                              flash('err', getErrMessage(err, 'Failed to restore demo works.'));
                            }
                          }}
                          className="hover:text-coralRed shrink-0 cursor-pointer text-xs text-black/50 underline"
                        >
                          Reset demo
                        </button>
                      </div>
                    </div>

                    {visibleWorks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/20 bg-white p-12 text-center text-sm text-black/55">
                        No items uploaded in {activeCat.title} yet. Use the form above to publish
                        one.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleWorks.map((item) => (
                          <div
                            key={item.id}
                            className={`flex flex-col items-start gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                              editingId === item.id
                                ? 'border-coralRed bg-coralRed/[0.03]'
                                : 'border-black/12 bg-white'
                            }`}
                          >
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="aspect-video w-full shrink-0 rounded-xl bg-black/5 object-cover sm:w-36"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    item.status === 'draft'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {item.status === 'draft' ? 'Draft' : 'Published'}
                                </span>
                                {item.caption && (
                                  <span className="text-[11px] text-black/45">{item.caption}</span>
                                )}
                              </div>
                              <h3 className="truncate text-sm font-semibold text-black sm:text-base">
                                {item.title}
                              </h3>
                              {!isPhotoOnlyTrack && item.workUrl && (
                                <a
                                  href={item.workUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all text-xs text-black/55 underline hover:text-black"
                                >
                                  {item.workUrl}
                                </a>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingWork(item)}
                                className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWork(item.id)}
                                className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* ===================================================== */}
          {/* TAB 4: CONTACT INQUIRIES (Client Requirements Inbox!) */}
          {/* ===================================================== */}
          {activeTab === 'contact-inquiries' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                    Client Inbox
                  </p>
                  <h1 className="text-2xl font-semibold text-black sm:text-3xl">
                    Contact Inquiries
                  </h1>
                  <p className="mt-1 text-xs text-black/60 sm:text-sm">
                    Every project requirement submitted from your public Contact form appears here
                    in real time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactSettings((v) => !v)}
                  className="cursor-pointer rounded-xl border border-black/15 bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
                >
                  {showContactSettings
                    ? 'Hide Contact & Social Settings'
                    : 'Edit Contact & Social Links'}
                </button>
              </div>

              {/* Optional Collapsible Contact Section & Social Links Editor */}
              {showContactSettings && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitSiteConfig(draft, 'Contact copy & social links updated live!');
                    setShowContactSettings(false);
                  }}
                  className="space-y-4 rounded-2xl border border-black/15 bg-white p-6"
                >
                  <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                    Public Contact Section &amp; Social Links
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Headline Word 1</label>
                      <input
                        type="text"
                        value={draft.contact.headlineFirst}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contact: { ...draft.contact, headlineFirst: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Headline Accent Word</label>
                      <input
                        type="text"
                        value={draft.contact.headlineAccent}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contact: { ...draft.contact, headlineAccent: e.target.value },
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Contact Message</label>
                    <textarea
                      rows={2}
                      value={draft.contact.description}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, description: e.target.value },
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2.5 border-t border-black/10 pt-2">
                    <div className="flex items-center justify-between">
                      <span className={labelClass}>Social Links</span>
                      <button
                        type="button"
                        onClick={addSocialLink}
                        className="cursor-pointer rounded-lg border border-black/15 px-3 py-1 text-xs font-medium text-black hover:bg-black hover:text-white"
                      >
                        + Add Link
                      </button>
                    </div>
                    {draft.contact.socialLinks.map((link, idx) => (
                      <div key={link.id} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => updateSocialLink(idx, { label: e.target.value })}
                          className={`${inputClass} sm:col-span-3`}
                        />
                        <input
                          type="text"
                          value={link.href}
                          onChange={(e) =>
                            updateSocialLink(idx, {
                              href: e.target.value,
                              external: !e.target.value.startsWith('mailto:'),
                            })
                          }
                          className={`${inputClass} sm:col-span-7`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSocialLink(idx)}
                          className="cursor-pointer rounded-xl border border-red-200 py-2 text-xs text-red-700 hover:bg-red-50 sm:col-span-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="cursor-pointer rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white"
                    >
                      Save Contact Settings
                    </button>
                  </div>
                </form>
              )}

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-black/10 pb-2.5">
                {(
                  [
                    { id: 'all', label: `All (${inquiries.length})` },
                    { id: 'new', label: `Unread (${unreadInquiriesCount})` },
                    {
                      id: 'read',
                      label: `Read (${inquiries.filter((i) => i.status === 'read').length})`,
                    },
                    {
                      id: 'replied',
                      label: `Replied (${inquiries.filter((i) => i.status === 'replied').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInquiryFilter(tab.id)}
                    className={`cursor-pointer border-b-2 pb-1 text-xs uppercase tracking-wider transition-colors ${
                      inquiryFilter === tab.id
                        ? 'border-black font-semibold text-black'
                        : 'border-transparent text-black/45 hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Inquiries List */}
              {visibleInquiries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/20 bg-white p-14 text-center">
                  <p className="mb-1 text-base font-medium text-black">No inquiries in this view</p>
                  <p className="text-xs text-black/55">
                    When someone fills out the Contact form on your portfolio, their full project
                    requirements will appear right here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className={`space-y-4 rounded-2xl border bg-white p-5 sm:p-6 ${
                        inq.status === 'new' ? 'border-coralRed/50 shadow-xs' : 'border-black/12'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-base font-semibold text-black">{inq.name}</h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                inq.status === 'new'
                                  ? 'bg-coralRed text-white'
                                  : inq.status === 'replied'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-black/8 text-black/65'
                              }`}
                            >
                              {inq.status === 'new' ? 'New Requirement' : inq.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-black/60">
                            {inq.email} ·{' '}
                            <span className="font-medium text-black">{inq.service}</span>
                            {inq.budget ? ` · Budget: ${inq.budget}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] tabular-nums text-black/45">
                          {formatDateShort(inq.createdAt)}
                        </span>
                      </div>

                      <div className="border-black/8 whitespace-pre-wrap rounded-xl border bg-[#fafafa] p-4 text-sm font-light leading-relaxed text-black/85">
                        {inq.message}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`mailto:${inq.email}?subject=${encodeURIComponent(`Re: ${inq.service} Project Inquiry`)}`}
                            onClick={() => handleInquiryStatus(inq.id, 'replied')}
                            className="rounded-lg bg-[#141517] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Reply via Email ↗
                          </a>
                          {inq.status === 'new' && (
                            <button
                              type="button"
                              onClick={() => handleInquiryStatus(inq.id, 'read')}
                              className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-xs text-black hover:bg-black/5"
                            >
                              Mark as Read
                            </button>
                          )}
                          {inq.status !== 'replied' && (
                            <button
                              type="button"
                              onClick={() => handleInquiryStatus(inq.id, 'replied')}
                              className="cursor-pointer rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50"
                            >
                              Mark Replied
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInquiryDelete(inq.id)}
                          className="cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 5: SETTINGS & SECURITY                            */}
          {/* ===================================================== */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <p className="text-coralRed mb-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  Console Controls
                </p>
                <h1 className="text-2xl font-semibold text-black sm:text-3xl">
                  Settings &amp; Security
                </h1>
                <p className="mt-1 text-xs text-black/60 sm:text-sm">
                  Change your Admin password, or download/restore a full portfolio backup.
                </p>
              </div>

              <form
                onSubmit={handlePasswordChange}
                className="border-black/12 space-y-4 rounded-2xl border bg-white p-6"
              >
                <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                  Change Admin Password
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassInput}
                      onChange={(e) => setCurrentPassInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input
                      type="password"
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90"
                  >
                    Update Password
                  </button>
                </div>
              </form>

              <div className="border-black/12 space-y-4 rounded-2xl border bg-white p-6">
                <h2 className="text-coralRed text-xs font-semibold uppercase tracking-widest">
                  Full Backup &amp; Restore (.json)
                </h2>
                <p className="text-sm font-light text-black/65">
                  Download all works, thumbnails, Hero/About settings, Resume, and Contact Inquiries
                  into one portable JSON file.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="cursor-pointer rounded-xl bg-[#141517] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90"
                  >
                    Download Full Backup
                  </button>
                  <label className="cursor-pointer rounded-xl border border-black/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-black hover:bg-black/5">
                    Restore Backup
                    <input
                      ref={backupInputRef}
                      type="file"
                      accept="application/json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      commitSiteConfig(
                        DEFAULT_SITE_CONFIG,
                        'Site texts reset to defaults in PostgreSQL.'
                      );
                    }}
                    className="cursor-pointer rounded-xl border border-red-200 px-5 py-2.5 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                  >
                    Reset Site Texts
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
