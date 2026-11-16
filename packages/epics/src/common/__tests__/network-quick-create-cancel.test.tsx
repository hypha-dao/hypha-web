// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/en/home',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useJwt: () => ({ jwt: 'token' }),
    useMe: () => ({
      person: { slug: 'ada', primaryOrientation: 'member' },
      isLoading: false,
    }),
    useAttachmentUpload: () => ({ upload: vi.fn() }),
  };
});

vi.mock('@hypha-platform/ui', () => ({
  AddAttachment: () => null,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock('../../network-exchange/member-space-select', () => ({
  MemberSpaceSelect: () => null,
}));

vi.mock('../../network-exchange/linked-treasury-amount', () => ({
  appendIndicativePayoutParams: (href: string) => href,
  LinkedTreasuryAmountField: () => null,
}));

import { NetworkQuickCreate } from '../../network-exchange/network-quick-create';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe('NetworkQuickCreate space fetch cancellation', () => {
  let resolveIntel: ((value: Response) => void) | undefined;
  const fetchMock = vi.fn();

  beforeEach(() => {
    resolveIntel = undefined;
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/api/v1/people/me/intelligence')) {
        return await new Promise<Response>((resolve) => {
          resolveIntel = resolve;
        });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not fetch /people/:slug/spaces after the sheet closes mid-intelligence', async () => {
    const { rerender } = render(<NetworkQuickCreate lang="en" enabled />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/v1/people/me/intelligence'),
      ),
    ).toBe(true);

    rerender(<NetworkQuickCreate lang="en" enabled={false} />);
    await act(async () => {
      resolveIntel?.(jsonResponse({ spaces: [] }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/v1/people/ada/spaces'),
      ),
    ).toBe(false);
  });
});
