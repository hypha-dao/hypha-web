import { ButtonProfile } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { MenuTop } from '@hypha-platform/ui/server';

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
          {
            label: 'Wallet',
            href: `/${lang}/wallet`,
          },
        ]}
      >
        <MenuTop.RightSlot>
          <ButtonProfile
            avatarSrc="https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop"
            userName="Jane Doe"
          />
        </MenuTop.RightSlot>
      </MenuTop>
      <div className="fixed bottom-0 right-0 flex-grow overflow-y-auto top-9 w-full bg-background/5">
        {children}
      </div>
    </div>
  );
}
