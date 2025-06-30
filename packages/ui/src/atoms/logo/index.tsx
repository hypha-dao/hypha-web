import Image from 'next/image';
import LogoSrc from './logo-white.svg';
import Link from 'next/link';

type logoProps = {
  width?: number;
  height?: number;
  href?: string;
};

export const Logo = ({ width, height, href }: logoProps) => {
  const img = (
    <Image
      src={LogoSrc}
      alt="Logo"
      width={width ? width : 100}
      height={height ? height : 100}
    />
  );
  if (!!href) {
    return <Link href={href}>{img}</Link>;
  }
  return img;
};
