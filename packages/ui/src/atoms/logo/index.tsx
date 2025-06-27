import Image from 'next/image';
import LogoSrc from './logo-white.svg';

type logoProps = {
  width?: number;
  height?: number;
};

export const Logo = ({ width, height }: logoProps) => (
  <Image
    src={LogoSrc}
    alt="Logo"
    width={width ? width : 100}
    height={height ? height : 100}
  />
);
