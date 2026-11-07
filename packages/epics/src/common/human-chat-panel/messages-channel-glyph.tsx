import type { ComponentType } from 'react';
import {
  BookOpen,
  Circle,
  FileText,
  Flag,
  Globe,
  Globe2,
  Radio,
  Target,
} from 'lucide-react';

import type { CoherenceOpenedChannel } from '../human-chat-panel-context';

export type ChannelGlyphIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}>;

/** Trailing type mark for Messages-opened channels (network earth, signal radio, …). */
export const MESSAGES_CHANNEL_GLYPH: Record<
  CoherenceOpenedChannel,
  ChannelGlyphIcon
> = {
  network: Globe2,
  space: Circle,
  'space-public': Globe,
  ecosystem: Target,
  signal: Radio,
  quest: Flag,
  proposal: FileText,
  context: BookOpen,
};

export function messagesChannelGlyph(
  channel: CoherenceOpenedChannel | null | undefined,
): ChannelGlyphIcon | null {
  if (!channel) return null;
  return MESSAGES_CHANNEL_GLYPH[channel] ?? null;
}
