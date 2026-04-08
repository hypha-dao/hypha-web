import type { ChatRouteTool } from './types.js';
import { getSpaceBySlugTool } from './get-space-by-slug.js';
import { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug.js';

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
  };
}

export { getSpaceBySlugTool } from './get-space-by-slug.js';
export { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug.js';
export type { ChatRouteTool } from './types.js';
