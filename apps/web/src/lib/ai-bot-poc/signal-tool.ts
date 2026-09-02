// server-only: reached only from API route handlers (#2485 POC).

import { jsonSchema, tool } from 'ai';

/**
 * #2485 POC — `create_signal` tool.
 *
 * Callout 4 decision was "attempt real, fall back to canned stub if >~2h". Outcome: **stub**.
 * The only signal-write path that does not require a Hypha user session token is
 * `createSystemAiSignalForSpaceBySlug` (`packages/core/src/coherence/server/ai-signal-actions-system.ts`),
 * which is deliberately NOT re-exported and documented as callable only from
 * `signal-orchestrator.ts`. The inbound Matrix AS path has no user token to drive the supported
 * `createAiSignalForSpaceBySlug` path. Wiring either cleanly is post-POC work — tracked for the
 * #2478 split. This stub still exercises persona routing + tool-selection prompting (AC 8).
 *
 * Schema is `jsonSchema()` not zod — see the note in `context-source.ts`.
 */

type SignalType =
  | 'Opportunity'
  | 'Risk'
  | 'Tension'
  | 'Insight'
  | 'Trend'
  | 'Proposal';

interface CreateSignalArgs {
  title: string;
  description: string;
  type?: SignalType;
}

const createSignalInputSchema = jsonSchema<CreateSignalArgs>({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 160 },
    description: { type: 'string', minLength: 10, maxLength: 5000 },
    type: {
      type: 'string',
      enum: ['Opportunity', 'Risk', 'Tension', 'Insight', 'Trend', 'Proposal'],
      description: 'Signal category; defaults to Insight.',
    },
  },
});

export function createSignalStubTool(spaceSlug: string) {
  return tool({
    description:
      'Create a signal (Opportunity/Risk/Tension/Insight/Trend/Proposal) for the current space. ' +
      'Call this only when the user clearly asks to create or record a signal.',
    inputSchema: createSignalInputSchema,
    execute: async ({ title, description, type }) => {
      const resolvedType: SignalType = type ?? 'Insight';
      console.info('[ai-bot-poc] create_signal stub invoked', {
        spaceSlug,
        title,
        type: resolvedType,
      });
      return {
        stub: true,
        message:
          `(POC stub — no signal was actually created) I would create a ${resolvedType} signal ` +
          `"${title}" in space "${spaceSlug}" with description: ${description}`,
      };
    },
  });
}
