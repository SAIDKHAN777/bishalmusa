import type { WorkCategoryId } from './workStore';

export interface SocialLink {
  id: string;
  label: string;
  href: string;
  external: boolean;
}

export interface CategoryMetaOverride {
  title: string;
  summary: string;
  ctaLabel: string;
}

export interface QuickNote {
  id: string;
  text: string;
  subtext?: string;
  author?: string;
}

export interface AboutBioSection {
  id: string;
  title: string;
  subLabel: string;
  body: string;
  quickNotes: QuickNote[];
}

export interface SiteConfig {
  tabTitle: string;
  headerRole: string;
  hero: {
    greetingLine: string;
    displayName: string;
    introText: string;
  };
  about: {
    sections: AboutBioSection[];
  };
  worksIntro: {
    headline: string;
    introText: string;
    paragraph1?: string;
    paragraph2?: string;
    categories: Record<WorkCategoryId, CategoryMetaOverride>;
  };
  contact: {
    headlineFirst: string;
    headlineAccent: string;
    description: string;
    socialLinks: SocialLink[];
    footerCreditName: string;
    copyrightText: string;
  };
  resume: {
    fullName: string;
    subtitle: string;
    coreFocus: string;
    selectedExperience: string;
    pdfDataUrl?: string;
    pdfFileName?: string;
    externalPdfUrl?: string;
  };
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  tabTitle: 'Bishal Musa | Designer',
  headerRole: 'Designer',
  hero: {
    greetingLine: "Hello, I'm",
    displayName: 'Bishal Musa',
    introText:
      'I design and build digital products for a living.\nStill figuring out the living part.',
  },
  about: {
    sections: [
      {
        id: 'bio_profession',
        title: 'Designer,\nDeveloper',
        subLabel: 'by profession',
        body: "As someone who cares deeply about digital product design and development, I guide products from early ideas all the way to launch.\n\nMy goal is to strip away complexity, creating interfaces that users intuitively understand and leave a positive impact. I'm always trying to learn more, and I hope my work helps make people's daily use of technology better.",
        quickNotes: [],
      },
      {
        id: 'bio_ambition',
        title: 'Polymath',
        subLabel: 'by ambition',
        body: "Armed with a mind that never stops questioning, I'm drawn to explore everything from technology to timeless philosophy, from wit and verse to the stars above. I'm always searching for the deeper meaning, whether through code or contemplation.\n\nYou'll find me riding my Classic 350, letting the wind clear my head, or finding peace in a small village in Punjab. Other times, I'm in Hyderabad, caught up in the city's energy.\n\nI'm here for the ride, chasing horizons.",
        quickNotes: [
          {
            id: 'note_1',
            text: 'सौ मिलीं ज़िंदगी से सौग़ातें\nहम को आवारगी ही रास आई',
            subtext: 'Life offered a hundred gifts;\nonly wandering ever felt like home.',
            author: 'Ali Sardar Jafri',
          },
          {
            id: 'note_2',
            text: 'Look round at the courses of the stars,\nas if thou wert going along with them.',
            author: 'Marcus Aurelius, Meditations',
          },
        ],
      },
    ],
  },
  worksIntro: {
    headline: 'Selected works',
    introText:
      'Explore curated creative work across four core disciplines — click any category to open its dedicated full-page gallery.\n\nEvery project thumbnail links directly to the live video or published campaign, managed seamlessly from the Admin workspace.',
    categories: {
      'video-editing': {
        title: 'Video Editing',
        summary:
          'Story-first cuts, pacing, sound design, and color grading crafted for YouTube films, commercials, reels, and brand documentaries.',
        ctaLabel: 'Open Video Editing',
      },
      'graphic-design': {
        title: 'Graphic Design',
        summary:
          'Brand identities, high-CTR thumbnails, editorial posters, social campaigns, and clean visual systems built for instant recognition.',
        ctaLabel: 'Open Graphic Design',
      },
      'motion-graphics': {
        title: 'Motion Graphics',
        summary:
          'Kinetic typography, animated explainers, logo stings, UI motion reels, and fluid visual storytelling engineered frame by frame.',
        ctaLabel: 'Open Motion Graphics',
      },
      'digital-marketing': {
        title: 'Digital Marketing',
        summary:
          'Performance creatives, conversion funnels, content strategy, and measurable growth campaigns tailored for modern digital brands.',
        ctaLabel: 'Open Digital Marketing',
      },
    },
  },
  contact: {
    headlineFirst: 'Say',
    headlineAccent: 'hello',
    description:
      "Hiring, building something, or just want to talk? Send a good question or a bad joke, either works. I'll do my best with the question. The joke, I'll probably answer with a worse one. Sorry in advance.",
    socialLinks: [
      { id: 'email', label: 'Email', href: 'mailto:hello@bishalmusa.com', external: false },
      { id: 'github', label: 'Github', href: 'https://github.com/', external: true },
      { id: 'x', label: 'X', href: 'https://x.com/', external: true },
      { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/', external: true },
    ],
    footerCreditName: 'Said Khan',
    copyrightText: '© 2026 · All rights reserved',
  },
  resume: {
    fullName: 'Bishal Musa',
    subtitle: 'Video Editor, Visual Designer & Digital Strategist',
    coreFocus:
      'Video Editing, Graphic Design, Motion Graphics, Digital Marketing, Brand Storytelling & Production Systems.',
    selectedExperience:
      'Commercial YouTube Films · Brand Identity Kits · Kinetic Motion Reels · High-ROAS Performance Campaigns.',
    externalPdfUrl: '',
  },
};

const SITE_CONFIG_KEY = 'bishal_site_config_v1';
const ADMIN_PASS_KEY = 'bishal_admin_password_override_v1';

export function loadSiteConfig(): SiteConfig {
  try {
    const raw = window.localStorage.getItem(SITE_CONFIG_KEY);
    if (!raw) return DEFAULT_SITE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SiteConfig> & {
      hero?: Partial<SiteConfig['hero']> & { introLine1?: string; introLine2?: string };
    };
    const legacyIntro =
      parsed.hero?.introText ??
      ([parsed.hero?.introLine1, parsed.hero?.introLine2].filter(Boolean).join('\n') ||
        DEFAULT_SITE_CONFIG.hero.introText);

    const parsedAbout = parsed.about as
      | (Partial<SiteConfig['about']> & {
          quickNotes?: QuickNote[];
          part1Line1?: string;
          part1Line2?: string;
          part1Prefix?: string;
          part1Accent?: string;
          part1Paragraphs?: string[];
          part2Heading?: string;
          part2Prefix?: string;
          part2Accent?: string;
          part2Paragraphs?: string[];
        })
      | undefined;

    let normalizedSections: AboutBioSection[] = DEFAULT_SITE_CONFIG.about.sections;
    if (Array.isArray(parsedAbout?.sections) && parsedAbout.sections.length > 0) {
      const legacyGlobalNotes = Array.isArray(parsedAbout.quickNotes) ? parsedAbout.quickNotes : [];
      const anySectionHasNotes = parsedAbout.sections.some(
        (s) => Array.isArray(s.quickNotes) && s.quickNotes.length > 0
      );
      normalizedSections = parsedAbout.sections.map((s, idx, arr) => ({
        ...s,
        quickNotes: Array.isArray(s.quickNotes)
          ? s.quickNotes
          : !anySectionHasNotes && idx === arr.length - 1
            ? legacyGlobalNotes
            : [],
      }));
    } else if (parsedAbout?.part1Line1 || parsedAbout?.part2Heading) {
      normalizedSections = [
        {
          id: 'bio_profession',
          title: [parsedAbout.part1Line1, parsedAbout.part1Line2].filter(Boolean).join('\n'),
          subLabel: [parsedAbout.part1Prefix || 'by', parsedAbout.part1Accent || 'profession']
            .filter(Boolean)
            .join(' '),
          body: (parsedAbout.part1Paragraphs ?? []).join('\n\n'),
          quickNotes: [],
        },
        {
          id: 'bio_ambition',
          title: parsedAbout.part2Heading || 'Polymath',
          subLabel: [parsedAbout.part2Prefix || 'by', parsedAbout.part2Accent || 'ambition']
            .filter(Boolean)
            .join(' '),
          body: (parsedAbout.part2Paragraphs ?? []).join('\n\n'),
          quickNotes: DEFAULT_SITE_CONFIG.about.sections[1].quickNotes,
        },
      ];
    }

    const normalizedHeaderRole =
      !parsed.headerRole || parsed.headerRole === 'Designer & Developer'
        ? DEFAULT_SITE_CONFIG.headerRole
        : parsed.headerRole;
    const normalizedTabTitle =
      !parsed.tabTitle || parsed.tabTitle === 'Bishal Musa | Designer & Developer'
        ? DEFAULT_SITE_CONFIG.tabTitle
        : parsed.tabTitle;

    return {
      ...DEFAULT_SITE_CONFIG,
      ...parsed,
      tabTitle: normalizedTabTitle,
      headerRole: normalizedHeaderRole,
      hero: {
        greetingLine: parsed.hero?.greetingLine ?? DEFAULT_SITE_CONFIG.hero.greetingLine,
        displayName: parsed.hero?.displayName ?? DEFAULT_SITE_CONFIG.hero.displayName,
        introText: legacyIntro,
      },
      about: {
        sections: normalizedSections,
      },
      worksIntro: {
        headline: parsed.worksIntro?.headline ?? DEFAULT_SITE_CONFIG.worksIntro.headline,
        introText:
          parsed.worksIntro?.introText ??
          ([parsed.worksIntro?.paragraph1, parsed.worksIntro?.paragraph2]
            .filter(Boolean)
            .join('\n\n') ||
            DEFAULT_SITE_CONFIG.worksIntro.introText),
        categories: {
          ...DEFAULT_SITE_CONFIG.worksIntro.categories,
          ...(parsed.worksIntro?.categories ?? {}),
        },
      },
      contact: {
        ...DEFAULT_SITE_CONFIG.contact,
        ...(parsed.contact ?? {}),
        footerCreditName:
          !parsed.contact?.footerCreditName || parsed.contact.footerCreditName === 'Bishal Musa'
            ? DEFAULT_SITE_CONFIG.contact.footerCreditName
            : parsed.contact.footerCreditName,
        socialLinks: parsed.contact?.socialLinks ?? DEFAULT_SITE_CONFIG.contact.socialLinks,
      },
      resume: { ...DEFAULT_SITE_CONFIG.resume, ...(parsed.resume ?? {}) },
    };
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export function saveSiteConfig(config: SiteConfig): void {
  try {
    window.localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('portfolio-site-config-updated'));
  } catch {
    // handle quota gracefully
  }
}

export function resetSiteConfig(): SiteConfig {
  saveSiteConfig(DEFAULT_SITE_CONFIG);
  return DEFAULT_SITE_CONFIG;
}

export function getActiveAdminPassword(): string {
  try {
    const custom = window.localStorage.getItem(ADMIN_PASS_KEY)?.trim();
    if (custom) return custom;
  } catch {
    // ignore
  }
  return (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined)?.trim() || 'bishal2026';
}

export function setCustomAdminPassword(newPassword: string): void {
  window.localStorage.setItem(ADMIN_PASS_KEY, newPassword.trim());
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
