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
import { toNextImageOptimizerSrc } from '../optimize-remote-image';

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
      toNextImageOptimizerSrc('https://bovzk9ehhu.ufs.sh/f/ok.png', 64, 70),
    );
  });

  it('renders a ufs.sh PNG as a single /_next/image wrap with a valid w', () => {
    const pontaPng =
      'https://bovzk9ehhu.ufs.sh/f/6MiOwFUJuAcocp3uZG4AN0lxYkareI1GvqLDX2FV5jh8d4fo';
    render(<OptimizedAvatarImage src={pontaPng} alt="Ponta" pixelSize={56} />);
    const src = screen.getByRole('img', { name: 'Ponta' }).getAttribute('src');
    expect(src).toBe(
      `/_next/image?url=${encodeURIComponent(pontaPng)}&w=128&q=70`,
    );
    expect(src?.match(/\/_next\/image\?/g)).toHaveLength(1);
    expect(src).not.toContain('url=%2F_next%2Fimage');
  });

  it('leaves a GIF on the CDN', () => {
    const gif = 'https://bovzk9ehhu.ufs.sh/f/community-logo.gif';
    render(<OptimizedAvatarImage src={gif} alt="Gif" pixelSize={56} />);
    expect(screen.getByRole('img', { name: 'Gif' }).getAttribute('src')).toBe(
      gif,
    );
  });
});
