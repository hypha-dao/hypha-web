import type { ReactNode } from 'react';

/**
 * Signals with an overlay slot, as Agreements: the create form is a parallel
 * `@aside` route drawn over the section (which stays mounted behind it).
 */
export default function WhiteLabelCoherenceLayout({
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
