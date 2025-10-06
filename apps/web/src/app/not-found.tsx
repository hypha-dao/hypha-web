import React from 'react';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon } from '@radix-ui/react-icons';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hypha: Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="w-full min-h-[24rem] relative">
      <div className="flex flex-col items-center justify-center p-0 gap-6 absolute top-0 left-0 right-0 bottom-0">
        <div className="flex flex-row items-center justify-center text-center p-2 md:p-0 gap-9">
          <h1 className="md:flex-none flex-wrap order-none self-stretch grow-0 text-9 font-medium">
            <span>Oooops! </span>
            <span>We couldn’t find this page</span>
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-2 md:p-0 gap-9">
          <div className="md:flex-none flex-wrap order-none self-stretch grow-0 text-4 text-neutral-11">
            The page you are looking for might have been removed, had its name
            changed, or is temporarily unavailable
          </div>
        </div>
        <div className="flex flex-row justify-center items-center pt-0 pb-0 pl-3 pr-3 gap-2 isolate">
          <Link className="flex-none order-2 grow-0" href={`/network`}>
            <Button colorVariant="accent" variant="default" className="gap-2">
              <GlobeIcon />
              Explore Spaces
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
