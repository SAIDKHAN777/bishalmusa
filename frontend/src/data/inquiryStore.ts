export type InquiryStatus = 'new' | 'read' | 'replied';

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  budget?: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

export const DEFAULT_INQUIRIES: ContactInquiry[] = [
  {
    id: 'inq_demo_1',
    name: 'Aarav Mehta',
    email: 'aarav@studioflux.io',
    service: 'Video Editing',
    budget: '$1,500 – $3,000',
    message:
      'Looking for a long-term editor for our weekly 15-minute documentary-style YouTube episodes. Need crisp pacing, sound design, and color grading.',
    status: 'new',
    createdAt: '2026-11-18T02:15:00.000Z',
  },
  {
    id: 'inq_demo_2',
    name: 'Sarah Jenkins',
    email: 'sarah@northstarlabs.co',
    service: 'Motion Graphics',
    budget: '$2,000+',
    message:
      'We are launching a SaaS product next month and need a 60-second animated launch reel with kinetic typography and clean UI callouts.',
    status: 'read',
    createdAt: '2026-11-17T14:40:00.000Z',
  },
];

const INQUIRY_STORAGE_KEY = 'bishal_contact_inquiries_v1';

export function loadInquiries(): ContactInquiry[] {
  try {
    const raw = window.localStorage.getItem(INQUIRY_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(DEFAULT_INQUIRIES));
      return DEFAULT_INQUIRIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContactInquiry[]) : DEFAULT_INQUIRIES;
  } catch {
    return DEFAULT_INQUIRIES;
  }
}

export function saveInquiries(items: ContactInquiry[]): void {
  try {
    window.localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('portfolio-inquiries-updated'));
  } catch {
    // ignore storage quota
  }
}

export function addInquiry(
  input: Omit<ContactInquiry, 'id' | 'status' | 'createdAt'>
): ContactInquiry[] {
  const next: ContactInquiry = {
    ...input,
    id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  const updated = [next, ...loadInquiries()];
  saveInquiries(updated);
  return updated;
}

export function updateInquiryStatus(id: string, status: InquiryStatus): ContactInquiry[] {
  const updated = loadInquiries().map((inq) => (inq.id === id ? { ...inq, status } : inq));
  saveInquiries(updated);
  return updated;
}

export function deleteInquiry(id: string): ContactInquiry[] {
  const updated = loadInquiries().filter((inq) => inq.id !== id);
  saveInquiries(updated);
  return updated;
}
