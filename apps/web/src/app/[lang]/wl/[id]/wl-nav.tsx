'use client';
// SPIKE #2616: change point = reuse buildSpaceSectionNavItems, then filter and re-base hrefs.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildSpaceSectionNavItems } from '@hypha-platform/epics';
import { WL_VISIBLE_SECTIONS } from './wl-config';

export function WlNav({ lang, id }: { lang: string; id: string }) {
  const pathname = usePathname();
  const items = buildSpaceSectionNavItems({
    lang,
    spaceSlug: id,
    pathname: pathname.replace('/wl/', '/dho/'),
    energyEnabled: true,
    coherenceEnabled: false,
  })
    .filter((i) => WL_VISIBLE_SECTIONS.includes(i.key))
    .map((i) => ({ ...i, href: i.href.replace('/dho/', '/wl/') }));
  return (
    <nav className="flex gap-4 border-b pb-2">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={i.active ? 'font-bold' : ''}>
          {i.key}
        </Link>
      ))}
    </nav>
  );
}
