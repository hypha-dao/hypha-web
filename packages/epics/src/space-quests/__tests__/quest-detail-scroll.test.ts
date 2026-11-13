// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearMainColumnScrollFreeze,
  getMainColumnScrollY,
  isMainColumnScrollFrozen,
  releaseMainColumnScrollHeightHold,
  setMainColumnScrollRoot,
} from '../../common/main-column-scroll';
import {
  QUEST_DETAIL_SCROLL_KEY,
  applyQuestDetailScroll,
  captureQuestDetailView,
  clearQuestDetailScrollMemory,
  questDetailScrollTarget,
  readQuestDetailScroll,
  releaseQuestDetailScrollPin,
  rememberQuestDetailScroll,
  retainQuestDetailScroll,
} from '../quest-detail-scroll';

function rect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 200,
    bottom: top + 40,
    width: 200,
    height: 40,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function fakeScrollable(scrollHeight: number, clientHeight: number) {
  const el = document.createElement('div');
  el.style.overflowY = 'auto';
  let top = 0;
  const heights = { scrollHeight, clientHeight };
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => heights.scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => heights.clientHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      const next = Math.max(0, value);
      if (next === top) return;
      top = next;
      el.dispatchEvent(new Event('scroll'));
    },
  });
  return { el, heights };
}

function queueAnimationFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return {
    get pending() {
      return queue.length;
    },
    flush(count: number) {
      for (let i = 0; i < count && queue.length > 0; i += 1) {
        const cb = queue.shift();
        cb?.(0);
      }
    },
    flushAll() {
      for (let i = 0; i < 40 && queue.length > 0; i += 1) {
        const cb = queue.shift();
        cb?.(0);
      }
    },
  };
}

afterEach(() => {
  releaseQuestDetailScrollPin();
  clearMainColumnScrollFreeze();
  releaseMainColumnScrollHeightHold();
  clearQuestDetailScrollMemory();
  setMainColumnScrollRoot(null);
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-quest-scroll-settled');
  vi.unstubAllGlobals();
});

describe('quest detail scroll', () => {
  it('keeps a deep offset on the main column after a clamp to the top', () => {
    const { el: column } = fakeScrollable(2400, 800);
    setMainColumnScrollRoot(column);
    column.scrollTop = 960;

    rememberQuestDetailScroll(getMainColumnScrollY());
    expect(readQuestDetailScroll()).toBe(960);
    expect(window.sessionStorage.getItem(QUEST_DETAIL_SCROLL_KEY)).toBe(
      JSON.stringify({ scrollTop: 960, tabsTop: null }),
    );

    column.scrollTop = 0;
    applyQuestDetailScroll(960);

    expect(column.scrollTop).toBe(960);
    expect(isMainColumnScrollFrozen()).toBe(false);
  });

  it('holds the offset when the next screen cannot contain it', () => {
    const { el: column } = fakeScrollable(200, 160);
    setMainColumnScrollRoot(column);
    expect(questDetailScrollTarget(960, 40)).toBe(40);

    applyQuestDetailScroll(960);

    expect(column.scrollTop).toBe(960);
    // A freeze makes the space chrome release a short overview to the top.
    expect(isMainColumnScrollFrozen()).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue(
        '--hypha-space-scroll-hold',
      ),
    ).not.toBe('');
  });

  it('saves the ancestor that scrolled when the registered root is at 0', () => {
    const { el: outer } = fakeScrollable(2400, 500);
    const { el: inner } = fakeScrollable(2400, 500);
    const tabs = document.createElement('nav');
    tabs.setAttribute('data-quest-detail-tabs', '');
    inner.append(tabs);
    outer.append(inner);
    document.body.append(outer);
    setMainColumnScrollRoot(inner);
    outer.scrollTop = 480;

    const saved = captureQuestDetailView();

    expect(saved?.scrollTop).toBe(480);
    expect(outer.hasAttribute('data-quest-detail-scrollport')).toBe(true);
    expect(inner.hasAttribute('data-quest-detail-scrollport')).toBe(false);
  });

  it('puts the tabs back after the space chrome forces a short screen to the top', () => {
    const frames = queueAnimationFrames();
    const { el: column, heights } = fakeScrollable(2400, 520);
    const hold = document.createElement('div');
    hold.setAttribute('data-space-scroll-hold', '');
    const tabs = document.createElement('nav');
    tabs.setAttribute('data-quest-detail-tabs', '');
    const contentTop = 360;
    tabs.getBoundingClientRect = () => rect(contentTop - column.scrollTop);
    hold.append(tabs);
    column.append(hold);
    document.body.append(column);
    setMainColumnScrollRoot(column);
    column.scrollTop = 360;

    rememberQuestDetailScroll(column.scrollTop);
    expect(readQuestDetailScroll()).toBe(360);

    // Overview is shorter than the settings offset, and the chrome drops
    // the hold then writes scrollTop 0. Settings could have held 360, which
    // is why the restore must not finish before this screen is showing.
    heights.scrollHeight = 580;
    releaseMainColumnScrollHeightHold();
    column.scrollTop = 0;
    expect(tabs.getBoundingClientRect().top).toBe(360);

    const cancel = retainQuestDetailScroll();
    frames.flush(2);
    releaseMainColumnScrollHeightHold();
    column.scrollTop = 0;
    frames.flushAll();
    cancel();

    expect(column.scrollTop).toBe(360);
    expect(tabs.getBoundingClientRect().top).toBe(0);
    expect(isMainColumnScrollFrozen()).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue(
        '--hypha-space-scroll-hold',
      ),
    ).not.toBe('');
  });
});
