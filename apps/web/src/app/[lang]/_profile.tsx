'use client';

import { useMe } from '@web/hooks/use-me';

export const Profile = () => {
  const { person } = useMe();

  return (<pre>{JSON.stringify(person, null, 2)}</pre>);
};
