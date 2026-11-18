export type WorkCategoryId =
  'video-editing' | 'graphic-design' | 'motion-graphics' | 'digital-marketing';

export interface WorkCategory {
  id: WorkCategoryId;
  number: string;
  slug: string;
  title: string;
  accentWord: string;
  summary: string;
  ctaLabel: string;
}

export interface WorkItem {
  id: string;
  categoryId: WorkCategoryId;
  title: string;
  thumbnailUrl: string;
  workUrl?: string;
  caption?: string;
  tags?: string[];
  status?: 'published' | 'draft';
  createdAt: string;
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    id: 'video-editing',
    number: '01.',
    slug: '/work/video-editing',
    title: 'Video Editing',
    accentWord: 'Editing',
    summary:
      'Story-first cuts, pacing, sound design, and color grading crafted for YouTube films, commercials, reels, and brand documentaries.',
    ctaLabel: 'Open Video Editing',
  },
  {
    id: 'graphic-design',
    number: '02.',
    slug: '/work/graphic-design',
    title: 'Graphic Design',
    accentWord: 'Design',
    summary:
      'Brand identities, high-CTR thumbnails, editorial posters, social campaigns, and clean visual systems built for instant recognition.',
    ctaLabel: 'Open Graphic Design',
  },
  {
    id: 'motion-graphics',
    number: '03.',
    slug: '/work/motion-graphics',
    title: 'Motion Graphics',
    accentWord: 'Graphics',
    summary:
      'Kinetic typography, animated explainers, logo stings, UI motion reels, and fluid visual storytelling engineered frame by frame.',
    ctaLabel: 'Open Motion Graphics',
  },
  {
    id: 'digital-marketing',
    number: '04.',
    slug: '/work/digital-marketing',
    title: 'Digital Marketing',
    accentWord: 'Marketing',
    summary:
      'Performance creatives, conversion funnels, content strategy, and measurable growth campaigns tailored for modern digital brands.',
    ctaLabel: 'Open Digital Marketing',
  },
];

