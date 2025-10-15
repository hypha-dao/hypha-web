import { ProfileComponentParams } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useParams } from 'next/navigation';

export const usePersonSlug = () => {
  const params = useParams<ProfileComponentParams>();
  return tryDecodeUriPart(params.personSlug);
};
