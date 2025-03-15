import { useParams } from 'next/navigation';

export const usePersonSlug = () => {
  const params = useParams();
  return params.personSlug as string;
};
