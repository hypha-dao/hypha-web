'use client';

import * as React from 'react';
import { Telescope } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { DrillDescriptor } from './types';

/**
 * #2486 M9 — shared frame around every rendered canvas widget. It hosts the
 * "dig deeper" affordance: a control that fires a NORMAL model turn (via the
 * shell's submit funnel) carrying a structured hint. The model composes the
 * question and decides what to show — the button does not pick a widget.
 *
 * Slice 1 renders only the widget-level control (`drill.scope === 'widget'`).
 * Item/row-level drill-in and a second affordance class (client-side navigate,
 * no turn — M12) slot into the same `drill` descriptor without a widget change.
 *
 * Presentational + generic: no `@hypha-platform/core|epics` imports.
 */
export interface WidgetFrameProps {
  /** Accessible label for the region (the widget's title). */
  title: string;
  /** Widget-level drill descriptor. Absent → no "dig deeper" control. */
  drill?: DrillDescriptor;
  /** Fires the drill-in turn. Absent → the control is not rendered. */
  onDrillIn?: (descriptor: DrillDescriptor) => void;
  /** A turn is in flight — disable the control (belt to the shell's guard). */
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
  const label =
    drill?.label && drill.label.trim()
      ? `${drillLabel}: ${drill.label.trim()}`
      : drillLabel;

  return (
    <div className={cn('relative', className)} aria-label={title}>
      {showControl && (
        <div className="absolute right-2 top-2 z-10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => drill && onDrillIn?.(drill)}
            aria-label={label}
            title={label}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Telescope className="size-3.5" />
            <span className="hidden sm:inline">{drillLabel}</span>
          </Button>
        </div>
      )}
      {children}
    </div>
  );
}
