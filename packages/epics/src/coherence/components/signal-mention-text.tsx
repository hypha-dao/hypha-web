'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  personProfileHref,
  splitSignalMentionText,
} from '@hypha-platform/core/client';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';

export function SignalMentionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lang = useLocale();
  const segments = React.useMemo(() => splitSignalMentionText(text), [text]);
  const plainPart = (part: string) =>
    stripDescription(
      stripMarkdown(part, {
        orderedListMarkers: false,
        unorderedListMarkers: false,
      }),
    );

  if (segments.every((segment) => segment.type === 'text')) {
    return <span className={className}>{plainPart(text)}</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <React.Fragment key={index}>
              {plainPart(segment.value)}
            </React.Fragment>
          );
        }
        return (
          <Link
            key={`${segment.mention.slug}-${index}`}
            href={personProfileHref(segment.mention.slug, lang)}
            className="font-medium text-accent-11 underline-offset-2 hover:underline"
          >
            @{segment.mention.label}
          </Link>
        );
      })}
    </span>
  );
}
