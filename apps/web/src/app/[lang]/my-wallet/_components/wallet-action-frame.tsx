import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';

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
  return (
    <div className="w-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 xl:gap-9 xl:px-9 xl:py-9">
        <header className="flex items-start justify-between gap-4">
          <h1
            className="min-w-0 text-6 font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
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
