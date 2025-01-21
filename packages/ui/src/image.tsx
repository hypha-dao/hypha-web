import NextImage, { ImageProps } from 'next/image';
import { forwardRef } from 'react';

/** Wrap next/image to allow for unoptimizing all images inside Storybook */
export let Image = NextImage;

const UnoptimizedImage = forwardRef<HTMLImageElement, ImageProps>(
  function Image(props, ref) {
    return <NextImage ref={ref} {...props} unoptimized />;
  }
) as typeof NextImage;

/**
 * For usage from .storybook/preview.ts so that images can be unoptimized
 * inside Storybook.
 *
 *     import { unoptimizeNextImageForStorybook } from '@/atoms/Image/Image'
 *     unoptimizeNextImageForStorybook()
 */
export function unoptimizeNextImageForStorybook() {
  Image = UnoptimizedImage;
}

export default Image;
