'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import LogoDark from './logo-white.svg'; // for dark theme
import LogoLight from './logo-black.svg'; // for light theme

type LogoProps = {
  width?: number;
  height?: number;
};

export const Logo = ({ width = 100, height = 100 }: LogoProps) => {
  const { resolvedTheme } = useTheme();

  const logoSrc = resolvedTheme === 'dark' ? LogoDark : LogoLight;

  return (
    <Image
      src={logoSrc}
      alt="Logo"
      width={width}
      height={height}
    />
  );
};
