import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Container } from '@hypha-platform/ui';

export function WalletActionFrame({
  lang,
  backLabel,
  title,
  children,
}: {
  lang: string;
  backLabel: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full min-w-0 overflow-y-auto">
      <Container className="flex max-w-2xl flex-col gap-5 py-6">
        <Link
          href={`/${lang}/my-wallet`}
          className="inline-flex w-fit items-center gap-1 text-1 text-neutral-11 hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
        {title ? (
          <h1
            className="text-6 font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {title}
          </h1>
        ) : null}
        {children}
      </Container>
    </div>
  );
}
