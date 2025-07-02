import type { ReactNode } from 'react';

type SidePanelProps = {
  children: ReactNode;
};

export const SidePanel = ({ children }: SidePanelProps) => {
  return (
    <div className="sticky p-9 top-9 h-[calc(100vh-72px)] bg-neutral-2 overflow-y-auto w-container-md">
      {children}
    </div>
  );
};
