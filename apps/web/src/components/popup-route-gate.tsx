'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Logo } from '@hypha-platform/ui';

/**
 * Pages that open as a small popup from another application (the approval
 * page, #2515) show a minimal Hypha header instead of the app chrome, so
 * people can tell this is Hypha and not the site they came from.
 */
const POPUP_ROUTE = /^\/[a-z]{2}\/approve\/[^/]+\/?$/;

/**
 * The application asking for the action, set by the approval page once it has
 * loaded. The logo is already approved by Hypha (the server only returns it
 * for an approved client); the Hypha mark stays in the header either way.
 */
export type PopupClient = { name: string; logoUrl: string | null } | null;

let popupClient: PopupClient = null;
const popupClientListeners = new Set<() => void>();

export function setPopupClient(next: PopupClient) {
  popupClient = next;
  popupClientListeners.forEach((listener) => listener());
}

const subscribePopupClient = (listener: () => void) => {
  popupClientListeners.add(listener);
  return () => popupClientListeners.delete(listener);
};

const useIsPopupRoute = () => POPUP_ROUTE.test(usePathname() ?? '');

/** The app chrome (menu bar, footer): not rendered on popup pages. */
export function HideInPopup({ children }: { children: ReactNode }) {
  return useIsPopupRoute() ? null : <>{children}</>;
}

/** The only chrome of a popup page: the Hypha mark, not a link. */
export function PopupHeader() {
  const isPopup = useIsPopupRoute();
  const client = useSyncExternalStore(
    subscribePopupClient,
    () => popupClient,
    () => null,
  );
  if (!isPopup) return null;
  return (
    <header className="flex h-14 shrink-0 items-center justify-center gap-3 border-b border-border bg-page-background px-4">
      <Logo width={96} />
      {client?.logoUrl && (
        <>
          <span className="text-muted-foreground" aria-hidden>
            ×
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={client.logoUrl}
            alt={client.name}
            width={40}
            height={40}
            className="size-10 object-contain"
          />
        </>
      )}
    </header>
  );
}
