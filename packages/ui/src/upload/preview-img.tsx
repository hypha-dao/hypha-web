export type PreviewImgProps = {
  src: string;
  alt?: string;
};
export const PreviewImg = ({
  src,
  alt = 'Upload Preview Image',
}: PreviewImgProps) => {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="pointer-events-none h-full w-full object-cover"
    />
  );
};
