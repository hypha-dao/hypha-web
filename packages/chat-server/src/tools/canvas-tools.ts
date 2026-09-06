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
      'Presentation tool. Declare the FULL set of widgets the member should see on the canvas right now (replace-all — include every widget you still want shown). Prefer coarse params (scope only) in v0. REQUIRED on every substantive turn — a data view, or the `answer` widget for a read / opinion / synthesis / short factual answer. If you just read a `get_*` tool or called `set_scope`, you MUST call this in the same turn. The chat reply is a one-line pointer, never the answer itself.',
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

// ---------------------------------------------------------------------------
// set_scope (#2486 M7) — move the conversation to another space.
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface KnownSpace {
  slug: string;
  title?: string;
}

const setScopeInput = z.object({
  space: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The space to switch to — its slug (e.g. "ateneo-de-manila") or the name the member said (e.g. "Ateneo de Manila").',
    ),
});

/** lowercase, non-alphanumerics → single space, trimmed. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** normalised, spaces → hyphens. */
function slugify(value: string): string {
  return normalise(value).replace(/ +/g, '-');
}

/**
 * Number tokens in a reference, with and without leading zeros
 * ("031" → ["031", "31"]). Members name spaces like "Ger de bot 031" and refer
 * to them as "031" / "the 31 one" — the digit is the reliable handle.
 */
function digitTokens(value: string): string[] {
  const out = new Set<string>();
  for (const run of value.match(/\d+/g) ?? []) {
    out.add(run);
    out.add(run.replace(/^0+/, '') || '0');
  }
  return [...out];
}

/**
 * Resolve a member-supplied space reference to a slug. Prefers an exact/loose
 * match against `knownSpaces` (so spoken names resolve deterministically);
 * falls back to the input itself when it is already a well-formed slug.
 */
export function resolveScopeTarget(
  input: string,
  knownSpaces: readonly KnownSpace[],
): { slug: string; title?: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  const normInput = normalise(raw);
  const slugInput = slugify(raw);

  for (const candidate of knownSpaces) {
    if (!candidate.slug) continue;
    if (
      candidate.slug === raw ||
      candidate.slug === slugInput ||
      normalise(candidate.slug) === normInput ||
      (candidate.title ? normalise(candidate.title) === normInput : false)
    ) {
      return {
        slug: candidate.slug,
        ...(candidate.title ? { title: candidate.title } : {}),
      };
    }
  }

  // Partial contains match on titles (e.g. "manila" → "Ateneo de Manila").
  if (normInput.length >= 3) {
    const partial = knownSpaces.find(
      (c) =>
        c.title &&
        (normalise(c.title).includes(normInput) ||
          normInput.includes(normalise(c.title))),
    );
    if (partial) {
      return {
        slug: partial.slug,
        ...(partial.title ? { title: partial.title } : {}),
      };
    }
  }

  // Digit-token match: "test 031" / "the 026 one" → the known space carrying
  // that number, when exactly one does. Without this the model's loose
  // paraphrase ("test 031") slips past every check above and gets minted into a
  // dead slug ("test031") by the fallback below.
  const inputDigits = new Set(digitTokens(raw));
  if (inputDigits.size > 0) {
    const digitHits = knownSpaces.filter((c) =>
      digitTokens(`${c.slug} ${c.title ?? ''}`).some((d) => inputDigits.has(d)),
    );
    if (digitHits.length === 1) {
      const hit = digitHits[0]!;
      return { slug: hit.slug, ...(hit.title ? { title: hit.title } : {}) };
    }
  }

  // A deliberate multi-segment slug ("ateneo-de-manila") the caller passed
  // verbatim that just isn't in the known list. Require the hyphen: a bare
  // token like "test031" that the model paraphrased from "test 031" is NOT a
  // real slug and must not be minted.
  if (SLUG_RE.test(raw) && raw.includes('-')) return { slug: raw };

  // Fall back to a slugified guess of a free-text name the member typed
  // ("BOT Ger Test 030" → "bot-ger-test-030"). ONLY when there is no candidate
  // list to check against (first turn, memberships still loading) — otherwise
  // an unresolvable reference like "test 031" mints a dead slug. With a
  // populated list, an unmatched reference is a miss: return null so `set_scope`
  // reports it and the model asks instead of inventing.
  if (
    knownSpaces.length === 0 &&
    SLUG_RE.test(slugInput) &&
    slugInput.length >= 2 &&
    slugInput.length <= 80 &&
    !/^(the|a|an|my|our|this|that|it)-/.test(slugInput)
  ) {
    return { slug: slugInput };
  }

  return null;
}

