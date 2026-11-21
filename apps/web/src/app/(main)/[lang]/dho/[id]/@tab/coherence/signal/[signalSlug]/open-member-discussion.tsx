'use client';

import { useEffect, useRef } from 'react';
import { useHumanChatPanel, useMemberExperience } from '@hypha-platform/epics';

/**
 * Members who open a signal land on the detail and the discussion slides
 * open. Everyone else keeps the panel closed.
 */
export function OpenMemberDiscussion({
  enabled,
  spaceSlug,
  slug,
  title,
  description,
  roomId,
}: {
  enabled: boolean;
  spaceSlug: string;
  slug: string;
  title: string;
  description: string | null;
  roomId: string | null;
}) {
  const { isMember, settled } = useMemberExperience();
  const { openCoherenceChat } = useHumanChatPanel();
  const opened = useRef(false);

  useEffect(() => {
    if (!enabled || !settled || !isMember) return;
    if (opened.current) return;
    opened.current = true;
    openCoherenceChat(roomId, title, slug, description, spaceSlug);
  }, [
    description,
    enabled,
    isMember,
    openCoherenceChat,
    roomId,
    settled,
    slug,
    spaceSlug,
    title,
  ]);

  return null;
}
