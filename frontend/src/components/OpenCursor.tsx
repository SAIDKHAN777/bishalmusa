import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface OpenCursorProps {
  visible: boolean;
  label?: string;
}

export function OpenCursor({ visible, label = 'Open' }: OpenCursorProps) {
  const rawX = useMotionValue(-120);
  const rawY = useMotionValue(-120);
  const x = useSpring(rawX, { stiffness: 420, damping: 34, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 420, damping: 34, mass: 0.5 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [rawX, rawY]);

  return (
    <motion.div
      aria-hidden="true"
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-40 -ml-10 -mt-10 hidden md:block"
    >
      <motion.div
        animate={
          visible ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: 15, opacity: 0 }
        }
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="bg-sand text-darkCharcoal flex size-20 items-center justify-center rounded-full text-xs font-medium uppercase leading-none tracking-wider shadow-xl"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="ml-1"
        >
          <path
            d="M3.7875 15L3 14.2125L12.3375 4.875H6.825V3.75H14.25V11.175H13.125V5.6625L3.7875 15Z"
            fill="currentColor"
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
