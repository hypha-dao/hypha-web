'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import LogoDark from './logo-white.svg'; // for dark theme
import LogoLight from './logo-black.svg'; // for light theme
import { useEffect, useState } from 'react';

/** Wordmark viewBox aspect from logo-*.svg (575.44 × 196.01). */
const LOGO_ASPECT = 196.01 / 575.44;

type logoProps = {
  width?: number;
  height?: number;
  href?: string;
  target?: string;
};

export const Logo = ({ width = 100, height, href, target }: logoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const resolvedHeight = height ?? Math.round(width * LOGO_ASPECT);

  useEffect(() => {
    setMounted(true);
  }, []);

  // prevents hydration nextjs issue
  // return empty div to keep top justify-between and not show the wrong logo color
  if (!mounted || !resolvedTheme) {
    return (
      <div
        className="inline-block shrink-0"
        style={{ width, height: resolvedHeight }}
        aria-hidden
      />
    );
  }

  const logoSrc = resolvedTheme === 'dark' ? LogoDark : LogoLight;
  const img = (
    <Image
      key={resolvedTheme}
      src={logoSrc}
      alt="Logo"
      width={width}
      height={resolvedHeight}
      className="block h-auto max-h-[28px] w-auto"
      style={{ width, height: 'auto' }}
      priority
    />
  );
  if (href) {
    return (
      <Link
        href={href}
        target={target}
        className="inline-flex h-[36px] shrink-0 items-center"
      >
        {img}
      </Link>
    );
  }
  return (
    <span className="inline-flex h-[36px] shrink-0 items-center">{img}</span>
  );
};
