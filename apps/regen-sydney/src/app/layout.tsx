import type { Metadata } from 'next';

import './global.css';

import { CampaignProvider } from './_lib/campaign-store';
import { regenSydneyFontVariables } from './_lib/fonts';
import { RsPrivyProvider } from './_lib/privy-provider';

export const metadata: Metadata = {
  title: 'Regen Sydney — Community Fund',
  description:
    'Contribute to the Regen Sydney community fund, receive voting tokens, and decide together how the pot is shared across projects regenerating the Sydney bioregion.',
  icons: { icon: '/media/rs-logo.webp' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={regenSydneyFontVariables}>
      <body className="rs-root">
        <RsPrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''}>
          <CampaignProvider>{children}</CampaignProvider>
        </RsPrivyProvider>
      </body>
    </html>
  );
}
