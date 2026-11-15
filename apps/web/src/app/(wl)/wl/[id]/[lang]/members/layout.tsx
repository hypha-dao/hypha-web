import type { ReactNode } from 'react';

/**
 * Members with an overlay slot, as in the main app: the person detail is a
 * parallel `@aside` route drawn over the list (which stays mounted behind it).
 */
export default function WhiteLabelMembersLayout({
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
