import 'server-only';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from '@hypha-platform/storage-postgres';
import {
  deleteIntelligenceBySpaceSlug,
  listIntelligenceBySpaceSlug,
  parseIntelligenceMarkdown,
  proposeIntelligencePatchForSignal,
  readIntelligenceBySpaceSlug,
  writeIntelligenceBySpaceSlug,
} from '@hypha-platform/core/server';
import {
  memoryCreateInputSchema,
  memoryCreateOutputSchema,
  memoryDeleteInputSchema,
  memoryDeleteOutputSchema,
  memoryListInputSchema,
  memoryListOutputSchema,
  memoryReadInputSchema,
  memoryReadOutputSchema,
  memorySearchInputSchema,
  memorySearchOutputSchema,
  memoryUpdateInputSchema,
  memoryUpdateOutputSchema,
} from './memory-intelligence-schema.js';
import {
  memoryPublishDenied,
  type MemoryToolAccess,
  type MemoryToolContext,
} from './memory-tool-context.js';

type ToolTextResult = {
  content: [{ type: 'text'; text: string }];
  structuredContent?: { [x: string]: unknown };
  isError?: boolean;
};

function invalidInput(message: string): ToolTextResult {
  return {
    content: [{ type: 'text', text: `Invalid input: ${message}` }],
    isError: true,
  };
}

function accessDenied(message: string): ToolTextResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function internalError(message: string): ToolTextResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function outputValidationFailed(message: string): ToolTextResult {
  return {
    content: [
      {
        type: 'text',
        text: `Internal error: output validation failed: ${message}`,
      },
    ],
    isError: true,
  };
}

async function resolveToolAccess(
  context: MemoryToolContext,
  input: {
    spaceSlug?: string;
    claimedSourceApp?: string;
    write: boolean;
  },
): Promise<
  { ok: true; access: MemoryToolAccess } | { ok: false; result: ToolTextResult }
> {
  const resolved = await context.resolveAccess(input);
  if (!resolved.ok) {
    return { ok: false, result: accessDenied(resolved.message) };
  }
  return { ok: true, access: resolved.access };
}

