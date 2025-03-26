export type PreviewImgProps = {
  src: string;
  aspectRatio?: number;
};
export const PreviewImg = ({ src, aspectRatio }: PreviewImgProps) => {
  return <img src={src} alt="Preview" className="w-full h-full object-cover" />;
};
