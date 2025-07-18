import { useAuthentication } from '@hypha-platform/authentication';
import { ButtonSigninMobile } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

export default async function Index() {
  const headersList = await headers();
  const ua = headersList.get('user-agent') || '';
  const hyphaUserAgent = process.env.NEXT_PUBLIC_MOBILE_USER_AGENT || '';

  // If mobile user agent is set, it checks if the user is using Hypha app
  const isHyphaApp = !hyphaUserAgent || ua.includes(hyphaUserAgent);

  if (!isHyphaApp) {
    notFound();
  }

  return (
    <div className="flex items-center h-full">
      <ButtonSigninMobile
        useAuthentication={useAuthentication}
        useMe={useMe}
        mobileRedirectUrl={process.env.NEXT_PUBLIC_MOBILE_REDIRECT_URL || 'myapp://callback'}
      />
    </div>
  );
}
