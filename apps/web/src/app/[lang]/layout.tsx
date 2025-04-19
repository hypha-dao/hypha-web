import '@hypha-platform/ui-utils/global.css';

export const metadata = {
  title: 'Welcome to web',
  description: 'Generated by create-nx-workspace',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pt-9 w-screen h-full flex justify-normal">
      <div className="w-full h-full">{children}</div>
    </div>
  );
}
