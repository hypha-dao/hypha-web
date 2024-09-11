import { Html, Menu, Theme } from '@hypha-platform/ui/server';
import '@radix-ui/themes/styles.css';
import '@hypha-platform/ui-utils/global.css';

export const metadata = {
  title: 'Welcome to web',
  description: 'Generated by create-nx-workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Theme>
        <Menu />
        {children}
      </Theme>
    </Html>
  );
}
