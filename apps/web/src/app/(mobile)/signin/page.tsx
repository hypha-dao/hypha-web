import { useAuthentication } from '@hypha-platform/authentication';
import { ButtonSigninMobile } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';

export default async function Index() {
  return (
    <div className="flex items-center h-full">
      <ButtonSigninMobile
        useAuthentication={useAuthentication}
        useMe={useMe}
        mobileRedirectUrl={process.env.NEXT_PUBLIC_MOBILE_REDIRECT_URL || ''}
      />
    </div>
  );
}
