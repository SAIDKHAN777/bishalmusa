import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { FOOTER_HOVER_CARDS } from '../data/portfolio';

interface FooterNameEasterEggProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reconstructs the observed $e component in the footer:
 * Hovering over the designer's name spawns a React Portal cycling card deck following the cursor.
 */
export function FooterNameEasterEgg({ children, className }: FooterNameEasterEggProps) {
  const [hovered, setHovered] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 360, damping: 30, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 360, damping: 30, mass: 0.5 });

  useEffect(() => {
    if (!hovered) return;
    const timer = window.setInterval(() => {
      setCardIndex((prev) => (prev + 1) % FOOTER_HOVER_CARDS.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [hovered]);

  const card = FOOTER_HOVER_CARDS[cardIndex];

  return (
    <>
      <span
        className={`${className ?? ''} cursor-pointer`}
        onMouseEnter={(e) => {
          rawX.jump(e.clientX);
          rawY.jump(e.clientY);
          setHovered(true);
        }}
        onMouseMove={(e) => {
          rawX.set(e.clientX);
          rawY.set(e.clientY);
        }}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </span>

      {typeof document !== 'undefined' &&
        createPortal(
          <motion.div
            aria-hidden="true"
            style={{ x, y }}
            className="pointer-events-none fixed left-0 top-0 z-50 hidden md:block"
          >
            <motion.div
              animate={
                hovered
                  ? { opacity: 1, scale: 1, y: -118, x: -96 }
                  : { opacity: 0, scale: 0.9, y: -106, x: -96 }
              }
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="w-56 rounded-xl border border-black/15 bg-white/95 p-3.5 shadow-2xl backdrop-blur-2xl"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className="text-[11px] font-medium uppercase tracking-widest"
                  style={{ color: card.accent }}
                >
                  {card.tag}
                </span>
                <span className="text-mutedBeige/60 text-[10px] tabular-nums">
                  0{cardIndex + 1}/0{FOOTER_HOVER_CARDS.length}
                </span>
              </div>
              <p className="text-sand/90 text-xs font-light leading-relaxed">{card.caption}</p>
            </motion.div>
          </motion.div>,
          document.body
        )}
    </>
  );
}
