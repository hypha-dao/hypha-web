// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  clampedMessageBodyOverflows,
  measureUnclampedMessageBodyHeight,
  messageBodyCanExpand,
  stripLineClampClasses,
  watchClampedMessageBody,
} from '../message-text-clamp';

const here = dirname(fileURLToPath(import.meta.url));

function box(values: {
  clientWidth: number;
  clientHeight: number;
  scrollHeight: number;
  offsetHeight?: number;
}): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', {
    configurable: true,
    get: () => values.clientWidth,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => values.clientHeight,
  });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => values.scrollHeight,
  });
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => values.offsetHeight ?? values.clientHeight,
  });
  return el;
}

describe('stripLineClampClasses', () => {
  it('drops line-clamp utilities and keeps the rest of the body classes', () => {
    expect(
      stripLineClampClasses(
        'text-[13px] leading-[1.35] whitespace-pre-wrap break-words text-foreground mt-0 line-clamp-10',
      ),
    ).toBe(
      'text-[13px] leading-[1.35] whitespace-pre-wrap break-words text-foreground mt-0',
    );
  });
});

describe('clampedMessageBodyOverflows', () => {
  it('uses scrollHeight when the engine reports the full height', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 640,
        clientHeight: 180,
        scrollHeight: 420,
        unclampedHeight: 0,
      }),
    ).toBe(true);
  });

  it('treats a WebKit clamped box as overflow when the unclamped copy is taller', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 320,
        clientHeight: 180,
        scrollHeight: 180,
        unclampedHeight: 460,
      }),
    ).toBe(true);
  });

  it('stays collapsed when the body fits in the clamp', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 320,
        clientHeight: 80,
        scrollHeight: 80,
        unclampedHeight: 81,
      }),
    ).toBe(false);
  });

  it('ignores a few pixels of noise on the unclamped copy', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 320,
        clientHeight: 180,
        scrollHeight: 180,
        unclampedHeight: 186,
      }),
    ).toBe(false);
  });

  it('shows the toggle when the unclamped copy is a line taller', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 320,
        clientHeight: 180,
        scrollHeight: 180,
        unclampedHeight: 198,
      }),
    ).toBe(true);
  });

  it('ignores a box that has not been laid out', () => {
    expect(
      clampedMessageBodyOverflows({
        clientWidth: 0,
        clientHeight: 180,
        scrollHeight: 400,
        unclampedHeight: 400,
      }),
    ).toBe(false);
  });
});

describe('messageBodyCanExpand', () => {
  it('keeps the desktop path and does not measure a second copy', () => {
    const measure = vi.fn(() => 999);
    const el = box({
      clientWidth: 720,
      clientHeight: 180,
      scrollHeight: 360,
    });
    expect(messageBodyCanExpand(el, measure)).toBe(true);
    expect(measure).not.toHaveBeenCalled();
  });

  it('shows Read more when WebKit reports no scroll overflow', () => {
    const measure = vi.fn(() => 440);
    const el = box({
      clientWidth: 320,
      clientHeight: 175,
      scrollHeight: 175,
    });
    expect(messageBodyCanExpand(el, measure)).toBe(true);
    expect(measure).toHaveBeenCalledOnce();
    expect(measure).toHaveBeenCalledWith(el);
  });

  it('hides Read more when the unclamped body is the same height', () => {
    const measure = vi.fn(() => 90);
    const el = box({
      clientWidth: 320,
      clientHeight: 90,
      scrollHeight: 90,
    });
    expect(messageBodyCanExpand(el, measure)).toBe(false);
  });

  it('does not measure before the body has a width', () => {
    const measure = vi.fn(() => 400);
    const el = box({
      clientWidth: 0,
      clientHeight: 0,
      scrollHeight: 0,
    });
    expect(messageBodyCanExpand(el, measure)).toBe(false);
    expect(measure).not.toHaveBeenCalled();
  });

  it('falls back to offsetHeight when clientHeight is still 0', () => {
    const measure = vi.fn(() => 400);
    const el = box({
      clientWidth: 320,
      clientHeight: 0,
      offsetHeight: 175,
      scrollHeight: 175,
    });
    expect(messageBodyCanExpand(el, measure)).toBe(true);
  });
});

