export interface CaseStudy {
  id: string;
  number: string;
  slug: string;
  title: string;
  summary: string;
  kpiValue?: string;
  kpiLabel?: string;
  comingSoon?: boolean;
  role: string;
  timeline: string;
  context: string;
  highlights: string[];
  outcome: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'before-the-first-paycheck',
    number: '01.',
    slug: '/work/before-the-first-paycheck',
    title: 'Before the First Paycheck',
    summary:
      'Employers own the record, employees sign it. U.S. payroll onboarding designed for when the two disagree: in-place corrections, a full employer reply loop and signatures that stay valid.',
    kpiValue: '15/15',
    kpiLabel: 'tasks completed unaided',
    role: 'Lead Product Designer & Frontend Engineer',
    timeline: 'Shipped May 2026',
    context:
      'In U.S. payroll onboarding, an employer-entered typo on a legal name or address previously forced employees to halt and email HR. We redesigned the ownership boundary so employees can flag discrepancies inline and keep completing state tax forms while HR reviews.',
    highlights: [
      'Round 1 → Round 2 usability testing jumped from 5/15 to 15/15 unaided task completions across state forms, name corrections, and mid-review address edits.',
      'Onboarding records sent back to employees for missing or incorrect details dropped from 31% to 12% in the first pilot month.',
      'Built production React & accessible form primitives with explicit signature invalidation states.',
    ],
    outcome:
      'Shipped to the first cohort of employers in May 2026 on a shared component system co-developed across design and engineering.',
  },
  {
    id: 'cleverx-online-presence',
    number: '02.',
    slug: '/work/cleverx-online-presence',
    title: 'CleverX Organic Discovery',
    summary:
      'Connecting Algolia-powered expert search with a selective programmatic SEO system that quadrupled daily traffic.',
    kpiValue: '4×',
    kpiLabel: 'daily traffic',
    role: 'Design Systems & Growth Frontend Engineer',
    timeline: 'Production Launch',
    context:
      'Researchers searching for niche B2B domain experts needed instant, faceted discovery while search engines needed clean, indexable landing architecture without thin duplicate pages.',
    highlights: [
      'Unified Algolia instant search facets with curated programmatic taxonomy pages for high-intent B2B verticals.',
      'Reduced Time to Interactive and eliminated layout shifts across thousands of expert profile cards.',
      'Delivered measurable 4× growth in daily organic discovery sessions with higher researcher conversion.',
    ],
    outcome:
      'Transformed organic search into a compounding acquisition channel backed by fast, maintainable frontend architecture.',
  },
  {
    id: 'staples-rebrand',
    number: '03.',
    slug: '/work/staples-rebrand',
    title: 'Staples Responsive Transformation',
    summary:
      'Responsive migration, shared components, brand consistency, and the practical craft needed inside a larger retail platform.',
    comingSoon: true,
    role: 'Senior Frontend & UI Systems Engineer',
    timeline: 'Enterprise Rollout',
    context:
      'Bringing a major retail rebrand onto the web required pragmatic responsive breakpoints, token governance, and incremental migration without disrupting high-volume commerce traffic.',
    highlights: [
      'Migrated legacy desktop templates to responsive grid foundations.',
      'Established shared design tokens and accessible interactive primitives across teams.',
    ],
    outcome: 'Case study write-up coming soon.',
  },
];

export const FOOTER_LINKS = [
  { label: 'Email', href: 'mailto:jaspreet98singh@gmail.com', external: false },
  { label: 'Github', href: 'https://github.com/01singhjaspreet', external: true },
  { label: 'X', href: 'https://x.com/01singhjaspreet', external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/01singhjaspreet/', external: true },
  { label: 'Resume', href: '#resume', external: false, isResume: true },
];

export const FOOTER_HOVER_CARDS = [
  { tag: 'Punjab', caption: 'Golden hour fields & quiet roads', accent: '#e97f61' },
  { tag: 'Classic 350', caption: 'Chasing horizons on two wheels', accent: '#d6c8b2' },
  { tag: 'Hyderabad', caption: 'City lights & late-night builds', accent: '#f5b971' },
  { tag: 'Craft', caption: 'Design judgement + WebGL engineering', accent: '#8fb4d9' },
];
