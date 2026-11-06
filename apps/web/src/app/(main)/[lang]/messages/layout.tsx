import type { ReactNode } from 'react';

import { MessagesSectionShell } from './_components/messages-section-shell';

/**
 * Keep the Messages body mounted across Messages ↔ Suggestions ↔ Archived.
 * Child `page.tsx` files render null; the shell reads the section from the URL.
 */
export default function MessagesLayout({
  children: _children,
}: {
  children: ReactNode;
}) {
  return <MessagesSectionShell />;
}
