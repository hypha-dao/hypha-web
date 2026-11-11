import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Button } from '@hypha-platform/ui';
import { Html } from '@hypha-platform/ui/server';
import { GlobeIcon } from '@radix-ui/react-icons';
import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { hyphaFontVariables } from '@web/lib/hypha-fonts';
import { WL_MODE_HEADER, WL_NOT_FOUND_HEADER } from '@web/lib/white-label';
import RootLayout from './(main)/layout';

import '@hypha-platform/ui-utils/global.css';

export const metadata: Metadata = {
  title: 'Hypha: Page Not Found',
  description: 'The page you are looking for does not exist.',
};

/**
 * The single not-found fallback (`experimental.globalNotFound`). White-label
 * requests (middleware sets a header) get a bare shell: own html, translations,
 * no providers, no Privy, no link out of the frame. Everything else renders the
 * main layout as before.
 */
export default async function GlobalNotFound() {
  const tCommon = await getTranslations('Common');
  const requestHeaders = await headers();
  const mode = requestHeaders.get(WL_MODE_HEADER);
  const whiteLabel =
    mode === 'embed' ||
    mode === 'host' ||
    requestHeaders.get(WL_NOT_FOUND_HEADER) === '1';

  if (whiteLabel) {
    const locale = await getLocale().catch(() => 'en');
    return (
      <Html lang={locale} className={hyphaFontVariables}>
        <div className="w-full min-h-[24rem] flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-9 font-medium">
            <span>{tCommon('notFoundOops')} </span>
            <span>{tCommon('notFoundCouldNotFindPage')}</span>
          </h1>
          <p className="text-4 text-neutral-11">
            {tCommon('notFoundDescription')}
          </p>
        </div>
      </Html>
    );
  }

  return (
    <RootLayout>
      <div className="w-full h-96 relative">
        <div className="flex flex-col items-center justify-center p-0 gap-6 absolute top-0 left-0 right-0 bottom-0">
          <div className="flex flex-row items-center justify-center text-center p-2 md:p-0 gap-9">
            <h1 className="md:flex-none flex-wrap order-none self-stretch grow-0 text-9 font-medium">
              <span>{tCommon('notFoundOops')} </span>
              <span>{tCommon('notFoundCouldNotFindPage')}</span>
            </h1>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-2 md:p-0 gap-9">
            <div className="md:flex-none flex-wrap order-none self-stretch grow-0 text-4 text-neutral-11">
              {tCommon('notFoundDescription')}
            </div>
          </div>
          <div className="flex flex-row justify-center items-center pt-0 pb-0 pl-3 pr-3 gap-2 isolate">
            <Link className="flex-none order-2 grow-0" href={`/network`}>
              <Button colorVariant="accent" variant="default" className="gap-2">
                <GlobeIcon />
                {tCommon('exploreSpaces')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </RootLayout>
  );
}
