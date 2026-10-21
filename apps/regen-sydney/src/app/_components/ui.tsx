'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '../_lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--rs-peach)] text-[var(--rs-ink)] hover:bg-[var(--rs-clay)] hover:text-[var(--rs-white)]',
  secondary:
    'bg-[var(--rs-ink)] text-[var(--rs-white)] hover:bg-[var(--rs-teal)]',
  ghost:
    'border border-[var(--rs-ink)] text-[var(--rs-ink)] hover:bg-[var(--rs-ink)] hover:text-[var(--rs-white)]',
  quiet:
    'border border-[var(--rs-line)] bg-[var(--rs-white)] text-[var(--rs-ink)] hover:border-[var(--rs-ink)]',
};

export function RsButton({
  variant = 'primary',
  className,
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      {...props}
      className={cn(
        'rs-eyebrow rs-focus inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-4 py-2' : 'px-6 py-3',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Pill({
  children,
  tone = 'aqua',
  className,
}: {
  children: React.ReactNode;
  tone?: 'aqua' | 'peach' | 'outline';
  className?: string;
}) {
  const tones = {
    aqua: 'bg-[var(--rs-aqua)] text-[var(--rs-ink)]',
    peach: 'bg-[var(--rs-peach)] text-[var(--rs-ink)]',
    outline: 'border border-[var(--rs-line)] text-[var(--rs-ink-soft)]',
  } as const;
  return (
    <span
      className={cn(
        'rs-eyebrow inline-flex items-center rounded-full px-3 py-1',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow ? (
        <p className="rs-eyebrow mb-3 text-[var(--rs-clay)]">{eyebrow}</p>
      ) : null}
      <h2 className="rs-heading text-3xl sm:text-4xl">{title}</h2>
      {lede ? (
        <p className="rs-prose mt-4 text-lg text-[var(--rs-ink-soft)]">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The curved section transitions are the most recognisable motif on
 * regen.sydney. `from`/`to` are the colours either side of the curve.
 */
export function Wave({
  from,
  to,
  flip = false,
  className,
}: {
  from: string;
  to: string;
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('relative h-16 w-full sm:h-24', className)}
      style={{ background: from }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className={cn('absolute inset-0 h-full w-full', flip && 'rotate-180')}
      >
        <path
          d="M0,64 C240,120 480,0 720,24 C960,48 1200,120 1440,72 L1440,120 L0,120 Z"
          fill={to}
        />
      </svg>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[hsl(0_0%_7%/0.45)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'rs-enter rs-focus relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--rs-sand)] p-6 shadow-2xl sm:rounded-3xl sm:p-8',
          width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="rs-heading text-2xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rs-focus -mr-1 -mt-1 rounded-full p-1 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-ink)]"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="rs-eyebrow mb-2 block text-[var(--rs-ink-soft)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="rs-ui mt-1.5 block text-xs text-[var(--rs-ink-faint)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'rs-ui rs-focus w-full rounded-xl border border-[var(--rs-line)] bg-[var(--rs-white)] px-4 py-2.5 text-sm text-[var(--rs-ink)] placeholder:text-[var(--rs-ink-faint)]';

export function ShareBar({
  share,
  yourShare = 0,
}: {
  share: number;
  yourShare?: number;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--rs-cream-deep)]">
      <div className="flex h-full">
        <div
          className="h-full bg-[var(--rs-aqua)] transition-[width] duration-300"
          style={{ width: `${Math.max(0, (share - yourShare) * 100)}%` }}
        />
        <div
          className="h-full bg-[var(--rs-clay)] transition-[width] duration-300"
          style={{ width: `${Math.max(0, yourShare * 100)}%` }}
        />
      </div>
    </div>
  );
}
