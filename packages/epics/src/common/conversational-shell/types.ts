import type { ComponentType } from 'react';

/**
 * Generic conversational-shell contracts (#2486 §4). Pure types — **no**
 * `@hypha-platform/*` imports. Hypha types appear only in the adapters and the
 * registry manifest (`assistant-hypha/`).
 */

// ---------------------------------------------------------------------------
// Standard Schema (structural subset of the v1 spec, sync-only)
//
// A zod ≥3.24 schema satisfies this shape via its `~standard` property, so the
// core validates model output without depending on zod or `@standard-schema/spec`.
// ---------------------------------------------------------------------------

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

export interface StandardSchemaV1<Output = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: unknown; readonly output: Output };
  };
}

// ---------------------------------------------------------------------------
// Conversation mode
// ---------------------------------------------------------------------------

/** The canvas conversation mode added to `ChatRequestPayload` (#2486 §4.5). */
export type ConversationMode = 'conversational_canvas';

// ---------------------------------------------------------------------------
// Canvas (#2486 §4.1)
// ---------------------------------------------------------------------------

export type LayoutHint = 'full' | 'half' | 'aside';

/** What the model declares per `set_canvas` widget. */
export interface CanvasIntent {
  /** Must exist in the registry. */
  widgetId: string;
  /** Validated by the widget's `paramsSchema`. */
  params: Record<string, unknown>;
  layoutHint?: LayoutHint;
  /** Dedupe key; defaults to a stable hash of `widgetId` + `params`. */
  key?: string;
}

/** A reduced, validated widget on the canvas. */
export interface CanvasWidgetState {
  widgetId: string;
  params: Record<string, unknown>;
  key: string;
  layoutHint?: LayoutHint;
}

export interface CanvasState {
  widgets: CanvasWidgetState[];
  updatedFromMessageId: string | null;
}

// ---------------------------------------------------------------------------
// Next actions (#2486 §4.2)
// ---------------------------------------------------------------------------

/** `'guidance'` = the D5 health-nudge chip. */
export type NextActionEmphasis = 'primary' | 'default' | 'guidance';

export interface NextAction {
  id: string;
  label: string;
  /** Injected as the next user turn when the chip is clicked. */
  prompt?: string;
  /** OR: navigate (rare in v0). */
  href?: string;
  emphasis?: NextActionEmphasis;
}

// ---------------------------------------------------------------------------
// Widget registry (#2486 §4.3)
// ---------------------------------------------------------------------------

export interface WidgetEvent {
  type: string;
  [key: string]: unknown;
}

export interface WidgetComponentProps<P = Record<string, unknown>> {
  params: P;
  onEvent?: (event: WidgetEvent) => void;
}

export interface WidgetDefinition<P = Record<string, unknown>> {
  id: string;
  /** Canvas frame label + prompt catalogue. */
  title: string;
  /** Validates model output (zod or any Standard Schema). */
  paramsSchema: StandardSchemaV1<P>;
  component: ComponentType<WidgetComponentProps<P>>;
  /** One line: what it shows + which params. Feeds the system prompt. */
  describeForModel: () => string;
}

export interface WidgetRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (def: WidgetDefinition<any>) => void;
  get: (id: string) => WidgetDefinition | undefined;
  has: (id: string) => boolean;
  list: () => WidgetDefinition[];
  /** ids + params + what each shows — feeds the org-context slot. */
  catalogueForPrompt: () => string;
}

// ---------------------------------------------------------------------------
// Recency stack (#2486 §4.8) — derived from the message array, nothing persisted
// ---------------------------------------------------------------------------

export interface RecapEntry {
  messageId: string;
  /** Condensed last user turn. */
  askSummary: string;
  /** Condensed last assistant turn. */
  answerSummary: string;
  /** 0 = newest; drives opacity in the stack. */
  ageRank: number;
}

export type ConversationRecap = RecapEntry[];

// ---------------------------------------------------------------------------
// Session / config — the IO configuration model (#2486 §4.4)
// ---------------------------------------------------------------------------

export interface GreetingContext {
  displayName?: string;
  primarySpaceSlug?: string;
  recentSpaceSlugs?: string[];
}

export interface Greeting {
  text: string;
  nextActions: NextAction[];
  canvas?: CanvasIntent[];
}

/** Resolves "which space" the canvas widgets target (#2486 §4.7). */
export interface ScopeResolver {
  resolveSpaceSlug: (ctx: GreetingContext) => string | undefined;
}

/**
 * The swappable org-context slot (#2486 §4.5). v0 fills it with static domain
 * guidance + `buildSpaceContextSnapshot`; #2478 swaps in the real context layer
 * behind the same interface.
 */
export interface OrgContextProvider {
  /** System-prompt fragment for the resolved scope. */
  buildContextSection: (args: {
    spaceSlug?: string;
  }) => string | Promise<string>;
}

export interface AssistantSessionConfig {
  greeting: (ctx: GreetingContext) => Greeting;
  /** System-prompt persona fragment. */
  persona: string;
  /** Registers all widgets for this session. */
  registryManifest: (registry: WidgetRegistry) => void;
  scopeResolver: ScopeResolver;
  orgContext: OrgContextProvider;
}

// ---------------------------------------------------------------------------
// Message shape — structural, mirrors `ai-tool-navigation.ts` (no SDK coupling)
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  id?: string;
  role?: string;
  parts?: unknown;
  /** Legacy AI SDK shape. */
  toolInvocations?: unknown;
  /** Legacy: plain-text content. */
  content?: unknown;
}
