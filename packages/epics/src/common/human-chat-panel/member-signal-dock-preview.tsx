'use client';

import {
  MEMBER_EYEBROW,
  MEMBER_ROW_TITLE,
} from '../../people/components/member-type';
import { cn } from '@hypha-platform/ui-utils';

type MemberSignalDockPreviewProps = {
  title: string;
  typeLabel?: string | null;
};

/**
 * Member home → right panel: compact signal header above the conversation.
 * Type + title only — image and body eat too much of the chat column.
 */
export function MemberSignalDockPreview({
  title,
  typeLabel,
}: MemberSignalDockPreviewProps) {
  return (
    <div
      className="shrink-0 border-b border-border bg-background px-3 pb-3 pt-2"
      data-testid="member-signal-dock-preview"
    >
      {typeLabel ? (
        <p className={cn(MEMBER_EYEBROW, 'text-[10px]')}>{typeLabel}</p>
      ) : null}
      <h2
        className={cn(
          MEMBER_ROW_TITLE,
          typeLabel ? 'mt-1.5' : null,
          'min-w-0 break-words',
        )}
      >
        {title}
      </h2>
    </div>
  );
}
