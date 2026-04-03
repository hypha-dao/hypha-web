'use client';

import { MatrixProvider } from '@hypha-platform/core/client';

export function ConditionalMatrixProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }
  return <MatrixProvider>{children}</MatrixProvider>;
}
