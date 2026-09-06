'use client';

import { useParams, useRouter } from 'next/navigation';
import { MessagesSquare, MousePointer2 } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { setCookie, HYPHA_COHERENT_MODE } from '@hypha-platform/cookie';

const COOKIE_MAX_AGE_DAYS = 365;
const COHERENT_ROUTE = 'coherent-intelligent-system';

type Mode = 'coherent' | 'classic';

export interface CoherentModeToggleProps {
  /** Which surface is showing now — that segment renders active. */
  activeMode: Mode;
  className?: string;
}

/**
 * #2486 M7 — bidirectional switch between the talk-first Coherent entrypoint and
 * the classic mouse-driven app. Persists the choice via `HYPHA_COHERENT_MODE`
 * (`classic` suppresses the coherent-first redirects; any other value restores
 * them) and navigates to the matching home.
 *
 * Rendered in the classic navbar (`ConnectedMenuTop`) and as the Coherent
 * shell's mode-toggle slot.
 */
export function CoherentModeToggle({
  activeMode,
  className,
}: CoherentModeToggleProps) {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';

  const go = (mode: Mode) => {
    if (mode === activeMode) return;
    setCookie(
      HYPHA_COHERENT_MODE,
      mode,
      new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
    );
    router.push(
      mode === 'coherent' ? `/${lang}/${COHERENT_ROUTE}` : `/${lang}/my-spaces`,
    );
  };

  return (
    <div
      className={cn(
        'inline-flex rounded-full border border-border/70 bg-background/80 p-0.5 shadow-sm',
        className,
      )}
      role="group"
      aria-label="Switch between Coherent and the classic app"
    >
      <button
        type="button"
        onClick={() => go('coherent')}
        aria-pressed={activeMode === 'coherent'}
        title="Coherent"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          activeMode === 'coherent'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <MessagesSquare className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Coherent</span>
      </button>
      <button
        type="button"
        onClick={() => go('classic')}
        aria-pressed={activeMode === 'classic'}
        title="Classic app"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          activeMode === 'classic'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <MousePointer2 className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Classic</span>
      </button>
    </div>
  );
}
