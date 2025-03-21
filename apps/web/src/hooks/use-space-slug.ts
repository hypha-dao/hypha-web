import { useParams } from 'next/navigation';

export const useSpaceSlug = () => {
  const params = useParams();
  return params.id as string;
};
