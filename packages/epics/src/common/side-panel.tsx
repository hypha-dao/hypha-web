import type { ReactNode } from 'react';

type SidePanelProps = {
  children: ReactNode;
};

export const SidePanel = ({ children }: SidePanelProps) => {
  return (
    <div className="shrink-0 p-7 bg-background-2 overflow-y-auto w-container-sm">
      {children}
    </div>
  );
};
