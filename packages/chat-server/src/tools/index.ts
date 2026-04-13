import type { ChatRouteTool } from './types';
import { getSpaceBySlugTool } from './get-space-by-slug';
import { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
import { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
import { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';

/**
 * All AI SDK tools exposed by the chat route. Add new tools here and in the
 * system prompt so the model stays aligned with available capabilities.
 */
export function createChatTools(
  authToken: string,
): Record<string, ChatRouteTool> {
  return {
    get_space_by_slug: getSpaceBySlugTool,
    get_people_by_space_slug: createGetPeopleBySpaceSlugTool(authToken),
    get_org_memory_by_space_slug: createGetOrgMemoryBySpaceSlugTool(authToken),
    get_documents_by_space_slug: createGetDocumentsBySpaceSlugTool(authToken),
  };
}

export { getSpaceBySlugTool } from './get-space-by-slug';
export { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
export { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
export { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';
export type { ChatRouteTool } from './types';
