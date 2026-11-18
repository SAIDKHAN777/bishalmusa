import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface HeaderProps {
  activeSection: 'hero' | 'about' | 'work' | 'contact';
  scrolledAway: boolean;
  roleLabel: string;
  onOpenResume: () => void;
  onNavigateSection: (sectionId: 'about' | 'work' | 'contact') => void;
}

const NAV_ITEMS: { id: 'about' | 'work' | 'contact'; label: string; href: string }[] = [
  { id: 'about', label: 'About', href: '/#about' },
  { id: 'work', label: 'Work', href: '/#work' },
  { id: 'contact', label: 'Contact', href: '/#contact' },
];

export function Header({
  activeSection,
  scrolledAway,
  roleLabel,
  onOpenResume,
  onNavigateSection,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="bg-sand text-darkCharcoal fixed left-3 top-3 z-50 -translate-y-48 rounded-lg px-4 py-3 text-sm font-medium transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <header
        data-away={scrolledAway ? 'true' : 'false'}
        className="site-header text-mutedBeige inset-x-0 top-0 box-border w-full px-4 py-5 font-light sm:py-9 lg:px-6 2xl:px-8"
      >
        {/* 5-Layer Progressive Backdrop Blur Mask */}
        <div aria-hidden="true" className="site-header__backdrop">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="flex flex-row items-center justify-between">
          <nav
            aria-label="Primary"
            className="flex items-center gap-3 text-base uppercase sm:gap-6 sm:text-lg lg:gap-9 lg:text-xl"
          >
            {NAV_ITEMS.map((item) => {
              const isCurrent = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateSection(item.id);
                  }}
                  aria-current={isCurrent ? 'location' : undefined}
                  className={`motion-link hover:text-sand focus-visible:text-sand relative z-10 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg uppercase leading-none active:translate-y-px active:opacity-70 ${
                    isCurrent ? 'text-sand font-medium' : 'text-mutedBeige font-normal'
                  }`}
                >
                  {/* Zero-CLS bold hover/active grid stack */}
                  <span className="inline-grid">
                    <span
                      aria-hidden="true"
                      className="invisible col-start-1 row-start-1 font-medium"
                    >
                      {item.label}
                    </span>
                    <span className="col-start-1 row-start-1">{item.label}</span>
                  </span>
                </a>
              );
            })}
          </nav>

          <div className="z-10 flex items-center">
            <button
              type="button"
              onClick={onOpenResume}
              className="motion-link text-mutedBeige hover:text-sand focus-visible:text-sand inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg text-base font-normal uppercase active:translate-y-px active:opacity-70 sm:text-lg lg:text-xl"
            >
              Resume
              <svg
                aria-hidden="true"
                className="motion-arrow size-5 shrink-0"
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
            </button>

            <span className="border-mutedBeige/30 text-mutedBeige/80 ml-8 hidden border-l pl-8 text-base font-light leading-none lg:inline">
              {roleLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Floating Nav Button when scrolled */}
      <div
        className={`fixed right-0 top-0 z-40 transition-transform duration-300 md:hidden ${
          scrolledAway ? 'pointer-events-auto scale-100' : 'pointer-events-none scale-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? 'Close site navigation' : 'Open site navigation'}
          aria-expanded={mobileMenuOpen}
          className="bg-mutedBeige/20 text-sand hover:bg-mutedBeige/30 relative m-4 inline-flex size-14 cursor-pointer items-center justify-center rounded-full backdrop-blur-3xl active:scale-95"
        >
          <span className="relative flex w-full items-center justify-center" aria-hidden="true">
            <span
              className={`bg-sand absolute block h-px w-2/5 transition-transform duration-200 ${
                mobileMenuOpen ? 'translate-y-0 rotate-45' : 'translate-y-1'
              }`}
            />
            <span
              className={`bg-sand absolute block h-px w-2/5 transition-transform duration-200 ${
                mobileMenuOpen ? 'translate-y-0 -rotate-45' : '-translate-y-1'
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-30 flex flex-col justify-center gap-8 bg-white/95 px-8 backdrop-blur-2xl md:hidden"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onNavigateSection(item.id);
                }}
                className="font-accent text-sand hover:text-coralRed text-5xl transition-colors"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenResume();
              }}
              className="font-accent text-mutedBeige hover:text-sand w-fit cursor-pointer text-left text-4xl"
            >
              Resume ↗
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
