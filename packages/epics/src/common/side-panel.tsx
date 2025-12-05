import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

type SidePanelProps = {
  children: ReactNode;
  className?: string;
};

export const SidePanel = ({ children, className }: SidePanelProps) => {
  return (
    <div
      className={cn(
        'fixed top-9 bottom-0 right-0 bg-background-2 overflow-y-auto w-full md:w-container-sm',
        className,
      )}
      // if we want to keep the sidebar centralized over the main content
      // we need to calculate its position
      // style={{
      //   right: `calc((100vw - var(--spacing-container-2xl)) / 2)`,
      // }}
    >
      <div className="p-4 lg:p-7">{children}</div>
    </div>
  );
};
