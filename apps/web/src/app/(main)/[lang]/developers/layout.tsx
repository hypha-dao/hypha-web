import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from '@hypha-platform/ui';

/**
 * Own layout for the developer area: nothing outside this folder (except the
 * menu entry) knows about it, so it can later move to a separate developer
 * site with a layout of its own.
 */
export default async function DevelopersLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const base = `/${lang}/developers`;
  return (
    <Container className="flex flex-col gap-6 py-8">
      <div
        role="note"
        className="border border-border bg-background-2 px-4 py-2 text-2 text-muted-foreground"
      >
        Work in progress: this developer area is early and will change.
      </div>
      <nav className="flex gap-4 border-b border-border pb-3 text-2 font-medium">
        <Link href={base}>Overview</Link>
        <Link href={`${base}/clients`}>My clients</Link>
        <Link href={`${base}/clients/new`}>Register a client</Link>
      </nav>
      {children}
    </Container>
  );
}
