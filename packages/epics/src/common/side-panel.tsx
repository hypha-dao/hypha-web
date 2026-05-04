import type { ReactNode } from 'react';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type SidePanelProps = {
  children: ReactNode;
  className?: string;
};

export const SidePanel = ({ children, className }: SidePanelProps) => {
  return (
    <AsideOverlayLayoutProvider mode="side-panel">
      <div
        className={cn(
          'fixed bottom-0 bg-background-2 overflow-y-auto w-full md:w-container-sm',
          className,
        )}
        style={{
          top: 'var(--menu-top-height, 70px)',
          right: 'var(--sidebar-right-width, 0px)',
        }}
      >
        <div className="p-4 lg:p-7">{children}</div>
      </div>
    </AsideOverlayLayoutProvider>
  );
};
