import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getTokenHoldingsBySpaceSlug,
  getDocumentsBySpaceSlug,
  getOrgMemoryBySpaceSlug,
  fetchOrgMemoryAsset,
  ingestSpaceCallArtifacts,
  createSpaceDiscussionSummary,
  getSpaceMembersRoster,
  serializeSpaceMembersRosterDatesForJson,
} from '@hypha-platform/core/server';
import {
  getPeopleBySpaceSlugInputSchema,
  getPeopleBySpaceSlugOutputSchema,
} from './get-people-by-space-slug-schema.js';
import {
  getDocumentsBySpaceSlugInputSchema,
  getDocumentsBySpaceSlugOutputSchema,
} from './get-documents-by-space-slug-schema.js';
import {
  getTokenHoldingsBySpaceSlugInputSchema,
  getTokenHoldingsBySpaceSlugOutputSchema,
} from './get-token-holdings-by-space-slug-schema.js';
import {
  getOrgMemoryBySpaceSlugInputSchema,
  getOrgMemoryBySpaceSlugOutputSchema,
} from './get-org-memory-by-space-slug-schema.js';
import {
  fetchOrgMemoryAssetInputSchema,
  fetchOrgMemoryAssetOutputSchema,
} from './fetch-org-memory-asset-schema.js';
import {
  summarizeSpaceDiscussionInputSchema,
  summarizeSpaceDiscussionOutputSchema,
} from './summarize-space-discussion-schema.js';
import {
  ingestSpaceCallArtifactsInputSchema,
  ingestSpaceCallArtifactsOutputSchema,
} from './ingest-space-call-artifacts-schema.js';
import { buildMatrixDiagnosticHint } from './build-matrix-diagnostic-hint.js';

const server = new McpServer(
  {
    name: 'hypha-mcp',
    version: '0.0.0',
  },
  {
    instructions:
      'Hypha tools: token holdings by space slug; space members by slug; org memory (roster + org_memory_assets with asset_key) by slug; fetch_org_memory_asset reads asset bytes (text/PDF; image/video/Office base64 in auto) with caps; documents in a space by slug; summarize_space_discussion_by_slug for matrix chat summaries; ingest_space_call_artifacts to persist recording/transcript artifacts.',
  },
);

server.registerTool(
  'summarize_space_discussion_by_slug',
  {
    description:
      'Create and persist a summary of recent matrix chat discussion for a space slug. Stores output in space discussion summaries so it appears in org memory.',
    inputSchema: summarizeSpaceDiscussionInputSchema,
    outputSchema: summarizeSpaceDiscussionOutputSchema,
  },
  async (args) => {
    const parsed = summarizeSpaceDiscussionInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          { type: 'text', text: `Invalid input: ${parsed.error.message}` },
        ],
        isError: true,
      };
    }
    const result = await createSpaceDiscussionSummary(
      {
        spaceSlug: parsed.data.space_slug,
        authToken: process.env.HYPHA_MCP_AUTH_TOKEN,
        requestUrlForSessionMatrix:
          process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
          (process.env.VERCEL_URL?.trim()
            ? `https://${process.env.VERCEL_URL.trim()}`
            : undefined),
      },
      { db },
    );
    const out = result.ok
      ? {
          ok: true,
          summaryId: result.summaryId,
          messageCount: result.messageCount,
          participantCount: result.participantCount,
        }
      : { ok: false, error: result.error };
    return {
      content: [
        {
          type: 'text',
          text: result.ok
            ? `Stored discussion summary #${result.summaryId} from ${result.messageCount} messages.`
            : `Failed to summarize discussion: ${result.error}`,
        },
      ],
      structuredContent: out,
      ...(result.ok ? {} : { isError: true }),
    };
  },
);

server.registerTool(
  'ingest_space_call_artifacts',
  {
    description:
      'Persist call recording and/or transcript metadata for a space and call session. Use this when external workers produce recording URLs or STT results.',
    inputSchema: ingestSpaceCallArtifactsInputSchema,
    outputSchema: ingestSpaceCallArtifactsOutputSchema,
  },
  async (args) => {
    const parsed = ingestSpaceCallArtifactsInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          { type: 'text', text: `Invalid input: ${parsed.error.message}` },
        ],
        isError: true,
      };
    }
    const result = await ingestSpaceCallArtifacts(
      {
        spaceSlug: parsed.data.space_slug,
        callSessionId: parsed.data.call_session_id,
        recording: parsed.data.recording
          ? {
              mediaUri: parsed.data.recording.media_uri,
              mimeType: parsed.data.recording.mime_type,
              durationSeconds: parsed.data.recording.duration_seconds,
              startedAt: parsed.data.recording.started_at,
              endedAt: parsed.data.recording.ended_at,
              storageKey: parsed.data.recording.storage_key,
              source: parsed.data.recording.source,
              metadata: parsed.data.recording.metadata,
            }
          : undefined,
        transcript: parsed.data.transcript
          ? {
              language: parsed.data.transcript.language,
              text: parsed.data.transcript.text,
              summary: parsed.data.transcript.summary,
              source: parsed.data.transcript.source,
              segments: parsed.data.transcript.segments,
              metadata: parsed.data.transcript.metadata,
            }
          : undefined,
      },
      { db },
    );
    const out = result.ok
      ? {
          ok: true,
          spaceId: result.spaceId,
          callSessionId: result.callSessionId,
        }
      : { ok: false, error: result.error };
    return {
      content: [
        {
          type: 'text',
          text: result.ok
            ? `Ingested call artifacts for session ${result.callSessionId}.`
            : `Failed to ingest call artifacts: ${result.error}`,
        },
      ],
      structuredContent: out,
      ...(result.ok ? {} : { isError: true }),
    };
  },
);

