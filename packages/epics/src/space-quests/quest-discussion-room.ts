/**
 * Room opened by a saved quest's "Open discussion" control.
 *
 * An accepted quest uses its own Matrix room (`space_quests.chat_room_id`),
 * which the server creates when the proposal is accepted. A proposed quest
 * has no quest room yet, so the discussion is the proposal document's room —
 * the same lazy create-or-join Proposal discussion already uses. This does
 * not create a quest-typed Matrix room from the client.
 */

export function proposalDiscussionRoomTitle(
  title: string | null | undefined,
): string {
  const trimmed = title?.trim();
  return trimmed ? `Proposal: ${trimmed}` : 'Proposal discussion';
}

export async function loadProposalDiscussionRoomId(
  slug: string,
  authToken: string | null,
): Promise<string | null> {
  const headers: HeadersInit = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(
    `/api/v1/documents/${encodeURIComponent(slug)}/`,
    { headers },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { chatRoomId?: string | null };
  const roomId = body.chatRoomId?.trim();
  return roomId || null;
}

export async function resolveQuestDiscussionRoomId({
  questRoomId,
  proposalSlug,
  proposalTitle,
  authToken,
  loadProposalRoomId,
  createProposalRoom,
  persistProposalRoomId,
}: {
  questRoomId: string | null;
  proposalSlug: string | null;
  proposalTitle: string;
  authToken: string | null;
  loadProposalRoomId: (slug: string) => Promise<string | null>;
  createProposalRoom: (title: string) => Promise<string>;
  persistProposalRoomId: (slug: string, roomId: string) => Promise<void>;
}): Promise<string | null> {
  const questRoom = questRoomId?.trim() || null;
  if (questRoom) return questRoom;

  const slug = proposalSlug?.trim();
  if (!slug) return null;

  const existing = (await loadProposalRoomId(slug))?.trim() || null;
  if (existing) return existing;

  // Creating without a token would leave a room the document cannot store.
  if (!authToken?.trim()) return null;

  const created = (
    await createProposalRoom(proposalDiscussionRoomTitle(proposalTitle))
  ).trim();
  if (!created) return null;

  try {
    await persistProposalRoomId(slug, created);
  } catch (error) {
    console.warn('[quest discussion] failed to store the proposal room', error);
  }
  return created;
}
