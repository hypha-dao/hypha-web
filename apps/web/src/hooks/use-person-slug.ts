import { ProfileComponentParams } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

export const usePersonSlug = () => {
  const params = useParams<ProfileComponentParams>();
  return decodeURIComponent(params.personSlug);
};
