import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const PAGE = `<!DOCTYPE html>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; padding: 0; }
  #body {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 10;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    font-size: 13px;
    line-height: 1.35;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    width: 100%;
    min-width: 0;
  }
  #toggle {
    margin-top: 2px;
    width: fit-content;
    font-size: 12px;
    font-weight: 500;
    touch-action: manipulation;
  }
</style>
<div id="body" data-testid="chat-message-body"></div>
<button id="toggle" type="button" data-testid="chat-message-read-more" hidden>
  Read more
</button>
`;

type HyphaClampApi = {
  messageBodyCanExpand: (node: HTMLElement) => boolean;
  watchClampedMessageBody: (
    node: HTMLElement,
    onChange: (overflows: boolean) => void,
  ) => () => void;
};

function clampLines(count: number): string {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return `Line ${n} of the clamp test.`;
  }).join('\n');
}

function bundleWatch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'clamp-watch-'));
  const outfile = path.join(dir, 'watch.js');
  execFileSync(
    path.join(repoRoot, 'node_modules/.bin/esbuild'),
    [
      path.join(
        repoRoot,
        'packages/epics/src/common/human-chat-panel/message-text-clamp.ts',
      ),
      '--bundle',
      '--format=iife',
      '--global-name=HyphaClamp',
      `--outfile=${outfile}`,
      '--platform=browser',
    ],
    { stdio: 'pipe' },
  );
  return readFileSync(outfile, 'utf8');
}

test.beforeEach(async ({ page }) => {
  expect(page.viewportSize()?.width).toBe(390);
  await page.setContent(PAGE, { waitUntil: 'load' });
  await page.addScriptTag({ content: bundleWatch() });
});

test('iPhone 14 WebKit shows Read more after a 10-line clamp settles', async ({
  page,
}, testInfo) => {
  const text = clampLines(20);
  const early = await page.evaluate((body) => {
    const el = document.getElementById('body');
    const button = document.getElementById('toggle');
    if (
      !(el instanceof HTMLElement) ||
      !(button instanceof HTMLButtonElement)
    ) {
      throw new Error('missing clamp harness');
    }
    const clamp = (window as unknown as { HyphaClamp: HyphaClampApi })
      .HyphaClamp;
    el.textContent = body;
    const before = {
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflows: clamp.messageBodyCanExpand(el),
      touch: navigator.maxTouchPoints,
    };
    clamp.watchClampedMessageBody(el, (overflows) => {
      button.hidden = !overflows;
    });
    return before;
  }, text);

  await expect(page.getByTestId('chat-message-read-more')).toBeVisible();
  const settled = await page.evaluate(() => {
    const el = document.getElementById('body');
    if (!(el instanceof HTMLElement)) throw new Error('missing body');
    return {
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    };
  });

  // Playwright's WebKit build reports navigator.maxTouchPoints as 0 even
  // when the iPhone 14 descriptor enables touch. Assert the descriptor.
  expect(devices['iPhone 14'].hasTouch).toBe(true);
  expect(devices['iPhone 14'].viewport?.width).toBe(390);
  expect(settled.clientWidth).toBeGreaterThan(300);
  expect(settled.clientWidth).toBeLessThanOrEqual(390);
  expect(settled.scrollHeight).toBeGreaterThan(settled.clientHeight + 1);
  testInfo.annotations.push({
    type: 'webkit-clamp',
    description: JSON.stringify({ early, settled }),
  });
});

test('iPhone 14 WebKit shows Read more when lines arrive after the first measure', async ({
  page,
}) => {
  await page.evaluate((body) => {
    const el = document.getElementById('body');
    const button = document.getElementById('toggle');
    if (
      !(el instanceof HTMLElement) ||
      !(button instanceof HTMLButtonElement)
    ) {
      throw new Error('missing clamp harness');
    }
    const clamp = (window as unknown as { HyphaClamp: HyphaClampApi })
      .HyphaClamp;
    el.textContent = body;
    clamp.watchClampedMessageBody(el, (overflows) => {
      button.hidden = !overflows;
    });
  }, clampLines(4));

  await expect(page.getByTestId('chat-message-read-more')).toBeHidden();

  await page.evaluate((body) => {
    const el = document.getElementById('body');
    if (!(el instanceof HTMLElement)) throw new Error('missing body');
    el.textContent = body;
  }, clampLines(20));

  await expect(page.getByTestId('chat-message-read-more')).toBeVisible();
});
