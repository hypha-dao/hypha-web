// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    alt,
    onError,
    src,
  }: {
    alt?: string;
    onError?: React.ReactEventHandler<HTMLImageElement>;
    src: string;
  }) => <img alt={alt ?? ''} src={src} onError={onError} />,
}));

import { OptimizedAvatarImage } from '../optimized-avatar-image';

afterEach(() => {
  cleanup();
});

describe('OptimizedAvatarImage', () => {
  it('shows the fallback when the image fails to load', () => {
    render(
      <OptimizedAvatarImage
        src="https://bovzk9ehhu.ufs.sh/f/broken.png"
        alt="Ada"
        pixelSize={32}
        fallback={<span>fallback</span>}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Ada' }));
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Ada' })).toBeNull();
  });

  it('retries the image after src changes', () => {
    const { rerender } = render(
      <OptimizedAvatarImage
        src="https://bovzk9ehhu.ufs.sh/f/broken.png"
        alt="Ada"
        pixelSize={32}
        fallback={<span>fallback</span>}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Ada' }));
    expect(screen.getByText('fallback')).toBeTruthy();

    rerender(
      <OptimizedAvatarImage
        src="https://bovzk9ehhu.ufs.sh/f/ok.png"
        alt="Ada"
        pixelSize={32}
        fallback={<span>fallback</span>}
      />,
    );
    expect(screen.queryByText('fallback')).toBeNull();
    expect(screen.getByRole('img', { name: 'Ada' }).getAttribute('src')).toBe(
      'https://bovzk9ehhu.ufs.sh/f/ok.png',
    );
  });
});
