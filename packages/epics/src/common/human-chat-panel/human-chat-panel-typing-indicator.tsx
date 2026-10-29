'use client';

import { useTranslations } from 'next-intl';
import type { ChatTypingPeer } from './use-chat-room-typing';

type HumanChatPanelTypingIndicatorProps = {
  peers: readonly ChatTypingPeer[];
};

export function HumanChatPanelTypingIndicator({
  peers,
}: HumanChatPanelTypingIndicatorProps) {
  const t = useTranslations('HumanChatPanel');
  if (peers.length === 0) return null;

  let label: string;
  if (peers.length === 1) {
    label = t('typingOne', { name: peers[0]!.name });
  } else if (peers.length === 2) {
    label = t('typingTwo', {
      name: peers[0]!.name,
      other: peers[1]!.name,
    });
  } else {
    label = t('typingMany', { count: peers.length });
  }

  return (
    <p
      className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 text-1 text-neutral-11"
      aria-live="polite"
      data-testid="human-chat-typing"
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="motion-safe:animate-pulse h-1 w-1 rounded-full bg-neutral-11/70" />
        <span
          className="motion-safe:animate-pulse h-1 w-1 rounded-full bg-neutral-11/70"
          style={{ animationDelay: '120ms' }}
        />
        <span
          className="motion-safe:animate-pulse h-1 w-1 rounded-full bg-neutral-11/70"
          style={{ animationDelay: '240ms' }}
        />
      </span>
      <span className="truncate">{label}</span>
    </p>
  );
}
