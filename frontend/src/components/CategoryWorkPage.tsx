import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  WORK_CATEGORIES,
  type WorkCategory,
  type WorkCategoryId,
  type WorkItem,
} from '../data/workStore';
import type { CategoryMetaOverride } from '../data/siteStore';

interface CategoryWorkPageProps {
  category: WorkCategory;
  categoryOverrides: Record<WorkCategoryId, CategoryMetaOverride>;
  items: WorkItem[];
  onBackHome: () => void;
  onSelectCategory: (id: WorkCategoryId) => void;
}

export function CategoryWorkPage({
  category,
  categoryOverrides,
  items,
  onBackHome,
  onSelectCategory,
}: CategoryWorkPageProps) {
  const [lightboxItem, setLightboxItem] = useState<WorkItem | null>(null);

  useEffect(() => {
    if (!lightboxItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxItem]);

  const categoryItems = items.filter(
    (item) => item.categoryId === category.id && item.status !== 'draft'
  );
  const currentMeta = categoryOverrides[category.id] ?? category;
  const titleParts = currentMeta.title.split(' ');
  const firstPart = titleParts.slice(0, -1).join(' ');
  const lastWord = titleParts[titleParts.length - 1];

  return (
    <motion.div
      key={category.id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="text-mutedBeige min-h-screen bg-white pb-24 pt-28 sm:pt-36"
    >
      <div className="site-container">
        {/* Top bar: Back button + Open-Text Category Tabs with Active Underline */}
        <div className="border-mutedBeige/15 mb-12 flex flex-col gap-5 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="motion-link text-mutedBeige hover:text-sand inline-flex w-fit cursor-pointer items-center gap-2 text-sm uppercase tracking-wider"
          >
            <svg
              aria-hidden="true"
              className="motion-arrow size-4"
              data-direction="left"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 12H5m0 0 6 6m-6-6 6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Back to Selected Works
          </button>

          <nav aria-label="Work categories" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {WORK_CATEGORIES.map((cat) => {
              const active = cat.id === category.id;
              const catTitle = categoryOverrides[cat.id]?.title ?? cat.title;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative cursor-pointer pb-1.5 text-xs uppercase tracking-wider transition-colors ${
                    active
                      ? 'font-semibold text-black'
                      : 'font-normal text-black/45 hover:text-black/80'
                  }`}
                >
                  {cat.number} {catTitle}
                  {active && (
                    <motion.span
                      layoutId="active-category-underline"
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-black"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Full-Page Category Headline */}
        <header className="mb-14 sm:mb-16">
          <p className="text-coralRed mb-3 text-xs font-medium uppercase tracking-[0.22em]">
            Selected Works · {category.number}
          </p>

          <h1 className="font-accent text-sectionDisplay sm:text-sectionDisplaySm md:text-sectionDisplayMd lg:text-sectionDisplayLg text-sand font-normal leading-none">
            {firstPart} <span className="text-coralRed">{lastWord}</span>
          </h1>

          <p className="text-sand/80 mt-5 max-w-2xl text-base font-light leading-relaxed sm:text-lg">
            {currentMeta.summary}
          </p>
        </header>

        {/* Uploaded Works Thumbnail Grid */}
        {categoryItems.length === 0 ? (
          <div className="border-mutedBeige/30 rounded-2xl border border-dashed px-8 py-20 text-center">
            <p className="font-accent text-sand mb-2 text-3xl">
              No works published in {currentMeta.title} yet
            </p>
            <p className="text-sand/70 mx-auto max-w-md text-sm font-light">
              New projects for this category will appear here as soon as they are published.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {categoryItems.map((item, index) => {
              const hasLink =
                category.id !== 'digital-marketing' &&
                Boolean(item.workUrl && item.workUrl.trim().length > 0);
              const cardInner = (
                <>
                  {/* 16:9 Thumbnail / Photo */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black/5">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />

                    {/* Hover Overlay Pill */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25">
                      <span className="text-sand inline-flex scale-90 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-medium uppercase tracking-wider opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                        {!hasLink
                          ? 'View Photo'
                          : category.id === 'video-editing' || category.id === 'motion-graphics'
                            ? 'Watch Video'
                            : 'Open Work'}
                        {hasLink && (
                          <svg
                            aria-hidden="true"
                            className="size-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M7 17 17 7m0 0H8m9 0v9"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Card Meta */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-sand group-hover:text-coralRed text-left text-lg font-medium leading-snug transition-colors">
                        {item.title}
                      </h2>
                      {hasLink && (
                        <svg
                          aria-hidden="true"
                          className="text-mutedBeige/70 group-hover:text-coralRed mt-1 size-4 shrink-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
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
                      )}
                    </div>
                    {item.caption && (
                      <p className="text-sand/55 mt-1.5 text-left text-xs uppercase tracking-wider">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </>
              );

              if (hasLink) {
                return (
                  <motion.a
                    key={item.id}
                    href={item.workUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.42,
                      delay: index * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="border-mutedBeige/15 hover:border-sand/40 group block overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    {cardInner}
                  </motion.a>
                );
              }

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxItem(item)}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.42,
                    delay: index * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="border-mutedBeige/15 hover:border-sand/40 group block w-full cursor-pointer overflow-hidden rounded-2xl border bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {cardInner}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pure-White Full-Size Photo Lightbox (for Photo-Only Items like Digital Marketing) */}
      <AnimatePresence>
        {lightboxItem && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={lightboxItem.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxItem(null)}
            className="fixed inset-0 z-50 flex flex-col bg-white text-black"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="text-coralRed text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {currentMeta.title}
                </p>
                <h2 className="truncate text-base font-medium text-black sm:text-lg">
                  {lightboxItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="cursor-pointer rounded-lg border border-black/15 px-3.5 py-1.5 text-xs font-medium text-black hover:bg-black/5"
              >
                ESC
              </button>
            </div>
            <div
              className="flex flex-1 items-center justify-center overflow-auto bg-white p-6 sm:p-10"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxItem.thumbnailUrl}
                alt={lightboxItem.title}
                className="max-h-[82vh] max-w-full rounded-xl border border-black/10 object-contain shadow-lg"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