/** Generates a crisp offline-safe SVG editorial preview thumbnail for demo items */
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function makeEditorialThumb(label: string, subtitle: string, bg: string, accent: string): string {
  const safeLabel = escapeXml(label);
  const safeSub = escapeXml(subtitle);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#111111"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="1060" cy="150" r="240" fill="${accent}" fill-opacity="0.18"/>
    <circle cx="200" cy="600" r="190" fill="${accent}" fill-opacity="0.12"/>
    <rect x="64" y="64" width="1152" height="592" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>
    <text x="110" y="340" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="60" font-weight="600">${safeLabel}</text>
    <text x="110" y="405" fill="#d6d6d6" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="300">${safeSub}</text>
    <rect x="110" y="458" width="120" height="6" rx="3" fill="${accent}"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_WORK_ITEMS: WorkItem[] = [
  {
    id: 'demo-ve-1',
    categoryId: 'video-editing',
    title: 'Brand Documentary — Behind the Craft',
    thumbnailUrl: makeEditorialThumb(
      'Brand Documentary',
      '4K Commercial Cut · Sound Design & Color Grade',
      '#1e2430',
      '#e97f61'
    ),
    workUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    caption: 'YouTube · 04:12',
    tags: ['Commercial', 'Color Grade'],
    status: 'published',
    createdAt: '2026-11-18T00:00:00.000Z',
  },
  {
    id: 'demo-ve-2',
    categoryId: 'video-editing',
    title: 'Creator Launch Film — High Retention Edit',
    thumbnailUrl: makeEditorialThumb(
      'Creator Launch Film',
      'Fast-Paced Storytelling · Dynamic B-Roll',
      '#241d1b',
      '#e97f61'
    ),
    workUrl: 'https://vimeo.com/',
    caption: 'Vimeo · 02:45',
    tags: ['Pacing', 'Storytelling'],
    status: 'published',
    createdAt: '2026-11-17T00:00:00.000Z',
  },
  {
    id: 'demo-gd-1',
    categoryId: 'graphic-design',
    title: 'Editorial Brand Identity & Poster Series',
    thumbnailUrl: makeEditorialThumb(
      'Brand Identity System',
      'Typography · Packaging · Social Kit',
      '#1b2624',
      '#e97f61'
    ),
    workUrl: 'https://www.behance.net/',
    caption: 'Behance Showcase',
    tags: ['Branding', 'Identity'],
    status: 'published',
    createdAt: '2026-11-18T00:00:00.000Z',
  },
  {
    id: 'demo-gd-2',
    categoryId: 'graphic-design',
    title: 'YouTube High-CTR Thumbnail System',
    thumbnailUrl: makeEditorialThumb(
      'Thumbnail Systems',
      'Visual Hierarchy · Click-Through Optimization',
      '#26212c',
      '#e97f61'
    ),
    workUrl: 'https://dribbble.com/',
    caption: 'Dribbble Collection',
    tags: ['Thumbnails', 'CTR'],
    status: 'published',
    createdAt: '2026-11-17T00:00:00.000Z',
  },
  {
    id: 'demo-mg-1',
    categoryId: 'motion-graphics',
    title: 'SaaS Product Explainer & UI Motion Reel',
    thumbnailUrl: makeEditorialThumb(
      'UI Motion Reel',
      'Kinetic Typography · 60fps Micro-Interactions',
      '#1d2233',
      '#e97f61'
    ),
    workUrl: 'https://vimeo.com/',
    caption: 'Motion Reel · 01:30',
    tags: ['After Effects', 'UI Motion'],
    status: 'published',
    createdAt: '2026-11-18T00:00:00.000Z',
  },
  {
    id: 'demo-dm-1',
    categoryId: 'digital-marketing',
    title: 'Performance Ad Creatives & Funnel Case',
    thumbnailUrl: makeEditorialThumb(
      'Growth Campaign',
      '4.2x ROAS · Paid Social & Funnel Strategy',
      '#2a201b',
      '#e97f61'
    ),
    caption: 'Campaign Breakdown',
    tags: ['ROAS', 'Paid Social'],
    status: 'published',
    createdAt: '2026-11-18T00:00:00.000Z',
  },
];

const STORAGE_KEY = 'portfolio_admin_works_v3';

export function loadWorkItems(): WorkItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WORK_ITEMS));
      return DEFAULT_WORK_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as WorkItem[];
    return DEFAULT_WORK_ITEMS;
  } catch {
    return DEFAULT_WORK_ITEMS;
  }
}

export function saveWorkItems(items: WorkItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('portfolio-works-updated'));
  } catch {
    // Handle storage quota gracefully
  }
}

export function addWorkItem(input: Omit<WorkItem, 'id' | 'createdAt'>): WorkItem[] {
  const current = loadWorkItems();
  const next: WorkItem = {
    ...input,
    id: `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [next, ...current];
  saveWorkItems(updated);
  return updated;
}

export function updateWorkItem(id: string, patch: Omit<WorkItem, 'id' | 'createdAt'>): WorkItem[] {
  const updated = loadWorkItems().map((item) => (item.id === id ? { ...item, ...patch } : item));
  saveWorkItems(updated);
  return updated;
}

export function deleteWorkItem(id: string): WorkItem[] {
  const updated = loadWorkItems().filter((item) => item.id !== id);
  saveWorkItems(updated);
  return updated;
}

export function resetWorkItems(): WorkItem[] {
  saveWorkItems(DEFAULT_WORK_ITEMS);
  return DEFAULT_WORK_ITEMS;
}

export function getCategoryById(id: string): WorkCategory | undefined {
  return WORK_CATEGORIES.find((c) => c.id === id);
}

/** Compresses an uploaded image File into a crisp data URL suitable for localStorage persistence */
export function readImageFileAsDataUrl(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
