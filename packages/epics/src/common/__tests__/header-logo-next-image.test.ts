import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ConnectedMenuTop space logo', () => {
  it('sends the header logo through next/image instead of a raw img', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../apps/web/src/components/connected-menu-top.tsx',
      ),
      'utf8',
    );
    expect(source).toContain("import Image from 'next/image'");
    expect(source).toContain('toNextImageOptimizerSrc(rootLogoUrl');
    expect(source).not.toMatch(/<img\s+src=\{rootLogoUrl\}/);
    expect(source).not.toMatch(/src=\{rootLogoUrl\}/);
  });

  it('sends the compact banner lead through the optimizer loader', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../spaces/components/compact-space-banner-lead.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('toNextImageOptimizerSrc');
  });
});