describe('measureUnclampedMessageBodyHeight', () => {
  it('reads a copy that is not line-clamped and removes the probe', () => {
    const el = document.createElement('div');
    el.className = 'line-clamp-10 whitespace-pre-wrap break-words text-[13px]';
    el.dataset.testid = 'chat-message-body';
    el.textContent = 'notes';
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 280,
    });
    document.body.appendChild(el);

    const originalAppend = document.body.appendChild.bind(document.body);
    let probe: HTMLElement | null = null;
    document.body.appendChild = <T extends Node>(node: T): T => {
      const inserted = originalAppend(node);
      if (node instanceof HTMLElement) {
        const clone = node.querySelector('[data-message-clamp-measure]');
        if (clone instanceof HTMLElement) {
          probe = clone;
          Object.defineProperty(clone, 'scrollHeight', {
            configurable: true,
            get: () => 512,
          });
        }
      }
      return inserted;
    };

    try {
      expect(measureUnclampedMessageBodyHeight(el)).toBe(512);
      expect(probe).not.toBeNull();
      const measured = probe as HTMLElement | null;
      expect(measured?.className).not.toContain('line-clamp');
      expect(measured?.className).toContain('whitespace-pre-wrap');
      expect(measured?.style.display).toBe('block');
      expect(measured?.style.overflow).toBe('visible');
      expect(measured?.style.width).toBe('280px');
      expect(measured?.style.getPropertyValue('-webkit-line-clamp')).toBe(
        'unset',
      );
      expect(measured?.getAttribute('data-testid')).toBeNull();
      expect(document.body.querySelector('[data-message-clamp-measure]')).toBe(
        null,
      );
    } finally {
      document.body.appendChild = originalAppend;
      el.remove();
    }
  });

  it('does not insert a probe before the body has a width', () => {
    const el = document.createElement('div');
    el.className = 'line-clamp-10';
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 0,
    });
    document.body.appendChild(el);
    try {
      expect(measureUnclampedMessageBodyHeight(el)).toBe(0);
      expect(document.body.querySelector('[data-message-clamp-measure]')).toBe(
        null,
      );
    } finally {
      el.remove();
    }
  });
});

describe('watchClampedMessageBody', () => {
  function installLayoutDoubles() {
    const frames: Array<FrameRequestCallback | undefined> = [];
    class SilentResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames[id - 1] = undefined;
    });
    vi.stubGlobal('ResizeObserver', SilentResizeObserver);
    const previousFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: new Promise(() => {}),
        addEventListener() {},
        removeEventListener() {},
      },
    });
    return {
      flushFrames() {
        for (let pass = 0; pass < 8; pass += 1) {
          const batch = frames.splice(0);
          const pending = batch.filter((frame): frame is FrameRequestCallback =>
            Boolean(frame),
          );
          if (pending.length === 0) break;
          for (const frame of pending) frame(0);
        }
      },
      restore() {
        vi.unstubAllGlobals();
        if (previousFonts) {
          Object.defineProperty(document, 'fonts', previousFonts);
        }
      },
    };
  }

  function clampedBox() {
    const el = document.createElement('div');
    el.className = 'line-clamp-10 whitespace-pre-wrap';
    let scrollHeight = 175;
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      get: () => 175,
    });
    Object.defineProperty(el, 'offsetHeight', {
      configurable: true,
      get: () => 175,
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    document.body.appendChild(el);
    return {
      el,
      setScrollHeight: (value: number) => {
        scrollHeight = value;
      },
    };
  }

  it('remeasures on a settled frame when the clamped box never resizes', () => {
    const layout = installLayoutDoubles();
    const { el, setScrollHeight } = clampedBox();
    const seen: boolean[] = [];
    const stop = watchClampedMessageBody(el, (overflows) => {
      seen.push(overflows);
    });
    try {
      // iPhone failure: the box is already 10 lines tall and scrollHeight
      // catches up later, with no border-box change for ResizeObserver.
      expect(seen[0]).toBe(false);
      setScrollHeight(351);
      layout.flushFrames();
      expect(seen).toContain(true);
    } finally {
      stop();
      el.remove();
      layout.restore();
    }
  });

  it('remeasures when message text arrives after the first layout', async () => {
    const layout = installLayoutDoubles();
    const { el, setScrollHeight } = clampedBox();
    const seen: boolean[] = [];
    const stop = watchClampedMessageBody(el, (overflows) => {
      seen.push(overflows);
    });
    try {
      expect(seen[0]).toBe(false);
      setScrollHeight(351);
      el.textContent = `${el.textContent ?? ''} more lines`;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(seen).toContain(true);
    } finally {
      stop();
      el.remove();
      layout.restore();
    }
  });
});

describe('message bubble clamp wiring', () => {
  const source = readFileSync(
    join(here, '../human-chat-panel-message-bubble.tsx'),
    'utf8',
  );

  it('keeps watching the clamped body after the first layout', () => {
    expect(source).toContain('watchClampedMessageBody(');
    expect(source).not.toContain('el.scrollHeight > el.clientHeight + 1');
  });

  it('keeps the Read more control a tappable button outside the clamp', () => {
    expect(source).toContain("t('messageReadMore')");
    expect(source).toContain("t('messageShowLess')");
    expect(source).toContain('data-testid="chat-message-read-more"');
    expect(source).toContain('touch-manipulation');
    const buttonAt = source.indexOf('data-testid="chat-message-read-more"');
    const clampAt = source.indexOf("!textExpanded && 'line-clamp-10'");
    expect(buttonAt).toBeGreaterThan(clampAt);
    const buttonBlock = source.slice(buttonAt, buttonAt + 900);
    expect(buttonBlock).not.toContain('line-clamp-10');
    expect(buttonBlock).not.toMatch(
      /max-md:|md:hidden|group-hover|pointer-fine|pointer-events-none|opacity-0/,
    );
    expect(source).not.toMatch(
      /isTouchComposer[\s\S]{0,80}messageReadMore|messageReadMore[\s\S]{0,80}isTouchComposer/,
    );
  });
});