export function registerMemoryIntelligenceTools(
  server: McpServer,
  context: MemoryToolContext,
): void {
  server.registerTool(
    'memory.list',
    {
      description:
        'Read-only: list Space Intelligence Markdown artifacts for a space (manifest-backed). Same data as the Memory tab Intelligence cards / GET /api/v1/spaces/{slug}/intelligence. Optional type, status, and search filters. Requires BLOB_READ_WRITE_TOKEN for configured=true. Distinct from get_org_memory_by_space_slug (Documentation files).',
      inputSchema: memoryListInputSchema,
      outputSchema: memoryListOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const parsed = memoryListInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          write: false,
        });
        if (!resolved.ok) return resolved.result;

        const gated = await listIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            type: parsed.data.type,
            status: parsed.data.status,
            search: parsed.data.search,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
          },
          { db },
        );

        if (gated.access === 'denied') {
          return accessDenied(gated.message);
        }

        const structured = {
          space_slug: gated.space_slug,
          configured: gated.configured,
          artifacts: gated.artifacts,
          enabled_packs: gated.enabled_packs,
        };
        const outParse = memoryListOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }

        const count = outParse.data.artifacts.length;
        const summary = !outParse.data.configured
          ? `Space "${outParse.data.space_slug}": intelligence blob storage is not configured (set BLOB_READ_WRITE_TOKEN).`
          : `Space "${outParse.data.space_slug}": ${count} intelligence artifact(s).`;

        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.list] failed', err);
        return internalError('Internal error while listing intelligence');
      }
    },
  );

  server.registerTool(
    'memory.search',
    {
      description:
        'Read-only: search Space Intelligence artifacts for a space by title, id, or tags (same core list API as memory.list with a required query). Optional type/status filters.',
      inputSchema: memorySearchInputSchema,
      outputSchema: memorySearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const parsed = memorySearchInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          write: false,
        });
        if (!resolved.ok) return resolved.result;

        const gated = await listIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            type: parsed.data.type,
            status: parsed.data.status,
            search: parsed.data.query,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
          },
          { db },
        );

        if (gated.access === 'denied') {
          return accessDenied(gated.message);
        }

        const structured = {
          space_slug: gated.space_slug,
          configured: gated.configured,
          artifacts: gated.artifacts,
          enabled_packs: gated.enabled_packs,
        };
        const outParse = memorySearchOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }

        const count = outParse.data.artifacts.length;
        const summary = !outParse.data.configured
          ? `Space "${outParse.data.space_slug}": intelligence blob storage is not configured (set BLOB_READ_WRITE_TOKEN).`
          : `Space "${outParse.data.space_slug}": ${count} match(es) for "${parsed.data.query}".`;

        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.search] failed', err);
        return internalError('Internal error while searching intelligence');
      }
    },
  );

  server.registerTool(
    'memory.read',
    {
      description:
        'Read-only: read one Space Intelligence Markdown artifact (frontmatter + body) by space_slug and artifact_id. Same data as GET /api/v1/spaces/{slug}/intelligence/{artifactId}. Path must stay under intelligence/spaces/{slug}/.',
      inputSchema: memoryReadInputSchema,
      outputSchema: memoryReadOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const parsed = memoryReadInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          write: false,
        });
        if (!resolved.ok) return resolved.result;

        const gated = await readIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            artifactId: parsed.data.artifact_id,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
          },
          { db },
        );

        if (gated.access === 'denied') {
          return accessDenied(gated.message);
        }

        const artifact = gated.artifact;
        const structured = {
          space_slug: gated.space_slug,
          configured: gated.configured,
          found: Boolean(artifact),
          frontmatter: artifact?.frontmatter ?? null,
          body: artifact?.body ?? null,
          path: artifact?.path ?? null,
        };
        const outParse = memoryReadOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }

        const summary = !outParse.data.configured
          ? `Space "${outParse.data.space_slug}": intelligence blob storage is not configured (set BLOB_READ_WRITE_TOKEN).`
          : outParse.data.found
          ? `Read "${parsed.data.artifact_id}" (${outParse.data.path}).`
          : `No intelligence artifact "${parsed.data.artifact_id}" in space "${outParse.data.space_slug}".`;

        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.read] failed', err);
        return internalError('Internal error while reading intelligence');
      }
    },
  );

  server.registerTool(
    'memory.create',
    {
      description:
        'Write: create a new Space Intelligence Markdown artifact under intelligence/spaces/{slug}/. IBAs should use mode=draft. mode=publish is for space members. source_app is stamped from the authenticated app identity. Same core write API as POST /api/v1/spaces/{slug}/intelligence. Distinct from Documentation uploads.',
      inputSchema: memoryCreateInputSchema,
      outputSchema: memoryCreateOutputSchema,
    },
    async (args) => {
      const parsed = memoryCreateInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          claimedSourceApp: parsed.data.source_app,
          write: true,
        });
        if (!resolved.ok) return resolved.result;

        const publishDenied = memoryPublishDenied(
          parsed.data.mode,
          resolved.access.allowPublish,
        );
        if (publishDenied) {
          return accessDenied(publishDenied);
        }

        const result = await writeIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            markdown: parsed.data.markdown,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
            createOnly: true,
            canonicalSourceApp: resolved.access.canonicalSourceApp,
            callerPath: parsed.data.path,
            forceStatus: parsed.data.mode === 'draft' ? 'draft' : undefined,
            promoteDraft: parsed.data.mode === 'publish',
          },
          { db },
        );

        if (result.access !== 'ok') {
          const fail = {
            ok: false as const,
            error: result.message,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
          const outParse = memoryCreateOutputSchema.safeParse(fail);
          return {
            content: [{ type: 'text', text: result.message }],
            structuredContent: outParse.success ? outParse.data : fail,
            isError: true,
          };
        }

        const structured = {
          ok: true as const,
          space_slug: resolved.access.spaceSlug,
          created: result.created,
          path: result.artifact.path,
          sha: result.artifact.sha,
          source_app: result.artifact.frontmatter.source_app,
          frontmatter: result.artifact.frontmatter,
        };
        const outParse = memoryCreateOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }
        return {
          content: [
            {
              type: 'text',
              text: `Created "${result.artifact.frontmatter.id}" at ${
                result.artifact.path
              } (${result.artifact.sha.slice(0, 12)}…).`,
            },
          ],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.create] failed', err);
        return internalError('Internal error while creating intelligence');
      }
    },
  );

  server.registerTool(
    'memory.update',
    {
      description:
        'Write: update a Space Intelligence artifact. IBA/AI default mode=propose (stores a pending patch on signal_slug; members approve on Signal detail). mode=publish versions immediately (SHA-checked). source_app is stamped from the authenticated app identity.',
      inputSchema: memoryUpdateInputSchema,
      outputSchema: memoryUpdateOutputSchema,
    },
    async (args) => {
      const parsed = memoryUpdateInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          claimedSourceApp: parsed.data.source_app,
          write: true,
        });
        if (!resolved.ok) return resolved.result;

        const mode = parsed.data.mode ?? 'propose';
        const publishDenied = memoryPublishDenied(
          mode,
          resolved.access.allowPublish,
        );
        if (publishDenied) {
          return accessDenied(publishDenied);
        }

        if (mode === 'propose') {
          if (!parsed.data.signal_slug?.trim()) {
            const fail = {
              ok: false as const,
              error:
                'mode=propose requires signal_slug. Create a signal first (create_space_signal_by_slug), then members approve on Signal detail.',
            };
            return {
              content: [{ type: 'text', text: fail.error }],
              structuredContent: fail,
              isError: true,
            };
          }

          let targetId: string;
          try {
            targetId = parseIntelligenceMarkdown(parsed.data.markdown)
              .frontmatter.id;
          } catch {
            const fail = {
              ok: false as const,
              error:
                'Proposed markdown is not valid intelligence frontmatter + body.',
            };
            return {
              content: [{ type: 'text', text: fail.error }],
              structuredContent: fail,
              isError: true,
            };
          }

          const result = await proposeIntelligencePatchForSignal(
            {
              spaceSlug: resolved.access.spaceSlug,
              signalSlug: parsed.data.signal_slug,
              targetId,
              expectedSha: parsed.data.expected_sha,
              markdown: parsed.data.markdown,
              source_app: resolved.access.canonicalSourceApp,
              title: parsed.data.title,
              authToken: resolved.access.authToken,
              skipMembershipCheck: resolved.access.skipMembershipCheck,
              canonicalSourceApp: resolved.access.canonicalSourceApp,
              callerPath: parsed.data.path,
            },
            { db },
          );

          if (result.access !== 'ok') {
            const fail = {
              ok: false as const,
              error: result.message,
              ...(result.access === 'conflict' && result.currentSha
                ? { current_sha: result.currentSha }
                : {}),
            };
            return {
              content: [{ type: 'text', text: result.message }],
              structuredContent: fail,
              isError: true,
            };
          }

          const structured = {
            ok: true as const,
            mode: 'propose' as const,
            space_slug: result.space_slug,
            signal_slug: result.patch.signal_slug,
            target_id: result.patch.target_id,
            patch_status: result.patch.status,
            source_app: result.patch.source_app,
          };
          const outParse = memoryUpdateOutputSchema.safeParse(structured);
          if (!outParse.success) {
            return outputValidationFailed(outParse.error.message);
          }
          return {
            content: [
              {
                type: 'text',
                text: `Proposed patch for "${result.patch.target_id}" on signal "${result.patch.signal_slug}" (pending member approval).`,
              },
            ],
            structuredContent: outParse.data,
          };
        }

        const result = await writeIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            markdown: parsed.data.markdown,
            expectedSha: parsed.data.expected_sha,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
            updateOnly: true,
            canonicalSourceApp: resolved.access.canonicalSourceApp,
            callerPath: parsed.data.path,
            promoteDraft: true,
          },
          { db },
        );

        if (result.access !== 'ok') {
          const fail = {
            ok: false as const,
            error: result.message,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
          return {
            content: [{ type: 'text', text: result.message }],
            structuredContent: fail,
            isError: true,
          };
        }

        const structured = {
          ok: true as const,
          mode: 'publish' as const,
          space_slug: resolved.access.spaceSlug,
          created: result.created,
          path: result.artifact.path,
          sha: result.artifact.sha,
          source_app: result.artifact.frontmatter.source_app,
          frontmatter: result.artifact.frontmatter,
        };
        const outParse = memoryUpdateOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }
        return {
          content: [
            {
              type: 'text',
              text: `Published "${
                result.artifact.frontmatter.id
              }" (${result.artifact.sha.slice(0, 12)}…).`,
            },
          ],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.update] failed', err);
        return internalError('Internal error while updating intelligence');
      }
    },
  );

  server.registerTool(
    'memory.delete',
    {
      description:
        'Write: soft-archive a Space Intelligence artifact (manifest status=archived). Stored .md versions are not rewritten. Hard delete is rejected. Requires expected_sha.',
      inputSchema: memoryDeleteInputSchema,
      outputSchema: memoryDeleteOutputSchema,
      annotations: {
        destructiveHint: true,
      },
    },
    async (args) => {
      const parsed = memoryDeleteInputSchema.safeParse(args);
      if (!parsed.success) {
        return invalidInput(parsed.error.message);
      }

      try {
        const resolved = await resolveToolAccess(context, {
          spaceSlug: parsed.data.space_slug,
          write: true,
        });
        if (!resolved.ok) return resolved.result;

        const result = await deleteIntelligenceBySpaceSlug(
          {
            spaceSlug: resolved.access.spaceSlug,
            artifactId: parsed.data.artifact_id,
            expectedSha: parsed.data.expected_sha,
            hard: parsed.data.hard,
            authToken: resolved.access.authToken,
            skipMembershipCheck: resolved.access.skipMembershipCheck,
          },
          { db },
        );

        if (result.access !== 'ok') {
          const fail = {
            ok: false as const,
            error: result.message,
            ...(result.access === 'conflict' && result.currentSha
              ? { current_sha: result.currentSha }
              : {}),
          };
          return {
            content: [{ type: 'text', text: result.message }],
            structuredContent: fail,
            isError: true,
          };
        }

        const structured = {
          ok: true as const,
          space_slug: result.space_slug,
          artifact_id: result.artifact_id,
          archived: true as const,
          sha: result.entry.sha,
        };
        const outParse = memoryDeleteOutputSchema.safeParse(structured);
        if (!outParse.success) {
          return outputValidationFailed(outParse.error.message);
        }
        return {
          content: [
            {
              type: 'text',
              text: `Archived "${result.artifact_id}" in space "${result.space_slug}".`,
            },
          ],
          structuredContent: outParse.data,
        };
      } catch (err) {
        console.error('[hypha-mcp:memory.delete] failed', err);
        return internalError('Internal error while deleting intelligence');
      }
    },
  );
}
