'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  parseSignalMentions,
  personProfileHref,
} from '@hypha-platform/core/client';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';

const MENTION_SPLIT_RE =
  /(\[@[^\]]+\]\((?:(?:\/[a-z]{2})?\/profile\/|hypha-person:)[^)\s]+\))/gi;

export function SignalMentionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lang = useLocale();
  const mentions = React.useMemo(() => parseSignalMentions(text), [text]);
  const plainPart = (part: string) =>
    stripDescription(
      stripMarkdown(part, {
        orderedListMarkers: false,
        unorderedListMarkers: false,
      }),
    );
  if (mentions.length === 0) {
    return <span className={className}>{plainPart(text)}</span>;
  }

  const parts = text.split(MENTION_SPLIT_RE);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const mention = parseSignalMentions(part)[0];
        if (!mention)
          return <React.Fragment key={index}>{plainPart(part)}</React.Fragment>;
        return (
          <Link
            key={`${mention.slug}-${index}`}
            href={personProfileHref(mention.slug, lang)}
            className="font-medium text-accent-11 underline-offset-2 hover:underline"
          >
            @{mention.label}
          </Link>
        );
      })}
    </span>
  );
}
