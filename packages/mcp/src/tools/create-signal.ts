import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CoherenceSignalType, Failure } from '@hypha-platform/core/server';
import { ERRORS, TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { originSchema, presentOrigin } from '../presentation/origin';
import { SIGNAL_TEXT_CAPS } from '../presentation/signals';
import { userText } from '../presentation/user-text';
import { sanitiseUserText } from '../sanitiser';
import { failureText, runTool } from './run-tool';

const T = TOOLS.hypha_create_signal;
const P = T.params;

/**
 * The types a signal can be created with, mirrored here because this package takes `core` only
 * as types. The check below fails to compile if this list and core's ever differ.
 */
export const CREATE_SIGNAL_TYPES = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Impact',
  'Bug',
] as const satisfies readonly CoherenceSignalType[];
type Exhaustive<T extends never> = T;
export type _CreateSignalTypesCoverCore = Exhaustive<
  Exclude<CoherenceSignalType, (typeof CREATE_SIGNAL_TYPES)[number]>
>;

/** Same limits as the feature function (the app's title and description limits, fewer tags). */
export const createSignalInput = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(P.spaceSlug),
  type: z.enum(CREATE_SIGNAL_TYPES).describe(P.type),
  title: z.string().trim().min(1).max(50).describe(P.title),
  description: z.string().trim().min(1).max(4000).describe(P.description),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10)
    .optional()
    .describe(P.tags),
});

export const createSignalOutput = z.object({
  slug: z.string(),
  url: z.string(),
  spaceSlug: z.string(),
  type: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  duplicate: z.boolean().describe(T.fields.duplicate),
  origin: originSchema.describe(T.fields.origin),
  userText: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    truncated: z.array(z.enum(['title', 'description'])),
  }),
});

/** A write refusal reads differently from a read's "not found" where that does not leak anything. */
function writeFailureText(failure: Failure): string {
  switch (failure.code) {
    case 'forbidden':
      return ERRORS.writeNotAllowed;
    case 'invalid_input':
      return ERRORS.invalidInput;
    case 'rate_limited':
      return failure.retryAfterSeconds
        ? `${ERRORS.writeRateLimited} Try again in ${failure.retryAfterSeconds} seconds.`
        : ERRORS.writeRateLimited;
    default:
      return failureText(failure);
  }
}

export function registerCreateSignal(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_create_signal',
    {
      title: T.title,
      description: T.description,
      inputSchema: createSignalInput,
      outputSchema: createSignalOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        // Same arguments within the duplicate window return the same signal, but not after it.
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      runTool(
        deps,
        'hypha_create_signal',
        async (caller) => {
          const r = await deps.features.createSignal(
            {
              spaceSlug: args.spaceSlug,
              type: args.type,
              title: args.title,
              description: args.description,
              tags: args.tags,
            },
            caller,
          );
          if (!r.ok) {
            return { ok: false, text: writeFailureText(r), outcome: r.code };
          }
          const s = r.data;
          return {
            ok: true,
            audit: {
              spaceId: s.spaceId,
              signalId: s.id,
              duplicate: s.duplicate,
            },
            result: {
              slug: s.slug,
              url: deps.signalUrl(s.spaceSlug, s.slug),
              spaceSlug: s.spaceSlug,
              type: s.type,
              tags: s.tags.map(
                (tag) => sanitiseUserText(tag, SIGNAL_TEXT_CAPS.tag).text,
              ),
              createdAt: s.createdAt,
              duplicate: s.duplicate,
              origin: presentOrigin(s.origin),
              userText: userText<'title' | 'description'>({
                title: { value: s.title, max: SIGNAL_TEXT_CAPS.title },
                description: {
                  value: s.description,
                  max: SIGNAL_TEXT_CAPS.descriptionFull,
                  atWordBoundary: true,
                },
              }),
            },
          };
        },
        { write: true },
      ),
  );
}
