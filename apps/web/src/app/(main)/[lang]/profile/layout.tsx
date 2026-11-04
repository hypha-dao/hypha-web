import { SpaceAccentPortalBridge } from '@hypha-platform/epics';
import '../_shared/space-accent.css';

export const metadata = {
  title: 'Your Profile | Hypha',
  description:
    'Manage your Hypha account settings, view your activity, and customise your profile preferences.',
};

export default async function RootLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <SpaceAccentPortalBridge>
      <div className="w-full h-full flex">
        {children}
        {aside}
      </div>
    </SpaceAccentPortalBridge>
  );
}
