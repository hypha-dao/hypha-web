import type { ReactNode } from 'react';

type SidePanelProps = {
  children: ReactNode;
};

export const SidePanel = ({ children }: SidePanelProps) => {
  return (
    <div
      className="fixed top-9 bottom-0 right-0 p-4 lg:p-7 bg-background-2 overflow-y-auto w-full md:w-[--spacing-container-sm]"
      // if we want to keep the sidebar centralized over the main content
      // we need to calculate its position
      // style={{
      //   right: `calc((100vw - var(--spacing-container-2xl)) / 2)`,
      // }}
    >
      {children}
    </div>
  );
};
