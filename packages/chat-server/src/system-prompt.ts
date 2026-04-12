const BASE_SYSTEM_PROMPT =
  'You are Hypha AI, a helpful assistant for the Hypha DAO platform.';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeSlug(slug: string): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(trimmed) || trimmed.length > 128) return null;
  return trimmed;
}

export function buildSystemPrompt(spaceSlug?: string | null): string {
  if (spaceSlug) {
    const safe = sanitizeSlug(spaceSlug);
    if (!safe) return BASE_SYSTEM_PROMPT;
    return `${BASE_SYSTEM_PROMPT}\n\nThe user is currently viewing the space with slug "${safe}".\n\nTool choice:\n- get_space_by_slug: space profile and aggregate numbers only (title, description, member count, document count, subspace count). Use for "tell me about this space", stats, or overview — not for listing people or individual documents.\n- get_people_by_space_slug: the full member roster (people and space-type members, join times, membership fields). Use for "who are the members", "list members", "member names", roster, or join dates — always with space_slug "${safe}".\n- get_documents_by_space_slug: paginated list of documents in the space (titles, states, slugs, creators, proposals/agreements). Use for "what proposals", "list documents or agreements", "search documents in this space" — always with space_slug "${safe}".\n\nIf the user asks about members as people or a list, you must call get_people_by_space_slug, not get_space_by_slug. If they ask for document/proposal lists or document details from the catalogue, use get_documents_by_space_slug, not get_space_by_slug.`;
  }
  return BASE_SYSTEM_PROMPT;
}
