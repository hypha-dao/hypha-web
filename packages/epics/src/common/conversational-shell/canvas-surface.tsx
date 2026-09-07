'use client';

import * as React from 'react';

import { cn } from '@hypha-platform/ui-utils';

import { WidgetFrame } from './widget-frame';
import type {
  CanvasState,
  CanvasWidgetState,
  DrillDescriptor,
  LayoutHint,
  WidgetDefinition,
  WidgetEvent,
  WidgetRegistry,
} from './types';

const LAYOUT_CLASS: Record<LayoutHint, string> = {
  full: 'col-span-full',
  half: 'col-span-full md:col-span-1',
  aside: 'col-span-full md:col-span-1 md:max-w-sm',
};

interface WidgetErrorBoundaryProps {
  widgetId: string;
  fallbackLabel: string;
  children: React.ReactNode;
}

/** Per-widget boundary: one broken adapter never takes down the canvas. */
class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `[canvas-surface] widget "${this.props.widgetId}" crashed`,
      error,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-dashed border-destructive/50 p-4 text-sm text-muted-foreground">
          {this.props.fallbackLabel}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface CanvasSurfaceProps {
  canvasState: CanvasState;
  registry: WidgetRegistry;
  onWidgetEvent?: (event: WidgetEvent) => void;
  /** Rendered when the canvas has no widgets. */
  emptyState?: React.ReactNode;
  /** Label for a crashed widget (host provides an i18n string). */
  widgetErrorLabel?: string;
  /**
   * #2486 M9 — fires a "dig deeper" turn for a widget. When set (with a
   * descriptor from `getDrillDescriptor`), each widget gets the frame control.
   * `sourceWidgetId` is the id of the widget the drill was triggered from.
   */
  onDrillIn?: (descriptor: DrillDescriptor, sourceWidgetId: string) => void;
  /**
   * Per-widget drill descriptor. Return `undefined` to leave a widget plain
   * (e.g. the synthesis `answer` widget). Only consulted when `onDrillIn` is
   * set.
   */
  getDrillDescriptor?: (
    widget: CanvasWidgetState,
    def: WidgetDefinition,
  ) => DrillDescriptor | undefined;
  /** A turn is in flight — disables every "dig deeper" control. */
  drillBusy?: boolean;
  /** Localised "dig deeper" control label. */
  drillLabel?: string;
  className?: string;
}

/**
 * Lays out `canvasState.widgets` by resolving each `widgetId` in the registry
 * and rendering `<def.component params=… onEvent=… />` inside an error boundary
 * (#2486 §5.1). Knows nothing about any specific widget.
 */
export function CanvasSurface({
  canvasState,
  registry,
  onWidgetEvent,
  emptyState = null,
  widgetErrorLabel = 'This view could not be loaded.',
  onDrillIn,
  getDrillDescriptor,
  drillBusy = false,
  drillLabel,
  className,
}: CanvasSurfaceProps) {
  if (canvasState.widgets.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>
      {canvasState.widgets.map((widget) => {
        const def = registry.get(widget.widgetId);
        if (!def) return null;
        const Component = def.component;
        const drill =
          onDrillIn && getDrillDescriptor
            ? getDrillDescriptor(widget, def)
            : undefined;
        return (
          <section
            key={widget.key}
            aria-label={def.title}
            className={LAYOUT_CLASS[widget.layoutHint ?? 'full']}
          >
            <WidgetErrorBoundary
              widgetId={widget.widgetId}
              fallbackLabel={widgetErrorLabel}
            >
              <WidgetFrame
                title={def.title}
                drill={drill}
                onDrillIn={
                  drill && onDrillIn
                    ? (d) => onDrillIn(d, widget.widgetId)
                    : undefined
                }
                busy={drillBusy}
                drillLabel={drillLabel}
              >
                <Component params={widget.params} onEvent={onWidgetEvent} />
              </WidgetFrame>
            </WidgetErrorBoundary>
          </section>
        );
      })}
    </div>
  );
}
