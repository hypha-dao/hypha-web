import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../',
);

const chrome = [
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find((path) => existsSync(path));

describe('SignalImagePicker file chooser', () => {
  it.skipIf(!chrome)(
    'opens one native chooser from the Images control, including Enter',
    async () => {
      const esbuild = await import('esbuild');
      const { chromium } = await import('@playwright/test');
      const outfile = join(tmpdir(), 'signal-image-picker-preview.js');
      await esbuild.build({
        absWorkingDir: repoRoot,
        entryPoints: [
          'packages/epics/src/coherence/lib/__tests__/signal-image-picker.preview.tsx',
        ],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        outfile,
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"development"' },
        alias: {
          '@hypha-platform/ui': join(
            repoRoot,
            'packages/ui/src/upload/add-attachment.tsx',
          ),
        },
        loader: { '.svg': 'dataurl', '.css': 'empty' },
        logLevel: 'silent',
      });
      const browser = await chromium.launch({
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<!doctype html><html><body><div id="root"></div></body></html>',
          { waitUntil: 'load' },
        );
        await page.addScriptTag({ path: outfile });
        const button = page.getByRole('button', { name: 'Images' });
        const fileInput = page.locator('input[type="file"]');
        expect(await fileInput.count()).toBe(1);
        expect(await fileInput.getAttribute('aria-hidden')).toBe('true');
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          button.click(),
        ]);
        expect(await fileInput.count()).toBe(1);
        await chooser.setFiles([
          {
            name: 'shot.png',
            mimeType: 'image/png',
            buffer: Buffer.from('png'),
          },
          {
            name: 'notes.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('pdf'),
          },
        ]);
        expect(await page.getByText('shot.png').count()).toBe(1);
        expect(await page.getByText('notes.pdf').count()).toBe(0);
        expect(await page.locator('input[type="file"]').count()).toBe(1);

        const [again] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10_000 }),
          button.press('Enter'),
        ]);
        expect(again).toBeTruthy();
        await again.setFiles({
          name: 'again.png',
          mimeType: 'image/png',
          buffer: Buffer.from('png'),
        });
        expect(await page.getByText('again.png').count()).toBe(1);
        expect(await page.locator('input[type="file"]').count()).toBe(1);
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
