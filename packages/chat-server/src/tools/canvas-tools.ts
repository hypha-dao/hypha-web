import { z } from 'zod';
import type { ChatRouteTool } from './types';

/**
 * #2486 §4.6 — presentation / UI-control tools. Both are **pure**: validate +
 * normalise the model's declaration and echo it back. No data fetch, no writes.
 * The client reduces the echoed output into canvas / strip state
 * (`conversational-shell/use-canvas.ts`); deep param validation happens there
 * against the widget registry, so these tools stay free of any `epics` import.
 */

const MAX_CANVAS_WIDGETS = 6;
const MAX_NEXT_ACTIONS = 6;

const layoutHint = z.enum(['full', 'half', 'aside']);
const emphasis = z.enum(['primary', 'default', 'guidance']);

const setCanvasInput = z.object({
  widgets: z
    .array(
      z.object({
        widget_id: z
          .string()
          .trim()
          .min(1)
          .describe('Registry id of the widget to place, e.g. "signals"'),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .default({})
          .describe('Widget params, e.g. { "spaceSlug": "hypha" }'),
        layout_hint: layoutHint.optional(),
      }),
    )
    .max(MAX_CANVAS_WIDGETS)
    .describe('The FULL desired widget set (replace-all).'),
});

const setNextActionsInput = z.object({
  actions: z
    .array(
      z.object({
        id: z.string().trim().min(1).optional(),
        label: z.string().trim().min(1).describe('Chip text'),
        prompt: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Injected as the next user turn when the chip is clicked'),
        href: z.string().trim().min(1).optional(),
        emphasis: emphasis.optional(),
      }),
    )
    .max(MAX_NEXT_ACTIONS),
});

/**
 * `set_canvas` — declare the full widget set the member should see now.
 * Unknown `widget_id`s (not in `allowedWidgetIds`, when that list is non-empty)
 * are rejected and reported back so the model can correct itself.
 */
export function createSetCanvasTool(
  allowedWidgetIds: readonly string[] = [],
): ChatRouteTool<typeof setCanvasInput> {
  const allowed = new Set(allowedWidgetIds);

  return {
    description:
      'Presentation tool. Declare the FULL set of widgets the member should see on the canvas right now (replace-all — include every widget you still want shown). Prefer coarse params (scope only) in v0. Call this whenever the member asks to see, show, open, or go to something.',
    inputSchema: setCanvasInput,
    execute: async (args) => {
      const parsed = setCanvasInput.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const canvas: Array<{
        widgetId: string;
        params: Record<string, unknown>;
        layoutHint?: z.infer<typeof layoutHint>;
      }> = [];
      const rejected: string[] = [];

      for (const widget of parsed.data.widgets) {
        if (allowed.size > 0 && !allowed.has(widget.widget_id)) {
          rejected.push(widget.widget_id);
          continue;
        }
        canvas.push({
          widgetId: widget.widget_id,
          params: widget.params ?? {},
          layoutHint: widget.layout_hint,
        });
      }

      return {
        ok: true,
        canvas,
        ...(rejected.length > 0
          ? {
              rejected,
              note: `Unknown widget id(s): ${rejected.join(', ')}. Valid ids: ${
                [...allowed].join(', ') || '(none registered)'
              }.`,
            }
          : {}),
      };
    },
  };
}

/** `set_next_actions` — declare the suggested-next-steps strip (replace-all). */
export function createSetNextActionsTool(): ChatRouteTool<
  typeof setNextActionsInput
> {
  return {
    description:
      'Presentation tool. Declare the strip of 2–4 suggested next steps under the interaction bar (replace-all). Use `emphasis: "guidance"` for a health/attention nudge. Each action may carry a `prompt` that is sent as the next user turn when clicked.',
    inputSchema: setNextActionsInput,
    execute: async (args) => {
      const parsed = setNextActionsInput.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const actions = parsed.data.actions.map((action, index) => ({
        id: action.id ?? `na-${index}`,
        label: action.label,
        ...(action.prompt ? { prompt: action.prompt } : {}),
        ...(action.href ? { href: action.href } : {}),
        ...(action.emphasis ? { emphasis: action.emphasis } : {}),
      }));

      return { ok: true, actions };
    },
  };
}

/** Widget ids the canvas tools should accept, read from the request context. */
export function readAllowedWidgetIds(conversationContext: unknown): string[] {
  if (
    conversationContext &&
    typeof conversationContext === 'object' &&
    'widgetIds' in conversationContext
  ) {
    const ids = (conversationContext as { widgetIds?: unknown }).widgetIds;
    if (Array.isArray(ids)) {
      return ids.filter((id): id is string => typeof id === 'string' && !!id);
    }
  }
  return [];
}