server.registerTool(
  'get_people_by_space_slug',
  {
    description:
      'Read-only: list members of the active Hypha space (by slug), including people and other spaces that are members (on-chain roster). Includes full memberships row fields for people when present in the database.',
    inputSchema: getPeopleBySpaceSlugInputSchema,
    outputSchema: getPeopleBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getPeopleBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const { space_slug, page, page_size, searchTerm } = parsed.data;

    const host = await findSpaceBySlug({ slug: space_slug }, { db });
    if (host) {
      const authToken = process.env.HYPHA_MCP_AUTH_TOKEN;
      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) {
        return {
          content: [
            {
              type: 'text',
              text: access.message,
            },
          ],
          isError: true,
        };
      }
    }

    const raw = await getSpaceMembersRoster(
      {
        spaceSlug: space_slug,
        page,
        pageSize: page_size,
        searchTerm,
      },
      { db },
    );

    const structured = serializeSpaceMembersRosterDatesForJson(raw);
    const outParse = getPeopleBySpaceSlugOutputSchema.safeParse(structured);
    if (!outParse.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Internal error: output validation failed: ${outParse.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const peopleCount = structured.found
      ? structured.members.filter((m) => m.member_kind === 'person').length
      : 0;
    const spaceCount = structured.found
      ? structured.members.filter((m) => m.member_kind === 'space').length
      : 0;

    const summary = structured.found
      ? `Space "${structured.space_slug}": page ${
          structured.pagination.page
        }/${Math.max(
          structured.pagination.total_pages,
          1,
        )} — ${peopleCount} people, ${spaceCount} space members on this page (total ${
          structured.pagination.total
        }).`
      : `No space found for slug "${structured.space_slug}".`;

    return {
      content: [{ type: 'text', text: summary }],
      structuredContent: outParse.data,
    };
  },
);

server.registerTool(
  'get_org_memory_by_space_slug',
  {
    description:
      'Read-only: organisation memory for a space by slug — same member roster as get_people_by_space_slug plus org_memory_assets (proposal attachments and lead images from documents; Matrix m.file/m.image when NEXT_PUBLIC_MATRIX_HOMESERVER_URL and chat_room_id are set, and either HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN or HYPHA_MCP_AUTH_TOKEN + HYPHA_MCP_MATRIX_REQUEST_URL / VERCEL_URL for session Matrix token resolution). structuredContent matrix_fetch includes used_bot_access_token, used_session_matrix_token, session_matrix_token_unavailable, skipped_reason, http_status, events_in_chunk, media_events_yielded, error. Optional assets_page, assets_page_size, assets_search paginate/filter assets separately from the roster.',
    inputSchema: getOrgMemoryBySpaceSlugInputSchema,
    outputSchema: getOrgMemoryBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getOrgMemoryBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const {
      space_slug,
      page,
      page_size,
      searchTerm,
      assets_page,
      assets_page_size,
      assets_search,
    } = parsed.data;

    const mcpMatrixRequestUrl =
      process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
      (process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : undefined);

    try {
      const gated = await getOrgMemoryBySpaceSlug(
        {
          spaceSlug: space_slug,
          page,
          pageSize: page_size,
          searchTerm,
          assetsPage: assets_page,
          assetsPageSize: assets_page_size,
          assetsSearch: assets_search,
          requestUrlForSessionMatrix: mcpMatrixRequestUrl,
        },
        { db, authToken: process.env.HYPHA_MCP_AUTH_TOKEN },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = getOrgMemoryBySpaceSlugOutputSchema.safeParse(
        gated.result,
      );
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const structured = outParse.data;
      const peopleCount = structured.found
        ? structured.members.filter((m) => m.member_kind === 'person').length
        : 0;
      const spaceCount = structured.found
        ? structured.members.filter((m) => m.member_kind === 'space').length
        : 0;
      const assetCount = structured.found
        ? structured.org_memory_assets.length
        : 0;

      const mf = structured.found ? structured.matrix_fetch : null;
      const matrixHint = buildMatrixDiagnosticHint(mf);

      const summary = structured.found
        ? `Space "${structured.space_slug}": roster page ${
            structured.pagination.page
          }/${Math.max(
            structured.pagination.total_pages,
            1,
          )} — ${peopleCount} people, ${spaceCount} space members (total members ${
            structured.pagination.total
          }); assets page ${structured.assets_pagination.page}/${Math.max(
            structured.assets_pagination.total_pages,
            1,
          )} — ${assetCount} asset(s) on this page (total assets ${
            structured.assets_pagination.total
          }).${matrixHint}`
        : `No space found for slug "${structured.space_slug}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: structured,
      };
    } catch (err) {
      console.error('[hypha-mcp:get_org_memory_by_space_slug] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching org memory',
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'fetch_org_memory_asset',
  {
    description:
      'Read-only: fetch content for one org-memory asset after listing with get_org_memory_by_space_slug. Input: space_slug + asset_key from org_memory_assets[]. Supports proposal files (HTTPS), matrix media (server-side download), call transcripts, and discussion summaries. return_mode auto: UTF-8 text + PDF text extraction + image/* as base64; text_only skips binary; binary_as_base64 returns raw base64 for image/video/pdf/office. max_bytes caps download (default 2 MiB, max 4 MiB).',
    inputSchema: fetchOrgMemoryAssetInputSchema,
    outputSchema: fetchOrgMemoryAssetOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = fetchOrgMemoryAssetInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          { type: 'text', text: `Invalid input: ${parsed.error.message}` },
        ],
        isError: true,
      };
    }

    const { space_slug, asset_key, return_mode, max_bytes } = parsed.data;
    const mcpMatrixRequestUrl =
      process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
      (process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : undefined);

    try {
      const gated = await fetchOrgMemoryAsset(
        {
          spaceSlug: space_slug,
          asset_key,
          return_mode,
          max_bytes,
        },
        {
          db,
          authToken: process.env.HYPHA_MCP_AUTH_TOKEN,
          requestUrlForSessionMatrix: mcpMatrixRequestUrl,
        },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = fetchOrgMemoryAssetOutputSchema.safeParse(gated.result);
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const r = outParse.data;
      const summary = r.ok
        ? r.mode === 'text'
          ? `Fetched ${r.filename} (${r.mime}) — text mode, ${
              r.byte_length
            } bytes${r.text_truncated ? ', truncated' : ''}.`
          : `Fetched ${r.filename} (${r.mime}) — binary base64, ${r.byte_length} bytes.`
        : `Failed: ${r.error}${r.code ? ` (${r.code})` : ''}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: r,
      };
    } catch (err) {
      console.error('[hypha-mcp:fetch_org_memory_asset] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching org memory asset',
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_token_holdings_by_space_slug',
  {
    description:
      'Read-only: token holdings transparency view for a space by slug. Returns one row per minted token with holder distribution, including treasury as a dedicated slice and holders below 3% collapsed into Other.',
    inputSchema: getTokenHoldingsBySpaceSlugInputSchema,
    outputSchema: getTokenHoldingsBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getTokenHoldingsBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const {
      space_slug,
      include_zero_balances,
      holder_limit,
      include_treasury,
    } = parsed.data;

    try {
      const gated = await getTokenHoldingsBySpaceSlug(
        {
          spaceSlug: space_slug,
          includeZeroBalances: include_zero_balances,
          holderLimit: holder_limit,
          includeTreasury: include_treasury,
        },
        { db, authToken: process.env.HYPHA_MCP_AUTH_TOKEN },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = getTokenHoldingsBySpaceSlugOutputSchema.safeParse(
        gated.result,
      );
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const structured = outParse.data;
      const tokenCount = structured.tokens.length;
      const summary = structured.found
        ? `Space "${structured.space_slug}": ${tokenCount} token(s) with holdings distribution.`
        : `No space found for slug "${structured.space_slug}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: structured,
      };
    } catch (err) {
      console.error('[hypha-mcp:get_token_holdings_by_space_slug] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching token holdings',
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_documents_by_space_slug',
  {
    description:
      'Read-only: list documents in a Hypha space by slug (DB documents table: title, state, slug, label, web3 proposal id, attachments, creator summary, timestamps). Supports full-text search on title/description and optional state filter. Same access rules as member roster for non-public spaces.',
    inputSchema: getDocumentsBySpaceSlugInputSchema,
    outputSchema: getDocumentsBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getDocumentsBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const { space_slug, page, page_size, searchTerm, state } = parsed.data;

    try {
      const gated = await getDocumentsBySpaceSlug(
        {
          spaceSlug: space_slug,
          page,
          pageSize: page_size,
          searchTerm,
          state,
        },
        { db, authToken: process.env.HYPHA_MCP_AUTH_TOKEN },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = getDocumentsBySpaceSlugOutputSchema.safeParse(
        gated.result,
      );
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const structured = outParse.data;
      const summary = structured.found
        ? `Space "${structured.space_slug}": page ${
            structured.pagination.page
          }/${Math.max(structured.pagination.total_pages, 1)} — ${
            structured.documents.length
          } documents (total ${structured.pagination.total}).`
        : `No space found for slug "${structured.space_slug}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: structured,
      };
    } catch (err) {
      console.error('[hypha-mcp:get_documents_by_space_slug] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching documents',
          },
        ],
        isError: true,
      };
    }
  },
);

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[hypha-mcp] Unhandled rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err: unknown) => {
  console.error('[hypha-mcp] Uncaught exception:', err);
  process.exit(1);
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err: unknown) => {
  console.error('[hypha-mcp] Failed to start:', err);
  process.exit(1);
});
