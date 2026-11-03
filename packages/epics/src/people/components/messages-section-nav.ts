import type { ElementType } from 'react';
import { Archive, MessagesSquare, Sparkles } from 'lucide-react';

export type MessagesSectionNavKey = 'messages' | 'suggestions' | 'archived';

export type MessagesSectionLabelKey =
  | 'tabs.messages'
  | 'tabs.suggestions'
  | 'tabs.archived';

export type MessagesSectionNavItem = {
  key: MessagesSectionNavKey;
  labelKey: MessagesSectionLabelKey;
  href: string;
  icon: ElementType;
};

/** Messages left rail and mobile secondary strip. */
export function buildMessagesSectionNavItems(
  basePath: string,
): MessagesSectionNavItem[] {
  const base = basePath.replace(/\/$/, '');
  return [
    {
      key: 'messages',
      labelKey: 'tabs.messages',
      href: base,
      icon: MessagesSquare,
    },
    {
      key: 'suggestions',
      labelKey: 'tabs.suggestions',
      href: `${base}/suggestions`,
      icon: Sparkles,
    },
    {
      key: 'archived',
      labelKey: 'tabs.archived',
      href: `${base}/archived`,
      icon: Archive,
    },
  ];
}

/** `/{lang}/messages` and the old `/{lang}/connections` address. */
export function isMessagesSectionPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return /^\/[^/]+\/(?:messages|connections)(?:\/|$)/.test(pathname);
}

export function isMessagesSectionNavActive(
  item: MessagesSectionNavItem,
  pathname: string,
): boolean {
  if (item.key === 'messages') {
    return (
      pathname === item.href ||
      pathname === `${item.href}/` ||
      /^\/[^/]+\/connections\/?$/.test(pathname)
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
