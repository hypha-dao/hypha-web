import type {
  AssistantSessionConfig,
  GreetingContext,
} from '@hypha-platform/epics';

import { registerHyphaWidgets } from './manifest';

/**
 * #2486 — the Hypha `AssistantSessionConfig` (the IO config model, D3). v0 keeps
 * the greeting simple; P-2 identity-scoped personalisation lands in M6. The
 * org-context slot is thin on the client — the server assembles the real
 * canvas-mode prompt (domain guidance + space snapshot) in
 * `chat-server/system-prompt.ts::buildAssistantCanvasSystemPrompt`.
 */
export const hyphaAssistantConfig: AssistantSessionConfig = {
  persona:
    "You are the Hypha organization's assistant — one entity the member talks to.",

  registryManifest: registerHyphaWidgets,

  scopeResolver: {
    resolveSpaceSlug: (ctx: GreetingContext) =>
      ctx.primarySpaceSlug ?? ctx.recentSpaceSlugs?.[0],
  },

  orgContext: {
    // Server owns the real context slot; nothing extra needed from the client in v0.
    buildContextSection: () => '',
  },

  greeting: (ctx: GreetingContext) => {
    // P-2 — identity-scoped, no learning: `useMe()` + recent spaces shape the
    // greeting text and the deterministic fallback actions; nothing persisted.
    const name = ctx.displayName?.trim();
    const hello = name ? `Hi ${name}.` : 'Hi.';
    const spaceSlug = ctx.primarySpaceSlug ?? ctx.recentSpaceSlugs?.[0];

    if (!spaceSlug) {
      return {
        text: `${hello} I’m your organization’s assistant. Tell me a space and what you want to see — signals, agreements, treasury, or an overview — and I’ll pull it up here.`,
        nextActions: [
          {
            id: 'what-can-you-show',
            label: 'What can you show me?',
            prompt:
              'What can you show me here, and what do you need from me to do it?',
            emphasis: 'primary',
          },
        ],
      };
    }

    return {
      text: `${hello} You were last in “${spaceSlug}”. Ask me about it — signals, agreements, treasury — and I’ll pull it up here.`,
      // Deterministic fallback strip (NA-4 hybrid) — shown until the model's
      // first `set_next_actions`.
      nextActions: [
        {
          id: 'space-overview',
          label: `Overview of ${spaceSlug}`,
          prompt: `Give me an overview of ${spaceSlug}`,
          emphasis: 'primary',
        },
        {
          id: 'show-signals',
          label: 'Signals',
          prompt: `Show me ${spaceSlug}’s signals`,
        },
        {
          id: 'show-agreements',
          label: 'Agreements',
          prompt: `Show me ${spaceSlug}’s agreements`,
        },
        {
          id: 'show-treasury',
          label: 'Treasury',
          prompt: `Show me ${spaceSlug}’s treasury`,
        },
      ],
    };
  },
};
