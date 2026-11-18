import { useState } from 'react';
import { type ContactInquiry } from '../data/inquiryStore';
import { WORK_CATEGORIES } from '../data/workStore';
import type { CategoryMetaOverride } from '../data/siteStore';
import type { WorkCategoryId } from '../data/workStore';
import { submitPublicInquiry } from '../lib/api';

interface ContactFormProps {
  categoryOverrides: Record<WorkCategoryId, CategoryMetaOverride>;
  onSubmitted?: (inquiry: ContactInquiry) => void;
  onClose?: () => void;
}

export function ContactForm({ categoryOverrides, onSubmitted, onClose }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState<string>(
    categoryOverrides['video-editing']?.title ?? 'Video Editing'
  );
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const serviceOptions = [
    ...WORK_CATEGORIES.map((c) => categoryOverrides[c.id]?.title ?? c.title),
    'Other / General Inquiry',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Please enter your name.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('Please enter a valid email address.');
    }
    if (message.trim().length < 3) return setError('Please describe your project requirements.');

    setSubmitting(true);
    try {
      const created = await submitPublicInquiry({
        name: name.trim(),
        email: email.trim(),
        service,
        budget: budget.trim() || undefined,
        message: message.trim(),
      });
      onSubmitted?.(created);
      setName('');
      setEmail('');
      setBudget('');
      setMessage('');
      setSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not send requirement. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-black/12 shadow-xs mt-6 max-w-2xl rounded-2xl border bg-white p-6 sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-coralRed mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
            Start a Project
          </p>
          <h3 className="text-sand text-xl font-medium sm:text-2xl">
            Share your project requirements
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact form"
            className="border-black/12 cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-black/60 transition-colors hover:border-black/30 hover:text-black"
          >
            Close
          </button>
        )}
      </div>

      {sent ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-6">
          <p className="text-base font-medium text-emerald-950">Requirement sent successfully!</p>
          <p className="text-sm font-light text-emerald-900/80">
            Thank you for reaching out. Your project details have been received and are now visible
            in the studio inbox.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="cursor-pointer rounded-lg bg-black px-4 py-2 text-xs font-medium uppercase tracking-wider text-white hover:opacity-90"
          >
            Send another requirement
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contact-name"
                className="text-sand/70 mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
              >
                Your Name *
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Carter"
                className="text-sand w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="text-sand/70 mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
              >
                Email Address *
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="text-sand w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contact-service"
                className="text-sand/70 mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
              >
                Service Needed
              </label>
              <select
                id="contact-service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="text-sand w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
              >
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-budget"
                className="text-sand/70 mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
              >
                Budget / Timeline (Optional)
              </label>
              <input
                id="contact-budget"
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $1,000 · 2 weeks"
                className="text-sand w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="text-sand/70 mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
            >
              Project Requirements *
            </label>
            <textarea
              id="contact-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell me about your video, design, motion, or campaign goals..."
              className="text-sand w-full resize-y rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-black"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="motion-link bg-sand text-darkCharcoal inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-xs font-medium uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send Requirement'}
            <svg
              aria-hidden="true"
              className="motion-arrow size-4"
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
          </button>
        </form>
      )}
    </div>
  );
}
