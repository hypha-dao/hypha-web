'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  clearMainColumnScrollFreeze,
  getMainColumnScrollElement,
  releaseMainColumnScrollHeightHold,
  scrollMainColumnTo,
  setMainColumnScrollRoot,
} from '../common/main-column-scroll';
import {
  captureQuestDetailView,
  retainQuestDetailScroll,
} from './quest-detail-scroll';

/**
 * Browser harness for a settings save landing on a shorter overview.
 *
 * The space chrome's pathname effect runs after the quest page's layout
 * effect and, when the next screen cannot hold the offset, scrolls to the
 * top. Two frames later it drops a leftover height hold and sits at the
 * natural end of the content. This parent effect does those two writes.
 * Overview's restore is the child, so it is scheduled first — the same
 * order as `DhoStickySpaceChrome` and `SpaceQuestDetail`.
 */
function SpaceChromeRelease({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    if (!active) return;
    const releaseVisual = (toNatural: boolean) => {
      releaseMainColumnScrollHeightHold();
      clearMainColumnScrollFreeze();
      const port = document.querySelector('[data-testid="scrollport"]');
      if (!(port instanceof HTMLElement)) return;
      let top = 0;
      if (toNatural) {
        const hold = port.querySelector<HTMLElement>(
          '[data-space-scroll-hold]',
        );
        const prev = hold?.style.minHeight ?? '';
        if (hold) hold.style.minHeight = '0px';
        top = Math.max(0, port.scrollHeight - port.clientHeight);
        if (hold) hold.style.minHeight = prev;
      }
      port.scrollTop = top;
      scrollMainColumnTo(top);
    };

    releaseVisual(false);
    let frames = 0;
    let raf = 0;
    const tick = () => {
      frames += 1;
      if (frames < 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      releaseVisual(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return children;
}

function OverviewRestore({ active }: { active: boolean }) {
  useLayoutEffect(() => {
    if (!active) return;
    return retainQuestDetailScroll();
  }, [active]);
  return null;
}

export function E2eQuestScrollHarness({
  nested = false,
}: {
  nested?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<'settings' | 'overview'>('settings');

  useLayoutEffect(() => {
    const node = nested ? innerRef.current : outerRef.current;
    setMainColumnScrollRoot(node);
    return () => {
      if (getMainColumnScrollElement() === node) setMainColumnScrollRoot(null);
    };
  }, [nested]);

  return (
    <main data-testid="e2e-quest-scroll-harness" className="bg-background p-4">
      <button
        type="button"
        data-testid="quest-scroll-save"
        className="mb-3 border border-foreground px-3 py-1 text-sm"
        onClick={() => {
          captureQuestDetailView();
          setScreen('overview');
        }}
      >
        Save
      </button>
      <div
        ref={outerRef}
        data-testid="scrollport"
        style={{ height: 520, overflowY: 'auto' }}
      >
        <div ref={innerRef} style={nested ? { overflow: 'hidden' } : undefined}>
          <SpaceChromeRelease active={screen === 'overview'}>
            <div
              data-space-scroll-hold=""
              style={{ minHeight: 'var(--hypha-space-scroll-hold, 0px)' }}
            >
              <div
                data-testid="quest-scroll-hero"
                style={{ height: 360, background: '#1e4b8f' }}
              />
              <nav
                data-quest-detail-tabs=""
                data-testid="quest-scroll-tabs"
                style={{ height: 40 }}
              >
                Overview Settings
              </nav>
              <OverviewRestore active={screen === 'overview'} />
              <div
                data-testid="quest-scroll-body"
                style={{ height: screen === 'settings' ? 1600 : 180 }}
              >
                {screen}
              </div>
            </div>
          </SpaceChromeRelease>
        </div>
      </div>
    </main>
  );
}
