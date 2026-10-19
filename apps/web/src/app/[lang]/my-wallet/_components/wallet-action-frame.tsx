import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { Container } from '@hypha-platform/ui';

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
      <Container className="flex max-w-2xl flex-col gap-5 py-6">
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
            {backLabel}
            <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
          </Link>
        </header>
        {children}
      </Container>
    </div>
  );
}
