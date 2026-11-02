// SPIKE #2616: minimal Space chrome for the white-label tree.
import { notFound } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { WlNav } from './wl-nav';
import { WlAuth } from './wl-auth';
import { getWlAllowedSlugs } from './wl-config';

export default async function WlSpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id, lang } = await params;
  // Q1.4: host restriction is enforced by the host mapping; this is the approved-list check (D1).
  if (!getWlAllowedSlugs().includes(id)) return notFound();
  const space = await findSpaceBySlug({ slug: id }, { db });
  if (!space) return notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <header className="flex items-center gap-3 pb-3">
        {space.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={space.logoUrl} alt="" className="h-10 w-10 rounded" />
        ) : null}
        <h1 className="text-xl font-semibold">{space.title}</h1>
        <WlAuth />
      </header>
      <WlNav lang={lang} id={id} />
      {children}
    </div>
  );
}
