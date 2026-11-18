import { Fragment, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Header } from './components/Header';
import { OpenCursor } from './components/OpenCursor';
import { FooterNameEasterEgg } from './components/FooterNameEasterEgg';
import { ContactForm } from './components/ContactForm';
import { useScrollReveal } from './hooks/useScrollReveal';

const ResumeDialog = lazy(() =>
  import('./components/Modals').then((m) => ({ default: m.ResumeDialog }))
);
const CategoryWorkPage = lazy(() =>
  import('./components/CategoryWorkPage').then((m) => ({ default: m.CategoryWorkPage }))
);
const AdminWorkPage = lazy(() =>
  import('./components/AdminWorkPage').then((m) => ({ default: m.AdminWorkPage }))
);
import {
  WORK_CATEGORIES,
  getCategoryById,
  loadWorkItems,
  saveWorkItems,
  type WorkCategoryId,
  type WorkItem,
} from './data/workStore';
import { loadSiteConfig, saveSiteConfig, type SiteConfig } from './data/siteStore';
import { loadInquiries, type ContactInquiry } from './data/inquiryStore';
import { fetchPublicPortfolio } from './lib/api';

type ActiveRoute =
  | { kind: 'home' }
  | { kind: 'category'; categoryId: WorkCategoryId }
  | { kind: 'admin'; initialCategory?: WorkCategoryId };

function parseLocationRoute(): ActiveRoute {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const hash = window.location.hash.replace(/\/+$/, '');

  // Support /admin from ANY section or page (e.g. /admin, /#work/admin, /#about/admin, /#contact/admin, /work/video-editing/admin, /#admin)
  const pathIsAdmin = path === '/admin' || /\/admin$/i.test(path);
  const hashIsAdmin = /^#admin$/i.test(hash) || /\/admin$/i.test(hash);

  if (pathIsAdmin || hashIsAdmin) {
    const params = new URLSearchParams(window.location.search);
    const paramCat = params.get('category');
    const pathCatMatch = path.match(/^\/work\/([a-z0-9-]+)\/admin$/i);
    const candidate = paramCat || pathCatMatch?.[1];
    const valid =
      candidate && getCategoryById(candidate) ? (candidate as WorkCategoryId) : undefined;
    return { kind: 'admin', initialCategory: valid };
  }

  const match = path.match(/^\/work\/([a-z0-9-]+)$/i);
  if (match && getCategoryById(match[1])) {
    return { kind: 'category', categoryId: match[1] as WorkCategoryId };
  }
  return { kind: 'home' };
}

function renderMultiline(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}

