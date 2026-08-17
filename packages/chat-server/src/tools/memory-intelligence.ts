import { z } from 'zod';
import {
  deleteIntelligenceBySpaceSlug,
  enableIntelligencePackForSpace,
  HYPHA_ENERGY_PACK_ID,
  listIntelligenceBySpaceSlug,
  proposeIntelligencePatchForSignal,
  readIntelligenceBySpaceSlug,
  serializeIntelligenceMarkdown,
  writeIntelligenceBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import { buildSpaceScreenNavigation } from './space-screen-navigation';
import { resolveHyphaAiSourceApp } from './memory-write-identity';
import {
  buildMemoryCreateFields,
  normalizeIntelligenceArtifactType,
  normalizeLinkedSignalSlugs,
  stripAccidentalYamlFence,
} from './memory-artifact-fields';

export {
  HYPHA_AI_SOURCE_APP_FALLBACK,
  resolveHyphaAiSourceApp,
} from './memory-write-identity';

const spaceSlugSchema = z.string().trim().min(1);
const artifactBodySchema = z
  .string()
  .min(1)
  .max(400_000)
  .describe(
    'Markdown body only — prose, headings, and lists. Do not include YAML frontmatter or --- fences. The server writes id, space, dates, version, and source_app.',
  );
const linkedSignalsSchema = z
  .union([z.string().trim().min(1), z.array(z.string().trim().min(1)).max(50)])
  .optional()
  .describe(
    'Coherence signal slug(s) this artifact is based on, e.g. coh-138. Pass a string or array — never YAML.',
  );

function invalidSlug(spaceSlug: string) {
  return {
    ok: false as const,
    error: 'Invalid space slug format',
    space_slug: spaceSlug,
  };
}

function buildMemoryTabNavigation(args: {
  lang?: string | null;
  spaceSlug: string;
  label?: string;
}) {
  return buildSpaceScreenNavigation({
    lang: args.lang ?? undefined,
    spaceSlug: args.spaceSlug,
    screen: 'memory',
    label: args.label ?? 'Open Space Intelligence',
  });
}

function buildSignalApprovalNavigation(args: {
  lang?: string | null;
  spaceSlug: string;
  signalSlug: string;
  label?: string;
}) {
  const lang = args.lang?.trim().toLowerCase().slice(0, 2) || 'en';
  const params = new URLSearchParams();
  params.set('signal', args.signalSlug.trim());
  return {
    kind: 'internal' as const,
    href: `/${lang}/dho/${args.spaceSlug}/coherence?${params.toString()}`,
    screen: 'signals' as const,
    space_slug: args.spaceSlug,
    signal_slug: args.signalSlug.trim(),
    label: args.label ?? 'Open signal to approve intelligence patch',
  };
}

export function createMemoryListTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    type: z
      .string()
      .optional()
      .describe(
        'Optional intelligence type filter (context, assessment, insight, recommendation, decision, …).',
      ),
    status: z
      .string()
      .optional()
      .describe('Optional status (draft, current, …).'),
    search: z
      .string()
      .optional()
      .describe('Optional case-insensitive filter on title, id, or tags.'),
  });

  return {
    description:
      'Read-only: list Space Intelligence artifacts (Memory tab cards). Distinct from Coherence signals (get_signals_by_space_slug) and from Documentation files (get_org_memory_by_space_slug). Optional before create; skip when the member asked to create from a known signal slug.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      try {
        const gated = await listIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            type: parsed.data.type,
            status: parsed.data.status,
            search: parsed.data.search,
            authToken,
          },
          { db },
        );
        if (gated.access === 'denied') {
          return { ok: false, error: gated.message, space_slug: safe };
        }
        return {
          ok: true,
          space_slug: gated.space_slug,
          configured: gated.configured,
          artifacts: gated.artifacts,
          enabled_packs: gated.enabled_packs,
        };
      } catch (error) {
        console.error('[chat-tool][memory_list]', error);
        return {
          ok: false,
          error: 'Failed to list Space Intelligence',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemorySearchTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    query: z
      .string()
      .trim()
      .min(1)
      .describe('Case-insensitive search across title, id, and tags.'),
    type: z.string().optional(),
    status: z.string().optional(),
  });

  return {
    description:
      'Read-only: search Space Intelligence artifacts by title, id, or tags. Same store as memory_list. Use this when looking for an existing artifact to update from a Coherence signal.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      try {
        const gated = await listIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            type: parsed.data.type,
            status: parsed.data.status,
            search: parsed.data.query,
            authToken,
          },
          { db },
        );
        if (gated.access === 'denied') {
          return { ok: false, error: gated.message, space_slug: safe };
        }
        return {
          ok: true,
          space_slug: gated.space_slug,
          configured: gated.configured,
          query: parsed.data.query,
          artifacts: gated.artifacts,
          enabled_packs: gated.enabled_packs,
        };
      } catch (error) {
        console.error('[chat-tool][memory_search]', error);
        return {
          ok: false,
          error: 'Failed to search Space Intelligence',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryReadTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    artifact_id: z
      .string()
      .trim()
      .min(1)
      .describe(
        'Intelligence artifact slug-id from memory_list / memory_search.',
      ),
  });

  return {
    description:
      'Read-only: read one Space Intelligence artifact (frontmatter + body) by artifact_id. Call memory_list or memory_search first when the id is unknown. Optional before memory_update — update loads the live artifact if expected_sha is omitted.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      try {
        const gated = await readIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            artifactId: parsed.data.artifact_id,
            authToken,
          },
          { db },
        );
        if (gated.access === 'denied') {
          return { ok: false, error: gated.message, space_slug: safe };
        }
        const artifact = gated.artifact;
        return {
          ok: true,
          space_slug: gated.space_slug,
          configured: gated.configured,
          found: Boolean(artifact),
          frontmatter: artifact?.frontmatter ?? null,
          body: artifact?.body ?? null,
          path: artifact?.path ?? null,
          sha: artifact?.sha ?? null,
        };
      } catch (error) {
        console.error('[chat-tool][memory_read]', error);
        return {
          ok: false,
          error: 'Failed to read Space Intelligence',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryCreateTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    title: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe(
        'Human title. The server derives a slug id unless artifact_id is set.',
      ),
    body: artifactBodySchema,
    type: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Intelligence type: insight (default), assessment, recommendation, decision, context, proposal, report, or framework. Never use signal (that is a Coherence board item).',
      ),
    linked_signals: linkedSignalsSchema,
    artifact_id: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .optional()
      .describe('Optional lowercase slug id. Omit to derive from title.'),
    tags: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    mode: z
      .enum(['draft', 'publish'])
      .optional()
      .default('draft')
      .describe(
        'draft (default) writes status=draft. publish writes a current version. Prefer draft unless the member asked to publish.',
      ),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Write: create a Space Intelligence artifact (Memory tab). Pass title, type, and body only — never YAML frontmatter. The server fills id, space, dates, version, and source_app. Use this — not create_space_signal_by_slug — when the user asks to create an artifact from a Coherence signal. Pass linked_signals with that signal slug. Default mode=draft. Call once; do not retry formatting.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      const identity = resolveHyphaAiSourceApp();
      if (!identity.ok) {
        return { ok: false, error: identity.message, space_slug: safe };
      }

      const fields = buildMemoryCreateFields({
        title: parsed.data.title,
        type: parsed.data.type,
        artifactId: parsed.data.artifact_id,
        body: parsed.data.body,
        linkedSignals: parsed.data.linked_signals,
        tags: parsed.data.tags,
      });
      if (!fields.body) {
        return {
          ok: false,
          error:
            'body must be the artifact prose only. Do not pass YAML frontmatter or --- fences.',
          space_slug: safe,
        };
      }

      try {
        const result = await writeIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            frontmatter: {
              id: fields.id,
              type: fields.type,
              title: fields.title,
              source_app: identity.source_app,
              status: parsed.data.mode === 'publish' ? 'current' : 'draft',
              linked_signals: fields.linked_signals,
              tags: fields.tags,
            },
            body: fields.body,
            authToken,
            createOnly: true,
            canonicalSourceApp: identity.source_app,
            forceStatus: parsed.data.mode === 'draft' ? 'draft' : undefined,
            promoteDraft: parsed.data.mode === 'publish',
          },
          { db },
        );

        if (result.access !== 'ok') {
          return {
            ok: false,
            error: result.message,
            space_slug: safe,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
        }

        return {
          ok: true,
          space_slug: safe,
          created: result.created,
          path: result.artifact.path,
          sha: result.artifact.sha,
          source_app: result.artifact.frontmatter.source_app,
          frontmatter: result.artifact.frontmatter,
          navigation: buildMemoryTabNavigation({
            lang: parsed.data.lang ?? defaultLocale,
            spaceSlug: safe,
            label: `Open ${result.artifact.frontmatter.title}`,
          }),
        };
      } catch (error) {
        console.error('[chat-tool][memory_create]', error);
        return {
          ok: false,
          error: 'Failed to create Space Intelligence artifact',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryUpdateTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    artifact_id: z
      .string()
      .trim()
      .min(1)
      .describe(
        'Existing intelligence artifact slug-id from memory_list / memory_read.',
      ),
    body: artifactBodySchema,
    title: z.string().trim().min(1).max(500).optional(),
    type: z.string().trim().min(1).max(100).optional(),
    linked_signals: linkedSignalsSchema,
    expected_sha: z
      .string()
      .trim()
      .min(7)
      .max(64)
      .optional()
      .describe(
        'Optional SHA from memory_read. Omit to use the live artifact (server loads it).',
      ),
    mode: z
      .enum(['propose', 'publish'])
      .optional()
      .default('propose')
      .describe(
        'propose (default) stores a pending patch on signal_slug for member approval. publish versions immediately.',
      ),
    signal_slug: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Required when mode=propose. The Coherence signal members approve on.',
      ),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Write: update an existing Space Intelligence artifact. Pass artifact_id and body only — never YAML. The server loads current frontmatter. Default mode=propose: attach a versioned patch to an existing Coherence signal (signal_slug required) for member approval — do not create a new Coherence signal. mode=publish versions immediately when the member asked to publish.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      const identity = resolveHyphaAiSourceApp();
      if (!identity.ok) {
        return { ok: false, error: identity.message, space_slug: safe };
      }

      const mode = parsed.data.mode ?? 'propose';
      const lang = parsed.data.lang ?? defaultLocale;
      const body = stripAccidentalYamlFence(parsed.data.body);
      if (!body) {
        return {
          ok: false,
          error:
            'body must be the artifact prose only. Do not pass YAML frontmatter or --- fences.',
          space_slug: safe,
        };
      }

      try {
        const gated = await readIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            artifactId: parsed.data.artifact_id,
            authToken,
          },
          { db },
        );
        if (gated.access === 'denied') {
          return { ok: false, error: gated.message, space_slug: safe };
        }
        const existing = gated.artifact;
        if (!existing) {
          return {
            ok: false,
            error: `Artifact "${parsed.data.artifact_id}" was not found; use memory_create.`,
            space_slug: safe,
          };
        }

        const expectedSha = parsed.data.expected_sha ?? existing.sha;
        const linkedSignals = normalizeLinkedSignalSlugs(
          parsed.data.linked_signals,
        );
        const nextTitle =
          parsed.data.title?.trim() || existing.frontmatter.title;
        const nextType = parsed.data.type
          ? normalizeIntelligenceArtifactType(parsed.data.type)
          : existing.frontmatter.type;
        const markdown = serializeIntelligenceMarkdown({
          frontmatter: {
            ...existing.frontmatter,
            title: nextTitle,
            type: nextType,
            space: safe,
            source_app: identity.source_app,
            linked_signals:
              linkedSignals ?? existing.frontmatter.linked_signals,
          },
          body,
        });

        if (mode === 'propose') {
          const signalSlug = parsed.data.signal_slug?.trim();
          if (!signalSlug) {
            return {
              ok: false,
              error:
                'mode=propose requires signal_slug of the existing Coherence signal. Do not create a new signal — pass the current signal slug.',
              space_slug: safe,
            };
          }

          const result = await proposeIntelligencePatchForSignal(
            {
              spaceSlug: safe,
              signalSlug,
              targetId: existing.frontmatter.id,
              expectedSha,
              markdown,
              source_app: identity.source_app,
              title: nextTitle,
              authToken,
              canonicalSourceApp: identity.source_app,
            },
            { db },
          );

          if (result.access !== 'ok') {
            return {
              ok: false,
              error: result.message,
              space_slug: safe,
              ...(result.access === 'conflict' && result.currentSha
                ? { current_sha: result.currentSha }
                : {}),
            };
          }

          return {
            ok: true,
            mode: 'propose' as const,
            space_slug: result.space_slug,
            signal_slug: result.patch.signal_slug,
            target_id: result.patch.target_id,
            patch_status: result.patch.status,
            source_app: result.patch.source_app,
            navigation: buildSignalApprovalNavigation({
              lang,
              spaceSlug: result.space_slug,
              signalSlug: result.patch.signal_slug,
              label: nextTitle,
            }),
          };
        }

        const result = await writeIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            markdown,
            expectedSha,
            authToken,
            updateOnly: true,
            canonicalSourceApp: identity.source_app,
            promoteDraft: true,
          },
          { db },
        );

        if (result.access !== 'ok') {
          return {
            ok: false,
            error: result.message,
            space_slug: safe,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
        }

        return {
          ok: true,
          mode: 'publish' as const,
          space_slug: safe,
          created: result.created,
          path: result.artifact.path,
          sha: result.artifact.sha,
          source_app: result.artifact.frontmatter.source_app,
          frontmatter: result.artifact.frontmatter,
          navigation: buildMemoryTabNavigation({
            lang,
            spaceSlug: safe,
            label: `Open ${result.artifact.frontmatter.title}`,
          }),
        };
      } catch (error) {
        console.error('[chat-tool][memory_update]', error);
        return {
          ok: false,
          error: 'Failed to update Space Intelligence',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryDeleteTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    artifact_id: z.string().trim().min(1),
    expected_sha: z.string().trim().min(7).max(64),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Write: soft-archive a Space Intelligence artifact (status=archived). Hard delete is not available. Requires expected_sha from memory_read.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      try {
        const result = await deleteIntelligenceBySpaceSlug(
          {
            spaceSlug: safe,
            artifactId: parsed.data.artifact_id,
            expectedSha: parsed.data.expected_sha,
            authToken,
          },
          { db },
        );
        if (result.access !== 'ok') {
          return {
            ok: false,
            error: result.message,
            space_slug: safe,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
        }
        return {
          ok: true,
          space_slug: result.space_slug,
          artifact_id: result.artifact_id,
          archived: true,
          sha: result.entry.sha,
          navigation: buildMemoryTabNavigation({
            lang: parsed.data.lang ?? defaultLocale,
            spaceSlug: result.space_slug,
          }),
        };
      } catch (error) {
        console.error('[chat-tool][memory_delete]', error);
        return {
          ok: false,
          error: 'Failed to archive Space Intelligence',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryEnablePackTool(
  authToken: string,
  defaultLocale?: string | null,
) {
  const inputSchema = z.object({
    space_slug: spaceSlugSchema,
    pack_id: z
      .string()
      .trim()
      .min(1)
      .default(HYPHA_ENERGY_PACK_ID)
      .describe(`Pack id to enable (currently ${HYPHA_ENERGY_PACK_ID}).`),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
  });

  return {
    description:
      'Write: enable a Space Intelligence framework pack and seed starter Markdown artifacts (idempotent). Currently hypha-energy (eight Energy ontology starters). Use when the member asks to enable the Energy pack or seed org-memory starters.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const safe = sanitizeSlug(parsed.data.space_slug);
      if (!safe) return invalidSlug(parsed.data.space_slug);

      try {
        const result = await enableIntelligencePackForSpace(
          {
            spaceSlug: safe,
            packId: parsed.data.pack_id,
            authToken,
          },
          { db },
        );
        if (result.access !== 'ok') {
          return { ok: false, error: result.message, space_slug: safe };
        }
        return {
          ok: true,
          space_slug: result.space_slug,
          pack_id: result.pack_id,
          enabled_packs: result.enabled_packs,
          seeded: result.seeded,
          skipped: result.skipped,
          navigation: buildMemoryTabNavigation({
            lang: parsed.data.lang ?? defaultLocale,
            spaceSlug: result.space_slug,
            label: 'Open Space Intelligence',
          }),
        };
      } catch (error) {
        console.error('[chat-tool][memory_enable_pack]', error);
        return {
          ok: false,
          error: 'Failed to enable intelligence pack',
          space_slug: safe,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createMemoryIntelligenceTools(
  authToken: string,
  defaultLocale?: string | null,
): Record<string, ChatRouteTool> {
  return {
    memory_list: createMemoryListTool(authToken),
    memory_search: createMemorySearchTool(authToken),
    memory_read: createMemoryReadTool(authToken),
    memory_create: createMemoryCreateTool(authToken, defaultLocale),
    memory_update: createMemoryUpdateTool(authToken, defaultLocale),
    memory_delete: createMemoryDeleteTool(authToken, defaultLocale),
    memory_enable_pack: createMemoryEnablePackTool(authToken, defaultLocale),
  };
}
