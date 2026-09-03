import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  children,
  variant = 'solid',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'agent';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-full font-medium tracking-[-0.01em] transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-10 px-4.5 text-[14px]' : 'h-8 px-3.5 text-[13px]',
        variant === 'solid' && 'bg-ink text-white hover:bg-ink/85',
        variant === 'soft' && 'bg-chip text-ink hover:bg-hair',
        variant === 'outline' &&
          'border border-hair bg-paper text-ink hover:bg-wash',
        variant === 'ghost' && 'text-sub hover:bg-chip hover:text-ink',
        variant === 'agent' && 'bg-agent text-white hover:bg-agent/90',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  onClick,
  delay,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  delay?: 0 | 1 | 2 | 3;
}) {
  const riseCls = delay ? `rise-${delay}` : 'rise';
  const base = cn(
    'rounded-2xl border border-hair bg-paper p-5',
    riseCls,
    onClick &&
      'w-full cursor-pointer text-left transition-all duration-150 hover:border-faint/50 hover:bg-wash active:scale-[0.995]',
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {children}
      </button>
    );
  }
  return <div className={base}>{children}</div>;
}

export function Kicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.1em] text-faint',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
      {children}
    </h1>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'agent' | 'money';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium',
        tone === 'neutral' && 'bg-chip text-sub',
        tone === 'agent' && 'bg-agent-soft text-agent',
        tone === 'money' && 'bg-ink text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

const AVATAR_TONES = [
  'bg-[#e8ede4] text-[#4a5a42]',
  'bg-[#e9e4ee] text-[#54486a]',
  'bg-[#ede8e0] text-[#6a5a40]',
  'bg-[#e0eaec] text-[#3e5b62]',
  'bg-[#eee4e4] text-[#6a4848]',
];

export function Avatar({
  name,
  size = 'md',
  square,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  square?: boolean;
}) {
  const tone =
    AVATAR_TONES[(name.charCodeAt(0) + name.length) % AVATAR_TONES.length];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold',
        square ? 'rounded-xl' : 'rounded-full',
        size === 'sm' && 'h-7 w-7 text-[11px]',
        size === 'md' && 'h-9 w-9 text-[13px]',
        size === 'lg' && 'h-11 w-11 text-[15px]',
        tone,
      )}
    >
      {name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}

export function AgentMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-agent-soft"
      style={{ width: size + 14, height: size + 14 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="text-agent"
        />
        <circle
          cx="12"
          cy="12"
          r="3.2"
          fill="currentColor"
          className="text-agent"
        />
      </svg>
    </span>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rise flex flex-col items-center justify-center gap-2 py-24 text-center">
      <span className="mb-2 h-10 w-10 rounded-full border border-hair" />
      <p className="text-[17px] font-medium tracking-[-0.02em] text-ink">
        {title}
      </p>
      {sub && (
        <p className="max-w-xs text-[14px] leading-relaxed text-sub">{sub}</p>
      )}
    </div>
  );
}

export function Hairbar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-chip">
      <div
        className="h-full rounded-full bg-ink transition-all duration-500"
        style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

export function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hair py-2.5 last:border-0">
      <span className="text-[14px] text-sub">{label}</span>
      <span
        className={cn(
          'text-[14px] tabular-nums',
          strong ? 'font-semibold text-ink' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}
