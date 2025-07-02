import { useAuthentication } from '@hypha-platform/authentication';
import { ConnectedButtonProfile } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { MenuTop } from '@hypha-platform/ui/server';
import { useMe } from '@hypha-platform/core/client';

export default async function DhoLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const params = await props.params;

  const { lang } = params;

  const { children } = props;

  return (
    <div className="flex flex-grow w-full h-full">
      <MenuTop
        withLogo={true}
        navItems={[
          {
            label: 'Network',
            href: `/${lang}/network`,
          },
          {
            label: 'My Spaces',
            href: `/${lang}/my-spaces`,
          },
        ]}
      >
        <MenuTop.RightSlot>
          <ConnectedButtonProfile
            useAuthentication={useAuthentication}
            useMe={useMe}
            newUserRedirectPath="/profile/signup"
            baseRedirectPath="/my-spaces"
          />
        </MenuTop.RightSlot>
      </MenuTop>
      <div className="fixed bottom-0 right-0 flex-grow overflow-y-auto top-9 w-full bg-background/5">
        {children}
      </div>
    </div>
  );
}
