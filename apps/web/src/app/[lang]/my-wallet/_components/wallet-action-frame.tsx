import Link from 'next/link';
import type { ReactNode } from 'react';
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
          className="text-1 text-neutral-11 hover:text-foreground"
        >
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
