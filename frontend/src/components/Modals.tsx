import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SiteConfig } from '../data/siteStore';
import { loadResumePdfFile } from '../data/resumePdfStore';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface ResumeDialogProps {
  open: boolean;
  resume: SiteConfig['resume'];
  onClose: () => void;
}

/**
 * Full-page pure-white (#ffffff) in-app Resume PDF viewer.
 * Zero dark overlay, zero dark browser PDF bars — crisp HiDPI PDF pages on pure white.
 */
export function ResumeDialog({ open, resume, onClose }: ResumeDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('/resume-default.pdf');
  const [fileName, setFileName] = useState<string>('Bishal-Musa-Resume.pdf');
  const [zoom, setZoom] = useState<number>(1.25);

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      // 1. Prefer server-persisted Resume PDF from PostgreSQL (/api/uploads/...)
      if (resume.externalPdfUrl?.trim()) {
        setPdfUrl(resume.externalPdfUrl.trim());
        setFileName(resume.pdfFileName?.trim() || 'Bishal-Musa-Resume.pdf');
        return;
      }

      // 2. Fallback to local IndexedDB if present
      const stored = await loadResumePdfFile();
      if (cancelled) return;

      if (stored) {
        objectUrl = URL.createObjectURL(stored.blob);
        setPdfUrl(objectUrl);
        setFileName(stored.fileName || 'Resume.pdf');
      } else {
        setPdfUrl('/resume-default.pdf');
        setFileName('Bishal-Musa-Resume.pdf');
      }
    };

    load();
    const onResumeUpdated = () => load();
    window.addEventListener('portfolio-resume-updated', onResumeUpdated);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    // Lock body scroll while full-page white resume viewer is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('portfolio-resume-updated', onResumeUpdated);
      window.removeEventListener('keydown', onKeyDown);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, resume.externalPdfUrl, resume.pdfFileName, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Resume PDF Viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex flex-col bg-white text-black"
        >
          {/* Pure White Top Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white px-4 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-black/70 transition-colors hover:text-black"
              >
                ← Back
              </button>
              <span className="h-3.5 w-px bg-black/15" />
              <span className="text-coralRed text-[11px] font-semibold uppercase tracking-[0.2em]">
                Resume
              </span>
              <span className="hidden truncate text-sm font-medium text-black sm:inline">
                {fileName}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Zoom Controls */}
              <div className="hidden items-center rounded-lg border border-black/15 bg-white sm:inline-flex">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.15).toFixed(2))))}
                  aria-label="Zoom out"
                  className="cursor-pointer px-2.5 py-1.5 text-xs font-medium text-black hover:bg-black/5"
                >
                  −
                </button>
                <span className="px-2 text-[11px] font-medium tabular-nums text-black/70">
                  {Math.round((zoom / 1.25) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                  aria-label="Zoom in"
                  className="cursor-pointer px-2.5 py-1.5 text-xs font-medium text-black hover:bg-black/5"
                >
                  +
                </button>
              </div>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/5"
              >
                Open Full Tab ↗
              </a>
              <a
                href={pdfUrl}
                download={fileName}
                className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Download PDF ↓
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close resume viewer"
                className="cursor-pointer rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black/70 transition-colors hover:border-black/40 hover:text-black"
              >
                ESC
              </button>
            </div>
          </div>

          {/* 100% Pure White Scrollable PDF Canvas Area */}
          <div className="w-full flex-1 overflow-y-auto bg-white">
            <PdfCanvasViewer pdfUrl={pdfUrl} scale={zoom} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
