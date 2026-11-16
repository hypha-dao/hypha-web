import type { QuestHealthState } from '@hypha-platform/core/client';

export function healthBadgeMeta(state: QuestHealthState): {
  dotClass: string;
  textClass: string;
  label: string;
} {
  switch (state) {
    case 'at_risk':
      return {
        dotClass: 'bg-[#d99a1e]',
        textClass: 'text-[#d99a1e]',
        label: 'At risk',
      };
    case 'off_track':
      return {
        dotClass: 'bg-[#d2463c]',
        textClass: 'text-[#d2463c]',
        label: 'Off track',
      };
    default:
      return {
        dotClass: 'bg-[#2e9e5b]',
        textClass: 'text-[#2e9e5b]',
        label: 'On track',
      };
  }
}

export function formatRelativeTimeShort(
  iso: string | null | undefined,
): string {
  if (!iso) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 90) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 14) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}
