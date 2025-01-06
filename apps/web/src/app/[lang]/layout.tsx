import { Footer, Html, MenuTop, ThemeProvider } from '@hypha-platform/ui/server';
import '@hypha-platform/ui-utils/global.css';

import { Lato, Source_Sans_3 } from 'next/font/google';
import clsx from 'clsx';
import { ButtonProfile } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

const lato = Lato({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-heading',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Welcome to web',
  description: 'Generated by create-nx-workspace',
};

export default async function RootLayout({
  children,
  modal,
  ...props
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  console.debug('RootLayout', { modal });
  const params = await props.params;

  const { lang } = params;
  return (
    <Html className={clsx(lato.variable, sourceSans.variable)}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
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
        <div className="pt-9">{children}</div>
        {modal}
        <Footer />
      </ThemeProvider>
    </Html>
  );
}
