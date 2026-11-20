import { describe, expect, it } from 'vitest';
import { sanitiseUserText } from '../sanitiser';
import { userText } from '../presentation/user-text';

const ZERO_WIDTH = String.fromCodePoint(0x200b);
const BIDI = String.fromCodePoint(0x202e);
const TAG_A = String.fromCodePoint(0xe0041);
const NUL = String.fromCodePoint(0);

describe('sanitiseUserText', () => {
  it('strips invisible and control characters, keeps newlines', () => {
    const r = sanitiseUserText(
      `he${ZERO_WIDTH}llo${BIDI}${TAG_A}${NUL}\nworld`,
      100,
    );
    expect(r).toEqual({ text: 'hello\nworld', truncated: false });
  });

  it('neutralises markdown and html images (no remote fetch channel)', () => {
    const r = sanitiseUserText(
      'a ![logo](https://evil.example/x.png?q=secret) b <img src="https://evil.example/y"> c ![ref][1]',
      200,
    );
    expect(r.text).not.toMatch(/evil\.example/);
    expect(r.text).toContain('[image: logo]');
    expect(r.text).toContain('[image]');
  });

  it('neutralises shortcut reference images and their definitions', () => {
    const r = sanitiseUserText('![p]\n\n[p]: //evil.example/pixel', 200);
    expect(r.text).not.toMatch(/evil[.]example/);
    expect(r.text).toContain('[image: p]');
    const r2 = sanitiseUserText(
      '![logo][1] and ![x][]\n[1]: https://evil.example/a ' +
        String.fromCharCode(34) +
        't' +
        String.fromCharCode(34) +
        '\n[x]: <//evil.example/b>',
      300,
    );
    expect(r2.text).not.toMatch(/evil[.]example/);
    expect(r2.text).toContain('[image: logo]');
  });

  it('neutralises protocol-relative urls but keeps ordinary slashes', () => {
    const r = sanitiseUserText(
      'open //evil.example/x now, and/or a//b is fine',
      200,
    );
    expect(r.text).not.toMatch(/evil[.]example/);
    expect(r.text).toContain('and/or a//b is fine');
  });

  it('neutralises links and raw urls', () => {
    const r = sanitiseUserText(
      'see [docs](https://evil.example/a) and https://evil.example/b or www.evil.example/c',
      300,
    );
    expect(r.text).not.toMatch(/evil\.example/);
    expect(r.text).toContain('docs [link removed]');
  });

  it('caps length by code points and flags truncation', () => {
    const r = sanitiseUserText('x'.repeat(50), 10);
    expect(r).toEqual({ text: 'x'.repeat(10), truncated: true });
    expect(sanitiseUserText('😀'.repeat(5), 5).truncated).toBe(false);
  });

  it('handles empty input', () => {
    expect(sanitiseUserText(null, 10)).toEqual({ text: '', truncated: false });
  });
});

describe('userText group', () => {
  it('sanitises each field and reports which were truncated', () => {
    const g = userText({
      title: { value: `T${ZERO_WIDTH}itle`, max: 100 },
      description: { value: 'y'.repeat(30), max: 10 },
      missing: { value: undefined, max: 10 },
    });
    expect(g).toEqual({
      title: 'Title',
      description: 'y'.repeat(10),
      missing: null,
      truncated: ['description'],
    });
  });
});
