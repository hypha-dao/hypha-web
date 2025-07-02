export type PreviewImgProps = {
  src: string;
  alt?: string;
};
export const PreviewImg = ({
  src,
  alt = 'Upload Preview Image',
}: PreviewImgProps) => {
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
};
