'use client';

import * as React from 'react';
import { Telescope } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { DrillDescriptor } from './types';

/**
 * #2486 M9/M10 — shared frame around every rendered canvas widget. It owns a
 * consistent **header row** (the widget's title on the left, a "dig deeper"
 * control on the right) so the affordance never overlaps the widget's own
 * content, and the widget body renders below it. The card treatment
 * (border / radius / surface) also lives here, matching Hypha's card vocabulary.
 *
 * "Dig deeper" fires a NORMAL model turn via the shell's submit funnel; the
 * model composes the question and decides what to show. Slice 1 wires only the
 * widget-level control; row-level drill flows through the widget-event channel.
 *
 * Presentational + generic: no `@hypha-platform/core|epics` imports.
 */
export interface WidgetFrameProps {
  /** Header title (the widget's registry title). */
  title: string;
  /** Widget-level drill descriptor. Absent → no "dig deeper" control. */
  drill?: DrillDescriptor;
  /** Fires the drill-in turn. Absent → the control is not rendered. */
  onDrillIn?: (descriptor: DrillDescriptor) => void;
  /** A turn is in flight — disable the control. */
  busy?: boolean;
  /** Localised control label. */
  drillLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function WidgetFrame({
  title,
  drill,
  onDrillIn,
  busy = false,
  drillLabel = 'Dig deeper',
  children,
  className,
}: WidgetFrameProps) {
  const showControl = Boolean(drill && onDrillIn);
  const controlLabel =
    drill?.label && drill.label.trim()
      ? `${drillLabel}: ${drill.label.trim()}`
      : drillLabel;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background-2',
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <h3 className="min-w-0 truncate text-2 font-medium leading-snug text-foreground [font-family:var(--font-family-heading)]">
          {title}
        </h3>
        {showControl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => drill && onDrillIn?.(drill)}
            aria-label={controlLabel}
            title={controlLabel}
            className="-mr-1.5 h-6 shrink-0 gap-1 px-1.5 text-1 text-muted-foreground hover:text-foreground"
          >
            <Telescope className="size-3.5" />
            <span className="hidden sm:inline">{drillLabel}</span>
          </Button>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
