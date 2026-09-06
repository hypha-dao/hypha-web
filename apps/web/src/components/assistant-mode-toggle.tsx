'use client';

import { useParams, useRouter } from 'next/navigation';
import { MessagesSquare, MousePointer2 } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { setCookie, HYPHA_ASSISTANT_MODE } from '@hypha-platform/cookie';

const COOKIE_MAX_AGE_DAYS = 365;

type Mode = 'assistant' | 'classic';

export interface AssistantModeToggleProps {
  /** Which surface is showing now — that segment renders active. */
  activeMode: Mode;
  className?: string;
}

/**
 * #2486 M7 — bidirectional switch between the talk-first assistant and the
 * classic mouse-driven app. Persists the choice via `HYPHA_ASSISTANT_MODE`
 * (`classic` suppresses the assistant-first redirects; any other value restores
 * them) and navigates to the matching home.
 *
 * Rendered in the classic navbar (`ConnectedMenuTop`) and as the assistant
 * shell's mode-toggle slot.
 */
export function AssistantModeToggle({
  activeMode,
  className,
}: AssistantModeToggleProps) {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';

  const go = (mode: Mode) => {
    if (mode === activeMode) return;
    setCookie(
      HYPHA_ASSISTANT_MODE,
      mode,
      new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
    );
    router.push(
      mode === 'assistant' ? `/${lang}/assistant` : `/${lang}/my-spaces`,
    );
  };

  return (
    <div
      className={cn(
        'inline-flex rounded-full border border-border/70 bg-background/80 p-0.5 shadow-sm',
        className,
      )}
      role="group"
      aria-label="Switch between the assistant and the classic app"
    >
      <button
        type="button"
        onClick={() => go('assistant')}
        aria-pressed={activeMode === 'assistant'}
        title="Assistant"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          activeMode === 'assistant'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <MessagesSquare className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Assistant</span>
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
