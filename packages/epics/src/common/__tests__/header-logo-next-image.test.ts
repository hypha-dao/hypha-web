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

  it('passes the optimizer URL as next/image src so React commit cannot Image() ufs.sh', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../spaces/components/compact-space-banner-lead.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('toNextImageOptimizerSrc');
    expect(source).toContain('src={imageSrc}');
    expect(source).toContain('unoptimized');
    expect(source).not.toMatch(/src=\{src\}/);
  });

  it('rewrites MemberSpaceSelect img src through the optimizer', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../network-exchange/member-space-select.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('toNextImageOptimizerSrc');
    expect(source).not.toMatch(/src=\{logoUrl\}/);
  });
});
