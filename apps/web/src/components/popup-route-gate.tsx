'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@hypha-platform/ui';

/**
 * Pages that open as a small popup from another application (the approval
 * page, #2515) show a minimal Hypha header instead of the app chrome, so
 * people can tell this is Hypha and not the site they came from.
 */
const POPUP_ROUTE = /^\/[a-z]{2}\/approve\/[^/]+\/?$/;

const useIsPopupRoute = () => POPUP_ROUTE.test(usePathname() ?? '');

/** The app chrome (menu bar, footer): not rendered on popup pages. */
export function HideInPopup({ children }: { children: ReactNode }) {
  return useIsPopupRoute() ? null : <>{children}</>;
}

/** The only chrome of a popup page: the Hypha mark, not a link. */
export function PopupHeader() {
  if (!useIsPopupRoute()) return null;
  return (
    <header className="flex h-14 shrink-0 items-center justify-center border-b border-border px-4">
      <Logo width={96} />
    </header>
  );
}
