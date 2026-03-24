import clsx from 'clsx';

export type PreviewImgProps = {
  src: string;
  alt?: string;
  className?: string;
};
export const PreviewImg = ({
  src,
  alt = 'Upload Preview Image',
  className,
}: PreviewImgProps) => {
  return (
    <img
      src={src}
      alt={alt}
      className={clsx('object-cover', className ?? 'h-full w-full')}
    />
  );
};
