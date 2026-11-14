import type { ReactNode } from 'react';

/**
 * Agreements with an overlay slot, as in the main app: the proposal detail is a
 * parallel `@aside` route drawn over the list (which stays mounted behind it).
 */
export default function WhiteLabelAgreementsLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <>
      {children}
      {aside}
    </>
  );
}
