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
    <div className="flex h-full w-full">
      {children}
      {aside}
    </div>
  );
}
