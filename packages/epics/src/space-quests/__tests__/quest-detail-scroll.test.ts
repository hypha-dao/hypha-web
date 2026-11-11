// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
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
  questDetailScrollTarget,
  readQuestDetailScroll,
  rememberQuestDetailScroll,
} from '../quest-detail-scroll';

function fakeColumn(scrollHeight: number, clientHeight: number) {
  const el = document.createElement('div');
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  return el;
}

afterEach(() => {
  clearMainColumnScrollFreeze();
  releaseMainColumnScrollHeightHold();
  setMainColumnScrollRoot(null);
  window.sessionStorage.clear();
});

describe('quest detail scroll', () => {
  it('keeps a deep offset on the main column after a clamp to the top', () => {
    const column = fakeColumn(2400, 800);
    setMainColumnScrollRoot(column);
    column.scrollTop = 960;

    rememberQuestDetailScroll(getMainColumnScrollY());
    expect(readQuestDetailScroll()).toBe(960);
    expect(window.sessionStorage.getItem(QUEST_DETAIL_SCROLL_KEY)).toBe('960');

    column.scrollTop = 0;
    applyQuestDetailScroll(960);

    expect(column.scrollTop).toBe(960);
    expect(isMainColumnScrollFrozen()).toBe(false);
  });

  it('holds the offset when the next screen cannot contain it', () => {
    const column = fakeColumn(200, 160);
    setMainColumnScrollRoot(column);
    expect(questDetailScrollTarget(960, 40)).toBe(40);

    applyQuestDetailScroll(960);

    expect(column.scrollTop).toBe(960);
    expect(isMainColumnScrollFrozen()).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue(
        '--hypha-space-scroll-hold',
      ),
    ).not.toBe('');
  });
});