function ArrowUpRight({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`motion-arrow shrink-0 ${className}`}
      data-direction="up-right"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 17 17 7m0 0H8m9 0v9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowRight({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`motion-arrow shrink-0 ${className}`}
      data-direction="right"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m0 0-6-6m6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function App() {
  const mainRef = useRef<HTMLElement | null>(null);

  const [route, setRoute] = useState<ActiveRoute>(() => parseLocationRoute());
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => loadWorkItems());
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => loadSiteConfig());
  const [inquiries, setInquiries] = useState<ContactInquiry[]>(() => loadInquiries());
  const [scrolledAway, setScrolledAway] = useState(false);
  const [activeSection, setActiveSection] = useState<'hero' | 'about' | 'work' | 'contact'>('hero');
  const [cursorOpen, setCursorOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [heroRevealed, setHeroRevealed] = useState(false);

  // Hydrate public portfolio live from PostgreSQL backend (/api/portfolio/public)
  useEffect(() => {
    if (route.kind === 'admin') return;
    let cancelled = false;
    fetchPublicPortfolio()
      .then((data) => {
        if (cancelled) return;
        setSiteConfig(data.siteConfig);
        setWorkItems(data.works);
        saveSiteConfig(data.siteConfig);
        saveWorkItems(data.works);
      })
      .catch(() => {
        // Keep warm cache if backend is temporarily unreachable
      });
    return () => {
      cancelled = true;
    };
  }, [route.kind]);

  // Sync document <title> dynamically with Display Name
  useEffect(() => {
    document.title = `${siteConfig.hero.displayName} | ${siteConfig.headerRole}`;
  }, [siteConfig.hero.displayName, siteConfig.headerRole]);

  // Trigger scroll reveals on homepage
  useScrollReveal(mainRef, '[data-reveal-target]');

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setHeroRevealed(true));
    return () => window.cancelAnimationFrame(id);
  }, [route.kind]);

  // Keep browser Back/Forward, manual #section/admin hash edits, & cross-tab Admin updates synchronized
  useEffect(() => {
    const syncRoute = () => {
      setCursorOpen(false);
      const next = parseLocationRoute();
      setRoute(next);
      if (next.kind === 'admin') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    const onWorksSync = () => setWorkItems(loadWorkItems());
    const onConfigSync = () => setSiteConfig(loadSiteConfig());
    const onInquiriesSync = () => setInquiries(loadInquiries());
    const onStorageSync = () => {
      setWorkItems(loadWorkItems());
      setSiteConfig(loadSiteConfig());
      setInquiries(loadInquiries());
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('storage', onStorageSync);
    window.addEventListener('portfolio-works-updated', onWorksSync);
    window.addEventListener('portfolio-site-config-updated', onConfigSync);
    window.addEventListener('portfolio-inquiries-updated', onInquiriesSync);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('storage', onStorageSync);
      window.removeEventListener('portfolio-works-updated', onWorksSync);
      window.removeEventListener('portfolio-site-config-updated', onConfigSync);
      window.removeEventListener('portfolio-inquiries-updated', onInquiriesSync);
    };
  }, []);

  const openCategoryPage = useCallback((categoryId: WorkCategoryId) => {
    setCursorOpen(false);
    window.history.pushState({}, '', `/work/${categoryId}`);
    setRoute({ kind: 'category', categoryId });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const navigateHomeSection = useCallback(
    (sectionId?: 'about' | 'work' | 'contact') => {
      setCursorOpen(false);
      const hash = sectionId ? `/#${sectionId}` : '/';
      if (route.kind !== 'home') {
        window.history.pushState({}, '', hash);
        setRoute({ kind: 'home' });
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (sectionId) {
              document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        });
      } else if (sectionId) {
        window.history.replaceState({}, '', hash);
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [route.kind]
  );

  // Nav Scroll-Spy
  useEffect(() => {
    if (route.kind !== 'home') {
      setActiveSection('work');
      setScrolledAway(true);
      return;
    }

    const updateScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight || 900;

      setScrolledAway(y > vh * 0.22);

      const contactEl = document.getElementById('contact');
      const aboutEl = document.getElementById('about');
      const workEl = document.getElementById('work');

      const threshold = vh * 0.42;
      if (contactEl && contactEl.getBoundingClientRect().top <= threshold) {
        setActiveSection('contact');
      } else if (workEl && workEl.getBoundingClientRect().top <= threshold) {
        setActiveSection('work');
      } else if (aboutEl && aboutEl.getBoundingClientRect().top <= threshold) {
        setActiveSection('about');
      } else {
        setActiveSection('hero');
      }
    };

    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [route.kind]);

  const activeCategory = route.kind === 'category' ? getCategoryById(route.categoryId) : undefined;

  const greetingWords = siteConfig.hero.greetingLine.split(' ');

  return (
    <div className="text-mutedBeige relative min-h-screen bg-white">
      {route.kind !== 'admin' && (
        <Header
          activeSection={activeSection}
          scrolledAway={scrolledAway}
          roleLabel={siteConfig.headerRole}
          onOpenResume={() => setResumeOpen(true)}
          onNavigateSection={(sec) => navigateHomeSection(sec)}
        />
      )}

      {route.kind === 'category' && activeCategory ? (
        <main id="main" tabIndex={-1} className="outline-none">
          <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <CategoryWorkPage
              category={activeCategory}
              categoryOverrides={siteConfig.worksIntro.categories}
              items={workItems}
              onBackHome={() => navigateHomeSection('work')}
              onSelectCategory={openCategoryPage}
            />
          </Suspense>
        </main>
      ) : route.kind === 'admin' ? (
        <main id="main" tabIndex={-1} className="outline-none">
          <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <AdminWorkPage
              initialCategory={route.initialCategory}
              items={workItems}
              siteConfig={siteConfig}
              inquiries={inquiries}
              onItemsChange={setWorkItems}
              onSiteConfigChange={setSiteConfig}
              onInquiriesChange={setInquiries}
              onBackHome={() => navigateHomeSection('work')}
              onOpenCategory={openCategoryPage}
            />
          </Suspense>
        </main>
      ) : (
        <main ref={mainRef} id="main" tabIndex={-1} className="outline-none">
          {/* Clean White Fullscreen Hero Background */}
          <div
            id="heroWrapper"
            className="app-viewport sticky left-0 top-0 z-0 overflow-hidden bg-white"
          >
            {/* Hero Intro Copy — gently fades out as user scrolls into About */}
            <div
              className={`pointer-events-none absolute inset-0 z-20 flex h-full w-full items-start justify-start px-4 pt-28 transition-opacity duration-500 lg:px-6 lg:pt-36 2xl:px-8 2xl:pt-44 ${
                scrolledAway ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <div
                className="flex flex-col"
                data-scroll-reveal={heroRevealed ? 'visible' : 'pending'}
              >
                <h1 className="font-accent text-heroGreeting leading-11 text-sand md:text-heroGreetingMd lg:text-heroGreetingLg w-fit max-w-full text-left font-normal tracking-normal md:leading-none">
                  {greetingWords.map((word, wi) => (
                    <span key={wi} className="motion-word-mask mr-2">
                      <span
                        className="motion-word"
                        style={{ ['--motion-delay' as string]: `${wi * 65}ms` }}
                      >
                        {word}
                      </span>
                    </span>
                  ))}
                  <span className="hero-name-emphasis mt-1 block text-7xl font-normal leading-none tracking-normal md:text-8xl lg:text-9xl">
                    <span className="motion-word-mask">
                      <span
                        className="motion-word"
                        style={{ ['--motion-delay' as string]: '130ms' }}
                      >
                        {siteConfig.hero.displayName}
                      </span>
                    </span>
                  </span>
                </h1>

                <p
                  className="font-accent text-heroIntro text-sand md:text-heroIntroMd lg:text-heroIntroLg motion-lift mt-4 max-w-3xl whitespace-pre-line text-pretty text-left font-normal leading-snug tracking-normal md:mt-5 md:leading-snug lg:mt-6"
                  style={{ ['--motion-at' as string]: '0.24s' }}
                >
                  {siteConfig.hero.introText}
                </p>
              </div>
            </div>
          </div>

          {/* Scrolling Editorial Foreground */}
          <div className="relative z-10">
            {/* ABOUT SECTION — Dynamic Bio Sections + Quick Notes */}
            <section
              id="about"
              tabIndex={-1}
              className="site-container text-mutedBeige relative scroll-mt-28 pt-12 outline-none"
            >
              {siteConfig.about.sections.map((section) => {
                const titleLines = section.title.split('\n').filter((l) => l.trim().length > 0);
                const subWords = section.subLabel.trim().split(/\s+/).filter(Boolean);
                const subPrefix = subWords.slice(0, -1).join(' ');
                const subAccent = subWords[subWords.length - 1] ?? '';
                const paragraphs = section.body
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean);
                const sectionNotes = (section.quickNotes ?? []).filter(
                  (n) => n.text.trim().length > 0
                );

                return (
                  <div key={section.id} className="relative mb-28">
                    <div>
                      <h2
                        data-reveal-target=""
                        className="font-accent text-aboutHeading leading-11 lg:text-aboutHeadingLg lg:leading-12 mb-5 w-fit whitespace-nowrap font-normal tracking-normal sm:mb-7"
                      >
                        {titleLines.map((line, li) => (
                          <Fragment key={li}>
                            <span className="motion-word-mask">
                              <span
                                className="motion-word"
                                style={{ ['--motion-delay' as string]: `${li * 110}ms` }}
                              >
                                {line}
                              </span>
                            </span>
                            {li < titleLines.length - 1 && <br />}
                          </Fragment>
                        ))}
                        {section.subLabel.trim() && (
                          <span className="font-accent text-aboutSubtitle md:text-aboutSubtitleMd lg:text-aboutSubtitleLg ml-4 mt-2 block translate-x-1/2 font-normal leading-none tracking-normal">
                            {subPrefix ? `${subPrefix} ` : ''}
                            <span className="text-coralRed">
                              <span className="motion-word-mask">
                                <span
                                  className="motion-word"
                                  style={{ ['--motion-delay' as string]: '240ms' }}
                                >
                                  {subAccent}
                                </span>
                              </span>
                            </span>
                          </span>
                        )}
                      </h2>

                      <div className="text-sand mt-4 w-auto max-w-prose text-lg font-light leading-relaxed tracking-normal sm:mt-5 md:ml-40 md:max-w-2xl md:text-xl lg:ml-80 lg:mt-6 lg:leading-9">
                        {paragraphs.map((para, pi) => (
                          <p
                            key={pi}
                            data-reveal-target=""
                            className={`motion-lift whitespace-pre-line ${pi > 0 ? 'mt-6' : ''}`}
                            style={{
                              ['--motion-at' as string]: `calc(var(--motion-copy-at) + ${pi * 90}ms)`,
                            }}
                          >
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Quick Notes belonging specifically to THIS Bio section */}
                    {sectionNotes.length > 0 && (
                      <div
                        data-reveal-target=""
                        className="mt-10 flex flex-col gap-8 sm:mt-12 sm:gap-10 md:ml-40 lg:ml-80"
                      >
                        {sectionNotes.map((note, ni) => (
                          <figure
                            key={note.id}
                            className="border-sand/30 motion-lift max-w-prose border-l pl-5 sm:pl-7"
                            style={{
                              ['--motion-at' as string]: `calc(${ni} * var(--motion-beat))`,
                            }}
                          >
                            <blockquote>
                              <p className="font-inter text-mutedBeige text-base font-normal not-italic leading-snug">
                                {renderMultiline(note.text)}
                              </p>
                              {note.subtext && (
                                <p className="text-sand/70 mt-2.5 max-w-prose text-sm font-light italic leading-relaxed tracking-normal">
                                  {renderMultiline(note.subtext)}
                                </p>
                              )}
                            </blockquote>
                            {note.author && (
                              <figcaption className="text-sand/70 mt-2.5 text-sm font-light italic">
                                — {note.author}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {/* SELECTED WORKS SECTION — 4 Dedicated Full-Page Categories */}
            <section
              id="work"
              tabIndex={-1}
              className="site-container text-mutedBeige relative mb-28 overflow-x-clip pt-8 outline-none sm:pt-16"
            >
              {(() => {
                const hw = (siteConfig.worksIntro.headline || 'Selected works').trim().split(/\s+/);
                const hMain = hw.slice(0, -1).join(' ');
                const hAccent = hw[hw.length - 1] ?? '';
                return (
                  <h2
                    data-reveal-target=""
                    className="font-accent text-sectionDisplay leading-14 sm:text-sectionDisplaySm md:text-sectionDisplayMd lg:text-sectionDisplayLg mb-8 mt-6 whitespace-normal font-normal tracking-tight sm:leading-none sm:tracking-normal"
                  >
                    {hMain && (
                      <>
                        <span className="motion-word-mask">
                          <span
                            className="motion-word"
                            style={{ ['--motion-delay' as string]: '0ms' }}
                          >
                            {hMain}
                          </span>
                        </span>{' '}
                      </>
                    )}
                    <span className="font-accent text-coralRed font-normal">
                      <span className="motion-word-mask">
                        <span
                          className="motion-word"
                          style={{ ['--motion-delay' as string]: '130ms' }}
                        >
                          {hAccent}
                        </span>
                      </span>
                    </span>
                  </h2>
                );
              })()}

              <div className="flex flex-col gap-y-14 md:flex-row md:items-start md:gap-x-16 md:gap-y-0 lg:gap-x-20 xl:gap-x-28">
                <div
                  data-work-intro="true"
                  className="text-sand/90 flex w-full max-w-md flex-col gap-5 text-sm font-light italic leading-6 md:min-w-0 md:max-w-none md:grow-[2] md:basis-0 lg:gap-6 lg:text-base lg:leading-7"
                >
                  {siteConfig.worksIntro.introText
                    .split(/\n\s*\n/)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((para, pi) => (
                      <p
                        key={pi}
                        data-reveal-target=""
                        className="motion-lift whitespace-pre-line text-pretty"
                        style={{
                          ['--motion-at' as string]: `calc(var(--motion-copy-at) + ${pi * 90}ms)`,
                        }}
                      >
                        {para}
                      </p>
                    ))}
                </div>

                <div className="flex w-full flex-col md:min-w-0 md:grow-[3] md:basis-0 lg:mt-8">
                  {WORK_CATEGORIES.map((category, idx) => {
                    const isLast = idx === WORK_CATEGORIES.length - 1;
                    const meta = siteConfig.worksIntro.categories[category.id] ?? category;
                    const words = meta.title.split(' ');
                    const itemCount = workItems.filter(
                      (i) => i.categoryId === category.id && i.status !== 'draft'
                    ).length;

                    return (
                      <a
                        key={category.id}
                        href={category.slug}
                        data-reveal-target=""
                        onClick={(e) => {
                          e.preventDefault();
                          openCategoryPage(category.id);
                        }}
                        onMouseEnter={() => setCursorOpen(true)}
                        onMouseLeave={() => setCursorOpen(false)}
                        className={`motion-link motion-project group relative block cursor-pointer rounded-xl pb-8 text-left active:scale-[0.99] lg:pb-10 xl:pb-11 ${
                          idx > 0 ? 'pt-8 lg:pt-10 xl:pt-11' : ''
                        }`}
                      >
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6 md:flex-col md:gap-4 xl:flex-row xl:gap-10">
                          <div className="font-inter text-mutedBeige w-20 shrink-0 text-6xl font-semibold leading-none tracking-tighter opacity-20 transition-opacity duration-300 group-hover:opacity-35 group-focus-visible:opacity-35 sm:w-24 sm:text-7xl lg:w-28 lg:text-8xl xl:w-32">
                            <span className="motion-lift block">{category.number}</span>
                          </div>

                          <div className="min-w-0 flex-1 rounded">
                            <h3 className="text-workProject motion-link group-hover:text-sand group-focus-visible:text-sand mb-2.5 font-normal leading-9 tracking-tight sm:text-4xl sm:leading-snug lg:mb-3.5">
                              {words.map((w, wi) => (
                                <span
                                  key={`${category.id}-${wi}`}
                                  className="motion-word-mask mr-2"
                                >
                                  <span
                                    className="motion-word"
                                    style={{ ['--motion-delay' as string]: `${80 + wi * 55}ms` }}
                                  >
                                    {w}
                                  </span>
                                </span>
                              ))}
                            </h3>

                            <p
                              className="motion-lift text-sand/85 group-hover:text-sand group-focus-visible:text-sand mb-4 max-w-prose text-base font-light leading-7 xl:text-lg xl:leading-8"
                              style={{ ['--motion-at' as string]: 'var(--motion-copy-at)' }}
                            >
                              {meta.summary}
                            </p>

                            <p
                              className="motion-lift mb-5 flex items-baseline gap-2.5"
                              style={{
                                ['--motion-at' as string]: 'calc(var(--motion-copy-at) + 90ms)',
                              }}
                            >
                              <span className="font-inter text-coralRed text-3xl font-semibold tabular-nums leading-none tracking-tight">
                                {String(itemCount).padStart(2, '0')}
                              </span>
                              <span className="text-sand/75 text-sm">
                                {itemCount === 1 ? 'uploaded project' : 'uploaded projects'}
                              </span>
                            </p>

                            <span
                              className="motion-lift motion-link text-mutedBeige group-hover:text-sand group-focus-visible:text-sand inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-normal uppercase tracking-wider"
                              style={{
                                ['--motion-at' as string]: 'calc(var(--motion-copy-at) + 180ms)',
                              }}
                            >
                              {meta.ctaLabel}
                              <ArrowRight />
                            </span>
                          </div>
                        </div>

                        {!isLast && (
                          <>
                            <hr
                              aria-hidden="true"
                              className="motion-draw bg-mutedBeige/30 pointer-events-none absolute inset-x-0 bottom-0 h-px border-0"
                              style={{
                                ['--motion-at' as string]: 'calc(var(--motion-copy-at) + 270ms)',
                              }}
                            />
                            <span
                              aria-hidden="true"
                              className="motion-hover-line bg-sand/70 pointer-events-none absolute inset-x-0 bottom-0 h-px"
                            />
                          </>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>

              <OpenCursor visible={cursorOpen} />
            </section>

            {/* CONTACT FOOTER */}
            <footer
              id="contact"
              tabIndex={-1}
              data-reveal-target=""
              className="text-mutedBeige relative flex min-h-[78vh] scroll-mt-20 flex-col justify-end overflow-hidden pb-[max(2.5rem,8svh)] pt-28 outline-none sm:pb-[max(4rem,14svh)]"
            >
              <div className="site-container relative z-10">
                <div className="mb-16">
                  <h2 className="font-accent text-sectionDisplay leading-14 sm:text-sectionDisplaySm md:text-sectionDisplayMd lg:text-sectionDisplayLg mb-4 mt-6 whitespace-normal font-normal tracking-tight sm:leading-none sm:tracking-normal">
                    <span className="motion-word-mask">
                      <span className="motion-word" style={{ ['--motion-delay' as string]: '0ms' }}>
                        {siteConfig.contact.headlineFirst}
                      </span>
                    </span>{' '}
                    <span className="font-accent text-coralRed font-normal">
                      <span className="motion-word-mask">
                        <span
                          className="motion-word"
                          style={{ ['--motion-delay' as string]: '130ms' }}
                        >
                          {siteConfig.contact.headlineAccent}
                        </span>
                      </span>
                    </span>
                  </h2>

                  <p
                    className="motion-lift text-sand/90 mb-8 max-w-prose text-base font-light leading-relaxed tracking-normal sm:text-lg lg:text-xl"
                    style={{ ['--motion-at' as string]: 'var(--motion-copy-at)' }}
                  >
                    {siteConfig.contact.description}
                  </p>

                  <div className="flex flex-row flex-wrap gap-x-6 gap-y-1 sm:gap-x-8">
                    {siteConfig.contact.socialLinks.map((link, idx) => (
                      <span
                        key={link.id}
                        className="motion-lift flex flex-none"
                        style={{
                          ['--motion-at' as string]: `calc(var(--motion-copy-at) + ${(idx + 1) * 90}ms)`,
                        }}
                      >
                        <a
                          href={link.href}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className="motion-link text-mutedBeige hover:text-sand focus-visible:text-sand inline-flex min-h-11 items-center gap-1 rounded-lg text-base font-normal uppercase active:translate-y-px active:opacity-70 lg:text-lg"
                        >
                          {link.label}
                          <ArrowUpRight />
                        </a>
                      </span>
                    ))}

                    <span
                      className="motion-lift flex flex-none"
                      style={{
                        ['--motion-at' as string]: `calc(var(--motion-copy-at) + ${(siteConfig.contact.socialLinks.length + 1) * 90}ms)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setResumeOpen(true)}
                        className="motion-link text-mutedBeige hover:text-sand focus-visible:text-sand inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg text-base font-normal uppercase active:translate-y-px active:opacity-70 lg:text-lg"
                      >
                        Resume
                        <ArrowUpRight />
                      </button>
                    </span>
                  </div>

                  {/* Divider line below social links + Contact toggle button */}
                  <div className="mt-7 max-w-2xl">
                    <hr className="bg-mutedBeige/25 mb-7 h-px border-none" />

                    <button
                      type="button"
                      onClick={() => setContactFormOpen((open) => !open)}
                      aria-expanded={contactFormOpen}
                      className="motion-link bg-sand text-darkCharcoal inline-flex cursor-pointer items-center gap-2.5 rounded-xl px-6 py-3 text-xs font-medium uppercase tracking-widest transition-opacity hover:opacity-90"
                    >
                      <span>Contact</span>
                      <svg
                        aria-hidden="true"
                        className={`size-4 transition-transform duration-200 ${
                          contactFormOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* Interactive Project Requirement Form -> Opens when Contact button is clicked */}
                  <AnimatePresence initial={false}>
                    {contactFormOpen && (
                      <motion.div
                        key="contact-form-panel"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ContactForm
                          categoryOverrides={siteConfig.worksIntro.categories}
                          onSubmitted={(created) =>
                            setInquiries((prev) => [
                              created,
                              ...prev.filter((i) => i.id !== created.id),
                            ])
                          }
                          onClose={() => setContactFormOpen(false)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mb-8">
                  <hr
                    className="motion-draw bg-mutedBeige h-px border-none opacity-50"
                    style={{ ['--motion-at' as string]: 'calc(var(--motion-copy-at) + 450ms)' }}
                  />
                </div>

                <div
                  className="motion-lift text-mutedBeige/85 flex flex-col justify-between gap-6 font-normal sm:flex-row"
                  style={{ ['--motion-at' as string]: 'calc(var(--motion-copy-at) + 540ms)' }}
                >
                  <p className="text-sm sm:text-base">
                    Designed &amp; developed by{' '}
                    <FooterNameEasterEgg className="font-accent text-sand text-xl font-normal leading-none sm:text-2xl">
                      {siteConfig.contact.footerCreditName}
                    </FooterNameEasterEgg>
                  </p>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-sm sm:text-base">{siteConfig.contact.copyrightText}</p>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </main>
      )}

      {resumeOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-white" />}>
          <ResumeDialog
            open={resumeOpen}
            resume={siteConfig.resume}
            onClose={() => setResumeOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
