import React from 'react';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon } from '@radix-ui/react-icons';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import RootLayout from './layout';

export const metadata: Metadata = {
  title: 'Hypha: Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default async function GlobalNotFound() {
  const tCommon = await getTranslations('Common');

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
