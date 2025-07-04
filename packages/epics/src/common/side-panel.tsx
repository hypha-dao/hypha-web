import type { ReactNode } from 'react';

type SidePanelProps = {
  children: ReactNode;
};

export const SidePanel = ({ children }: SidePanelProps) => {
  return (
    <div className="shrink-0 p-7 bg-neutral-2 overflow-y-auto w-[--spacing-container-sm]">
      {children}
    </div>
  );
};
