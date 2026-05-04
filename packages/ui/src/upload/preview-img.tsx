export type PreviewImgProps = {
  src: string;
  alt?: string;
  className?: string;
};
export const PreviewImg = ({
  src,
  alt = 'Upload Preview Image',
  className = '',
}: PreviewImgProps) => {
  // Allow callers to control how the image fits (e.g. `object-contain` for banners).
  // Previously we always forced `object-cover`, which clipped content even when
  // `object-contain` was passed in `className`.
  const hasObjectFitClass =
    /\bobject-(contain|cover|fill|none|scale-down)\b/.test(className);

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`pointer-events-none h-full w-full ${
        hasObjectFitClass ? '' : 'object-cover'
      } ${className}`}
    />
  );
};
