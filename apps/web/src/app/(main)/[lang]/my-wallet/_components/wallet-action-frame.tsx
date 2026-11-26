'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { MEMBER_PAGE_TITLE, useMemberExperience } from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

export function WalletActionFrame({
  lang,
  backLabel,
  title,
  children,
}: {
  lang: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}) {
  const { isMember } = useMemberExperience();

  return (
    <div className="w-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 xl:gap-9 xl:px-9 xl:py-9">
        <header className="flex items-start justify-between gap-4">
          <h1
            className={cn(
              'min-w-0',
              isMember
                ? MEMBER_PAGE_TITLE
                : 'craft-page-title m-0 text-6 font-medium',
            )}
          >
            {title}
          </h1>
          <Link
            href={`/${lang}/my-wallet`}
            className="inline-flex shrink-0 items-center gap-1 pt-1 text-1 text-neutral-11 hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4 shrink-0" aria-hidden />
            {backLabel}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
