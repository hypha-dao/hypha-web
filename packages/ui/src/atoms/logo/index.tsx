'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import LogoDark from './logo-white.svg'; // for dark theme
import LogoLight from './logo-black.svg'; // for light theme
import { useEffect, useState } from 'react';

type logoProps = {
  width?: number;
  height?: number;
  href?: string;
  target?: string;
};

export const Logo = ({
  width = 100,
  height = 100,
  href,
  target,
}: logoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // prevents hydration nextjs issue
  // return empty div to keep top justify-between and not show the wrong logo color
  if (!mounted || !resolvedTheme) return <div></div>;

  const logoSrc = resolvedTheme === 'dark' ? LogoDark : LogoLight;
  const img = (
    <Image
      key={resolvedTheme}
      src={logoSrc}
      alt="Logo"
      width={width}
      height={height}
    />
  );
  if (href) {
    return (
      <Link href={href} target={target}>
        {img}
      </Link>
    );
  }
  return img;
};
