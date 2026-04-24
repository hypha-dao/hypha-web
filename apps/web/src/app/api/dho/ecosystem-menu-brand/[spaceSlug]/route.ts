import {
  findSpaceBySlug,
  getSpaceAncestorChain,
} from '@hypha-platform/core/server';
import { isSafeImageUrl } from '@hypha-platform/epics';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

const LOCALES = new Set(['en', 'de', 'es', 'fr', 'pt']);

type Body = {
  logoUrl: string;
  homeHref: string;
  imageAlt: string;
  rootSpaceSlug: string;
  rootSpaceTitle: string;
};

/**
 * Ecosystem (root) logo for MenuTop whitelabeling on DHO. Public read.
 * `lang` query must match the active locale (default `en`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  if (!spaceSlug) {
    return NextResponse.json({ error: 'Missing space slug' }, { status: 400 });
  }

  const rawLang = request.nextUrl.searchParams.get('lang')?.trim() ?? 'en';
  const lang = LOCALES.has(rawLang) ? rawLang : 'en';

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const chain = await getSpaceAncestorChain(
      { leafSpaceId: space.id },
      { db },
    );
    const root = chain[0] ?? space;
    const rawLogo = root.logoUrl?.trim();
    const logoUrl =
      rawLogo && isSafeImageUrl(rawLogo) ? rawLogo : DEFAULT_SPACE_AVATAR_IMAGE;
    const homeHref = `/${lang}/dho/${root.slug}/agreements`;
    const imageAlt = `${root.title} logo`;
    const body: Body = {
      logoUrl,
      homeHref,
      imageAlt,
      rootSpaceSlug: root.slug,
      rootSpaceTitle: root.title,
    };
    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('[ecosystem-menu-brand]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
