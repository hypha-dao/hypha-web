'use client';

import { setEcosystemMenuBrand } from '@hypha-platform/ui';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

const LOCALES = new Set(['en', 'de', 'es', 'fr', 'pt']);

type BrandPayload = {
  logoUrl: string;
  homeHref: string;
  imageAlt: string;
};

/**
 * Sets global MenuTop (root layout) to the ecosystem root logo for this DHO tree.
 * Clears on unmount (navigate away) so network / my-spaces get Hypha again.
 */
export function DhoEcosystemMenuTopBridge() {
  const params = useParams<{ id?: string; lang?: string }>();
  const slug = typeof params.id === 'string' ? params.id : '';
  const rawLang = params.lang;
  const lang =
    typeof rawLang === 'string' && LOCALES.has(rawLang) ? rawLang : 'en';
  useEffect(() => {
    if (!slug) {
      setEcosystemMenuBrand(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const q = new URLSearchParams({ lang });
      const res = await fetch(
        `/api/dho/ecosystem-menu-brand/${encodeURIComponent(slug)}?${q}`,
        { method: 'GET' },
      );
      if (cancelled) return;
      if (!res.ok) {
        setEcosystemMenuBrand(null);
        return;
      }
      const data = (await res.json()) as BrandPayload;
      setEcosystemMenuBrand({
        logoUrl: data.logoUrl,
        href: data.homeHref,
        label: data.imageAlt,
      });
    })().catch(() => {
      if (!cancelled) setEcosystemMenuBrand(null);
    });
    return () => {
      cancelled = true;
      setEcosystemMenuBrand(null);
    };
  }, [slug, lang]);

  return null;
}
