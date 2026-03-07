'use client';

import { useCallback, useRef, useState } from 'react';
import { Bot, ChevronsLeftRight, PanelLeftOpen } from 'lucide-react';

import { AiLeftPanel } from './ai-left-panel';
import { useIsMobile } from '../hooks';
import { Drawer, DrawerContent } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

type AiLeftPanelLayoutProps = {
  children: React.ReactNode;
};

export function AiLeftPanelLayout({ children }: AiLeftPanelLayoutProps) {
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartWidth.current = panelWidth;
      setIsDragging(true);

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - dragStartX.current;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, dragStartWidth.current + delta),
        );
        setPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [panelWidth],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {!isMobile && (
        <>
          <div
            className={cn(
              'relative flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden transition-all duration-300',
              panelOpen ? '' : 'w-0',
            )}
            style={panelOpen ? { width: panelWidth } : undefined}
          >
            <AiLeftPanel onClose={() => setPanelOpen(false)} />

            {panelOpen && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={panelWidth}
                onMouseDown={onResizeMouseDown}
                className={cn(
                  'absolute top-0 right-0 z-20 flex h-full w-1 cursor-col-resize items-center justify-center transition-colors',
                  isDragging
                    ? 'bg-primary'
                    : 'hover:bg-primary/20 group hover:bg-primary/20',
                )}
                title="Drag to resize"
              >
                <div
                  className={cn(
                    'flex h-8 w-4 items-center justify-center rounded transition-opacity',
                    isDragging
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <ChevronsLeftRight className="h-3 w-3 text-primary" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed left-0 top-[4.5rem] z-30 flex items-center gap-1.5 rounded-r-xl border border-l-0 border-border bg-card px-2 py-1.5 text-xs text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
          title="Open AI panel"
        >
          <Bot className="h-3.5 w-3.5 text-primary" />
          <PanelLeftOpen className="h-3.5 w-3.5 text-primary" />
        </button>
      )}

      {isMobile && (
        <Drawer open={panelOpen} onOpenChange={setPanelOpen} direction="left">
          <DrawerContent
            className="inset-x-auto right-auto left-0 h-full w-[85vw] max-w-[360px] rounded-r-2xl rounded-t-none border-r"
            style={{ top: 0, bottom: 0, marginTop: 0 }}
          >
            <div className="h-full">
              <AiLeftPanel onClose={() => setPanelOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-start overflow-auto pt-5">
        {children}
      </div>
    </div>
  );
}