/**
 * `set_scope` — switch the conversation to another space. The client applies
 * the echoed `spaceSlug` to every following turn (and re-grounds the prompt).
 * Only offered when the member has NOT locked scope.
 */
export function createSetScopeTool(
  knownSpaces: readonly KnownSpace[] = [],
): ChatRouteTool<typeof setScopeInput> {
  return {
    description:
      "Switch the conversation to another space when the member clearly means a different one than the active space. Pass the slug or the name they used. On `ok`, the SAME turn MUST continue with set_canvas (and set_next_actions) keyed to the returned slug — a turn that calls set_scope and stops, or leaves the previous space's widgets on screen, is broken. Call at most once per turn; on an error, tell the member plainly and stop — do not retry with slug variations. Do not call this for filters or sub-views of the current space.",
    inputSchema: setScopeInput,
    execute: async (args) => {
      const parsed = setScopeInput.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const resolved = resolveScopeTarget(parsed.data.space, knownSpaces);
      if (!resolved) {
        return {
          ok: false,
          note: `Couldn't resolve "${parsed.data.space}" to a space. Ask the member for the exact space name, or tell them it isn't one of their recent spaces.`,
          ...(knownSpaces.length > 0
            ? { knownSpaces: knownSpaces.map((s) => s.title || s.slug) }
            : {}),
        };
      }
      return {
        ok: true,
        spaceSlug: resolved.slug,
        ...(resolved.title ? { title: resolved.title } : {}),
      };
    },
  };
}

/** Reads `knownSpaces` from the request conversation context. */
export function readKnownSpaces(conversationContext: unknown): KnownSpace[] {
  if (
    conversationContext &&
    typeof conversationContext === 'object' &&
    'knownSpaces' in conversationContext
  ) {
    const raw = (conversationContext as { knownSpaces?: unknown }).knownSpaces;
    if (Array.isArray(raw)) {
      return raw
        .filter(
          (e): e is { slug: string; title?: string } =>
            !!e &&
            typeof e === 'object' &&
            typeof (e as { slug?: unknown }).slug === 'string' &&
            !!(e as { slug: string }).slug,
        )
        .map((e) => ({
          slug: e.slug,
          ...(typeof e.title === 'string' && e.title ? { title: e.title } : {}),
        }));
    }
  }
  return [];
}

/** `true` when the member has locked the conversation scope. */
export function readScopeLocked(conversationContext: unknown): boolean {
  return (
    !!conversationContext &&
    typeof conversationContext === 'object' &&
    (conversationContext as { scopeLocked?: unknown }).scopeLocked === true
  );
}

/** `set_next_actions` — declare the suggested-next-steps strip (replace-all). */
export function createSetNextActionsTool(): ChatRouteTool<
  typeof setNextActionsInput
> {
  return {
    description:
      'Presentation tool. Declare the strip of 2–4 suggested next steps under the interaction bar (replace-all). Call this on every substantive turn (and again in the same turn after `set_scope`, keyed to the new space) — otherwise the strip goes stale. Use `emphasis: "guidance"` for a health/attention nudge. Each action may carry a `prompt` that is sent as the next user turn when clicked.',
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
