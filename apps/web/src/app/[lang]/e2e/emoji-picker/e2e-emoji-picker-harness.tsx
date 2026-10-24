'use client';

import { useState } from 'react';
import { HumanChatPanelEmojiPicker } from '@hypha-platform/epics';
import { Sidebar, SidebarProvider } from '@hypha-platform/ui';

export function E2eEmojiPickerHarness() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);

  return (
    <main
      data-testid="e2e-emoji-picker-harness"
      className="min-h-svh bg-background"
    >
      <SidebarProvider defaultOpen open={sheetOpen} onOpenChange={setSheetOpen}>
        <Sidebar
          side="right"
          variant="sidebar"
          collapsible="offcanvas"
          mobileWidth="100vw"
          data-testid="e2e-emoji-sheet"
          className="z-[50]"
        >
          <div
            data-hypha-chat-panel=""
            data-testid="e2e-emoji-chat"
            className="flex h-full flex-col justify-end gap-4 p-4"
          >
            <p data-testid="e2e-emoji-sheet-open">chat open</p>
            <div className="flex items-center gap-3">
              <HumanChatPanelEmojiPicker
                modal={false}
                open={composerOpen}
                onOpenChange={setComposerOpen}
                onEmojiSelect={() => setComposerOpen(false)}
                ariaLabel="Composer emoji picker"
                align="start"
              >
                <button
                  type="button"
                  data-testid="e2e-composer-emoji"
                  aria-label="Composer emoji"
                  aria-expanded={composerOpen}
                  className="border border-border px-3 py-2 text-2"
                >
                  Composer emoji
                </button>
              </HumanChatPanelEmojiPicker>
              <HumanChatPanelEmojiPicker
                modal={false}
                open={reactOpen}
                onOpenChange={setReactOpen}
                onEmojiSelect={() => setReactOpen(false)}
                ariaLabel="Reaction emoji picker"
                align="end"
              >
                <button
                  type="button"
                  data-testid="e2e-react-emoji"
                  aria-label="Reaction emoji"
                  aria-expanded={reactOpen}
                  className="border border-border px-3 py-2 text-2"
                >
                  Reaction emoji
                </button>
              </HumanChatPanelEmojiPicker>
            </div>
          </div>
        </Sidebar>
      </SidebarProvider>
    </main>
  );
}
