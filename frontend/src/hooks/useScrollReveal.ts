import { useEffect, type RefObject } from 'react';

/**
 * Zero-JS-overhead scroll reveal hook reconstructed from REA analysis of useScrollReveal.
 * Observes matching targets below the fold and flips data-scroll-reveal="pending" -> "visible".
 */
export function useScrollReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector?: string,
  revealAt = 0.88
) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !('IntersectionObserver' in window)) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const elements: HTMLElement[] = selector
      ? Array.from(root.querySelectorAll<HTMLElement>(selector))
      : [root];

    if (mq.matches) {
      for (const el of elements) el.dataset.scrollReveal = 'visible';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          target.dataset.scrollReveal = 'visible';
          observer.unobserve(target);
        }
      },
      {
        rootMargin: `0px 0px -${Math.round((1 - revealAt) * 100)}% 0px`,
        threshold: 0,
      }
    );

    for (const el of elements) {
      if (el.getBoundingClientRect().top > window.innerHeight * revealAt) {
        el.dataset.scrollReveal = 'pending';
        observer.observe(el);
      } else {
        el.dataset.scrollReveal = 'visible';
      }
    }

    const onReduceChange = () => {
      if (mq.matches) {
        for (const el of elements) el.dataset.scrollReveal = 'visible';
        observer.disconnect();
      }
    };

    mq.addEventListener('change', onReduceChange);
    return () => {
      observer.disconnect();
      mq.removeEventListener('change', onReduceChange);
    };
  }, [containerRef, selector, revealAt]);
}
