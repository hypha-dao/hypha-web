import type { ChatRouteTool } from './types';
import { getSpaceBySlugTool } from './get-space-by-slug';
import { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
import { createGetEcosystemBySpaceSlugTool } from './get-ecosystem-by-space-slug';
import { createGetSignalsBySpaceSlugTool } from './get-signals-by-space-slug';
import { createCreateSpaceSignalBySlugTool } from './create-space-signal-by-slug';
import { createRelayEcosystemSignalTool } from './relay-ecosystem-signal';
import { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
import { createFetchOrgMemoryAssetTool } from './fetch-org-memory-asset';
import { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';
import { createSummarizeSpaceDiscussionTool } from './summarize-space-discussion';
import { createIngestSpaceCallArtifactsTool } from './ingest-space-call-artifacts';
import { webSearchTool } from './web-search';

function safeTool(toolName: string, tool: ChatRouteTool): ChatRouteTool {
  const originalExecute = tool.execute as (
    ...args: unknown[]
  ) => Promise<unknown>;
  return {
    ...tool,
    execute: async (...args: unknown[]) => {
      try {
        return await originalExecute(...args);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unexpected tool error';
        return {
          ok: false,
          error: `Tool "${toolName}" failed: ${message}`,
        };
      }
    },
  };
}

/**
 * All AI SDK tools exposed by the chat route. Add new tools here and in the
 * system prompt so the model stays aligned with available capabilities.
 */
export function createChatTools(
  authToken: string,
  requestUrlForSessionMatrix?: string,
): Record<string, ChatRouteTool> {
  const tools: Record<string, ChatRouteTool> = {
    get_space_by_slug: safeTool('get_space_by_slug', getSpaceBySlugTool),
    get_ecosystem_by_space_slug: safeTool(
      'get_ecosystem_by_space_slug',
      createGetEcosystemBySpaceSlugTool(authToken),
    ),
    get_people_by_space_slug: safeTool(
      'get_people_by_space_slug',
      createGetPeopleBySpaceSlugTool(authToken),
    ),
    get_signals_by_space_slug: safeTool(
      'get_signals_by_space_slug',
      createGetSignalsBySpaceSlugTool(authToken),
    ),
    create_space_signal_by_slug: safeTool(
      'create_space_signal_by_slug',
      createCreateSpaceSignalBySlugTool(authToken),
    ),
    relay_ecosystem_signal: safeTool(
      'relay_ecosystem_signal',
      createRelayEcosystemSignalTool(authToken),
    ),
    get_org_memory_by_space_slug: safeTool(
      'get_org_memory_by_space_slug',
      createGetOrgMemoryBySpaceSlugTool(authToken, requestUrlForSessionMatrix),
    ),
    fetch_org_memory_asset: safeTool(
      'fetch_org_memory_asset',
      createFetchOrgMemoryAssetTool(authToken, requestUrlForSessionMatrix),
    ),
    get_documents_by_space_slug: safeTool(
      'get_documents_by_space_slug',
      createGetDocumentsBySpaceSlugTool(authToken),
    ),
    summarize_space_discussion_by_slug: safeTool(
      'summarize_space_discussion_by_slug',
      createSummarizeSpaceDiscussionTool(authToken, requestUrlForSessionMatrix),
    ),
    ingest_space_call_artifacts: safeTool(
      'ingest_space_call_artifacts',
      createIngestSpaceCallArtifactsTool(authToken),
    ),
    web_search: safeTool('web_search', webSearchTool),
  };
  return tools;
}

export { getSpaceBySlugTool } from './get-space-by-slug';
export { createGetEcosystemBySpaceSlugTool } from './get-ecosystem-by-space-slug';
export { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
export { createGetSignalsBySpaceSlugTool } from './get-signals-by-space-slug';
export { createCreateSpaceSignalBySlugTool } from './create-space-signal-by-slug';
export { createRelayEcosystemSignalTool } from './relay-ecosystem-signal';
export { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
export { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';
export { createFetchOrgMemoryAssetTool } from './fetch-org-memory-asset';
export { createSummarizeSpaceDiscussionTool } from './summarize-space-discussion';
export { createIngestSpaceCallArtifactsTool } from './ingest-space-call-artifacts';
export { webSearchTool } from './web-search';
export type { ChatRouteTool } from './types';
