'use client';

import {
  MEMBER_BODY,
  MEMBER_EYEBROW,
  MEMBER_ROW_TITLE,
} from '../../people/components/member-type';
import { cn, stripDescription } from '@hypha-platform/ui-utils';

function plainText(value: string) {
  return stripDescription(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type MemberSignalDockPreviewProps = {
  title: string;
  description?: string | null;
  leadImage?: string | null;
  typeLabel?: string | null;
};

/**
 * Member home → right panel: signal image + copy above the conversation,
 * matching energy-community SignalDetail (skip the full detail page).
 */
export function MemberSignalDockPreview({
  title,
  description,
  leadImage,
  typeLabel,
}: MemberSignalDockPreviewProps) {
  const body = description ? plainText(description) : '';
  const image =
    leadImage &&
    (leadImage.startsWith('https://') ||
      leadImage.startsWith('http://') ||
      leadImage.startsWith('/'))
      ? leadImage
      : null;

  return (
    <div
      className="shrink-0 border-b border-border bg-background px-3 pb-3 pt-2"
      data-testid="member-signal-dock-preview"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="mb-3 aspect-[16/9] w-full object-cover"
        />
      ) : null}
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
      {body ? (
        <p
          className={cn(
            MEMBER_BODY,
            'mt-1.5 line-clamp-4 min-w-0 text-[12px] leading-[1.45] text-muted-foreground',
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}
