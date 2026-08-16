// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { htmlToChatLinkMarkup } from '../html-to-chat-link-markup';

describe('htmlToChatLinkMarkup', () => {
  it('converts anchor tags to markdown links', () => {
    expect(
      htmlToChatLinkMarkup(
        '<p>see <a href="https://example.com">docs</a> now</p>',
      ),
    ).toBe('see [docs](https://example.com) now');
  });

  it('returns null when there are no anchors', () => {
    expect(htmlToChatLinkMarkup('<p>plain</p>')).toBeNull();
  });

  it('ignores javascript hrefs', () => {
    expect(
      htmlToChatLinkMarkup('<a href="javascript:alert(1)">x</a>'),
    ).toBeNull();
  });
});
