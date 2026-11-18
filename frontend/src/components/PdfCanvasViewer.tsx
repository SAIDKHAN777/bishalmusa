import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfCanvasViewerProps {
  pdfUrl: string;
  scale?: number;
}

/**
 * Renders every page of a PDF directly onto HiDPI <canvas> elements
 * over a 100% pure white (#ffffff) background — completely eliminating
 * Chrome's dark grey PDF toolbar and sidebar chrome.
 */
export function PdfCanvasViewer({ pdfUrl, scale = 1.25 }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    let activeTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    const controller = new AbortController();
    const container = containerRef.current;
    if (!container) return;

    setStatus('loading');
    container.innerHTML = '';

    const run = async () => {
      try {
        const res = await fetch(pdfUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        activeTask = pdfjsLib.getDocument({ data });
        const pdf = await activeTask.promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const availWidth = container.clientWidth > 120 ? container.clientWidth - 24 : 880;
        const maxWidth = Math.min(availWidth, 920);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const unscaledViewport = page.getViewport({ scale: 1 });
          const fitScale = (maxWidth / unscaledViewport.width) * (scale / 1.25);
          const cssViewport = page.getViewport({ scale: fitScale });
          const renderViewport = page.getViewport({ scale: fitScale * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);
          canvas.style.width = `${Math.floor(cssViewport.width)}px`;
          canvas.style.height = `${Math.floor(cssViewport.height)}px`;
          canvas.className =
            'block mx-auto bg-white rounded-lg shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-black/8';

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          container.appendChild(canvas);

          await page.render({
            canvasContext: ctx,
            viewport: renderViewport,
            canvas,
          }).promise;
        }

        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        console.error('PDF render error:', err);
        setStatus('error');
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
      activeTask?.destroy().catch(() => {});
    };
  }, [pdfUrl, scale]);

  return (
    <div className="min-h-full w-full bg-white px-3 py-8 sm:px-6">
      {status === 'loading' && (
        <div className="py-16 text-center text-sm text-black/50">Rendering PDF...</div>
      )}
      {status === 'error' && (
        <div className="space-y-3 py-16 text-center text-sm text-black/65">
          <p>Could not render PDF inline.</p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-black px-4 py-2 text-xs font-medium text-white"
          >
            Open PDF in New Tab ↗
          </a>
        </div>
      )}
      <div ref={containerRef} className="space-y-6 bg-white" />
      {status === 'ready' && pageCount > 1 && (
        <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-black/40">
          {pageCount} Pages
        </p>
      )}
    </div>
  );
}
