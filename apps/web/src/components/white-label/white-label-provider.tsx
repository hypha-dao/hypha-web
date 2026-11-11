'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { routing } from '@hypha-platform/i18n';
import {
  classifyLink,
  sectionHref,
  type WhiteLabelLinkContext,
} from '@web/lib/white-label/link';

const WhiteLabelContext = React.createContext<WhiteLabelLinkContext | null>(
  null,
);

/** Set once by the white-label root layout. The main app never sets it. */
export function WhiteLabelProvider({
  value,
  children,
}: {
  value: WhiteLabelLinkContext;
  children: React.ReactNode;
}) {
  const fullAppOrigin = value.mode === 'host' ? value.fullAppOrigin : '';
  const memo = React.useMemo(
    () => value,
    [value.mode, value.spaceSlug, value.lang, fullAppOrigin], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <WhiteLabelContext.Provider value={memo}>
      {children}
    </WhiteLabelContext.Provider>
  );
}

/** `null` in the main app (default behaviour); the context in a white-label tree. */
export function useWhiteLabel(): WhiteLabelLinkContext | null {
  return React.useContext(WhiteLabelContext);
}

/** Public URL of a section of this Space in the white-label tree. */
export function useWhiteLabelSectionHref(): (
  section: string,
  search?: string,
) => string {
  const ctx = useWhiteLabel();
  return React.useCallback(
    (section: string, search = '') =>
      ctx ? sectionHref(ctx, section, search) : `/${section}${search}`,
    [ctx],
  );
}

/**
 * The shared components render main-app links. In a white-label tree this
 * wrapper maps a click on any link: this Space stays in the white-label tree
 * (`/embed`, or the host root), every other destination opens the full app in
 * a new tab (in the iframe the main app can not be framed; on a mapped host it
 * is another origin). Plain modified clicks (new tab, download) are left to
 * the browser.
 */
export function WhiteLabelLinkGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = useWhiteLabel();
  const router = useRouter();

  const onClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!ctx || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download')) return;

      const decision = classifyLink(
        anchor.getAttribute('href') ?? '',
        ctx,
        window.location.origin,
        routing.locales,
      );
      if (!decision) return;

      event.preventDefault();
      event.stopPropagation();
      if (decision.kind === 'internal') {
        router.push(decision.href);
      } else {
        window.open(decision.href, '_blank', 'noopener,noreferrer');
      }
    },
    [ctx, router],
  );

  return (
    <div className="contents" onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
