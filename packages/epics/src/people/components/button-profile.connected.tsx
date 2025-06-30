'use client';

import { ButtonProfile } from './button-profile';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { UseAuthentication } from '@hypha-platform/authentication';
import { UseMe } from '../hooks/types';

type ConnectedButtonProfileProps = {
  useAuthentication: UseAuthentication;
  useMe: UseMe;
};

export const ConnectedButtonProfile = ({
  useAuthentication,
  useMe,
}: ConnectedButtonProfileProps) => {
  const { isAuthenticated, logout, user } = useAuthentication();
  const { person } = useMe();

  const router = useRouter();
  const { lang } = useParams();

  return (
    <ButtonProfile
      avatarSrc={person?.avatarUrl ?? ''}
      userName={person?.name ?? ''}
      address={user?.wallet?.address}
      isConnected={isAuthenticated}
      onLogin={() => {
        router.push(`/${lang}/profile/signin`);
      }}
      onLogout={logout}
      onProfile={() => {
        router.push(`/${lang}/profile/`);
      }}
    />
  );
};
