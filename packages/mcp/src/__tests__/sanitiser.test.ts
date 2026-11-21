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
    expect(r.text).toContain('(image: logo)');
    expect(r.text).toContain('(image)');
  });

  it('neutralises shortcut reference images and their definitions', () => {
    const r = sanitiseUserText('![p]\n\n[p]: //evil.example/pixel', 200);
    expect(r.text).not.toMatch(/evil[.]example/);
    expect(r.text).toContain('(image: p)');
    const r2 = sanitiseUserText(
      '![logo][1] and ![x][]\n[1]: https://evil.example/a ' +
        String.fromCharCode(34) +
        't' +
        String.fromCharCode(34) +
        '\n[x]: <//evil.example/b>',
      300,
    );
    expect(r2.text).not.toMatch(/evil[.]example/);
    expect(r2.text).toContain('(image: logo)');
  });

  it('neutralises protocol-relative urls but keeps ordinary slashes', () => {
    const r = sanitiseUserText(
      'open //evil.example/x now, and/or a//b is fine',
      200,
    );
    expect(r.text).not.toMatch(/evil[.]example/);
    expect(r.text).toContain('and/or a//b is fine');
  });

  it('removes link destinations whatever their scheme, including encoded ones', () => {
    const r = sanitiseUserText(
      '[open](&#104;ttps://evil.example/leak) and [x](/relative) and [y](javascript:alert(1))',
      300,
    );
    expect(r.text).not.toMatch(/evil[.]example|javascript/);
    expect(r.text).toContain('open (link removed)');
    expect(r.text).toContain('x (link removed)');
  });

  it('no link, image or reference can be rebuilt: no square or angle brackets survive', () => {
    const nasty = [
      ['> ![p] (', '>', '> [p]: &#47;&#47;evil.example/pixel'].join('\n'),
      '[open [details] here](/private/path)',
      ['![p]', '', '[p]: //evil.example/pixel'].join('\n'),
      ['[a][b]', '', '[b]: https://evil.example'].join('\n'),
      '<https://evil.example/x> and <img src=x> and <a href=x>y</a>',
      '[open](&#104;ttps://evil.example/leak)',
      '![x](javascript:alert(1)) [y](data:text/html,aaa)',
    ];
    const forbidden = new RegExp(
      '[' + String.fromCharCode(92) + '[' + String.fromCharCode(92) + ']<>]',
    );
    for (const input of nasty) {
      const { text } = sanitiseUserText(input, 500);
      expect(forbidden.test(text), input).toBe(false);
    }
  });

  it('removes the destination and keeps the label, also with balanced brackets and parentheses', () => {
    const cases: [string, string, string][] = [
      [
        '[open [details] here](/private/path)',
        'open (details) here (link removed)',
        '/private/path',
      ],
      ['[a](https://evil.example/x_(y))', 'a (link removed)', 'evil.example'],
      ['![alt [x]](//evil.example/p.png)', '(image: alt (x))', 'evil.example'],
      [
        '[outer [inner](/one)](/two)',
        'outer inner (link removed) (link removed)',
        '/two',
      ],
    ];
    for (const [input, expected, gone] of cases) {
      const { text } = sanitiseUserText(input, 300);
      expect(text, input).toContain(expected);
      expect(text, input).not.toContain(gone);
    }
  });

  it('bounds the work on very long input and still reports the truncation', () => {
    const long = '['.repeat(50_000) + 'x';
    const r = sanitiseUserText(long, 100);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(100);
  });

  it('neutralises links and raw urls', () => {
    const r = sanitiseUserText(
      'see [docs](https://evil.example/a) and https://evil.example/b or www.evil.example/c',
      300,
    );
    expect(r.text).not.toMatch(/evil\.example/);
    expect(r.text).toContain('docs (link removed)');
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

describe('sanitiseUserText at a word boundary', () => {
  const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa';

  it('does not cut a word in half', () => {
    const r = sanitiseUserText(text, 22, { atWordBoundary: true });
    // a hard cut at 22 would end in "gamma delta e"
    expect(r.text).toBe('alpha beta gamma delta');
    expect(r.truncated).toBe(true);
  });

  it('keeps the whole text, unflagged, when it fits', () => {
    const r = sanitiseUserText(text, 200, { atWordBoundary: true });
    expect(r).toEqual({ text, truncated: false });
  });

  it('cuts exactly at the limit when it falls on a space', () => {
    const r = sanitiseUserText('alpha beta gamma', 11, {
      atWordBoundary: true,
    });
    expect(r.text).toBe('alpha beta');
  });

  it('drops a dangling markdown marker left at the end', () => {
    const r = sanitiseUserText('Plan the garden ** and more words here', 18, {
      atWordBoundary: true,
    });
    expect(r.text).toBe('Plan the garden');
  });

  it('keeps the hard cut for a very long unbroken word', () => {
    const r = sanitiseUserText(`ab ${'x'.repeat(100)}`, 20, {
      atWordBoundary: true,
    });
    expect(Array.from(r.text)).toHaveLength(20);
  });

  it('without the option the cut is unchanged (titles and labels)', () => {
    expect(sanitiseUserText(text, 22).text).toBe('alpha beta gamma delta');
    expect(sanitiseUserText('abcdefghij', 5).text).toBe('abcde');
  });
});
