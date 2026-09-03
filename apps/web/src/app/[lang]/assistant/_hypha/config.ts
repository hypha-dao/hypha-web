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
    const name = ctx.displayName?.trim();
    const hello = name ? `Hi ${name}.` : 'Hi.';
    const spaceSlug = ctx.primarySpaceSlug ?? ctx.recentSpaceSlugs?.[0];

    return {
      text: `${hello} Ask me about your organization and I'll pull it up here — signals, agreements, treasury.`,
      nextActions: spaceSlug
        ? [
            {
              id: 'show-signals',
              label: 'Show this space’s signals',
              prompt: 'Show me this space’s signals',
              emphasis: 'primary',
            },
            {
              id: 'high-priority',
              label: 'High-priority signals',
              prompt: 'Show the high-priority signals',
            },
          ]
        : [],
    };
  },
};
