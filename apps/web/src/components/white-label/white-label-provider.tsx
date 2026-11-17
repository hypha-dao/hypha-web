'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { routing } from '@hypha-platform/i18n';
import { FULL_APP_EXIT_ATTR } from '@hypha-platform/epics';
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
  const createKey = (value.createActions ?? []).join(',');
  const tabsKey = value.tabs?.join(',');
  const clientId = value.mode === 'embed' ? value.clientId : undefined;
  const memo = React.useMemo(
    () => value,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      value.mode,
      value.spaceSlug,
      value.lang,
      value.detailView,
      value.unsupportedActions,
      createKey,
      tabsKey,
      clientId,
      fullAppOrigin,
    ],
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
 * is another origin), except create flows, which do nothing unless the client
 * set `unsupportedActions: 'full-app'`. Middle and Ctrl/Cmd/Shift clicks open the mapped URL in a new tab;
 * Alt-click (download) is left to the browser.
 */
export function WhiteLabelLinkGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = useWhiteLabel();
  const router = useRouter();

  const handle = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, newTab: boolean) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download')) return;
      // An explicit exit to the full app (`unsupportedActions: 'full-app'`):
      // the browser opens it in a new tab, the destination is not remapped.
      if (anchor.hasAttribute(FULL_APP_EXIT_ATTR)) return;

      const decision = classifyLink(
        anchor.getAttribute('href') ?? '',
        ctx as WhiteLabelLinkContext,
        window.location.origin,
        routing.locales,
      );
      if (!decision) return;

      event.preventDefault();
      event.stopPropagation();
      // A create flow this delivery cannot perform: the click does nothing.
      if (decision.kind === 'blocked') return;
      if (decision.kind === 'internal' && !newTab) {
        router.push(decision.href);
      } else {
        // Left click on an outside link, or a new-tab click (middle button,
        // Ctrl/Cmd/Shift): open the mapped URL, never the main-app shape.
        window.open(decision.href, '_blank', 'noopener,noreferrer');
      }
    },
    [ctx, router],
  );

  const onClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!ctx || event.defaultPrevented || event.button !== 0) return;
      const modified =
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (event.altKey) return; // download shortcut: left to the browser
      handle(event, modified);
    },
    [ctx, handle],
  );

  const onAuxClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!ctx || event.defaultPrevented || event.button !== 1) return;
      handle(event, true);
    },
    [ctx, handle],
  );

  return (
    <div
      className="contents"
      onClickCapture={onClickCapture}
      onAuxClickCapture={onAuxClickCapture}
    >
      {children}
    </div>
  );
}
