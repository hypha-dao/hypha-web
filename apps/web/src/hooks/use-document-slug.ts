import { useParams } from 'next/navigation';

export const useDocumentSlug = () => {
  const params = useParams();
  return params.documentSlug as string;
};
