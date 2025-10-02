import React from 'react';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon } from '@radix-ui/react-icons';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hypha: Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default function GlobalNotFound() {
  return (
    <div className="w-full h-96 relative">
      <div className="flex flex-col items-center justify-center p-0 gap-6 absolute top-0 left-0 right-0 bottom-0">
        <div className="flex flex-row items-start p-0 gap-9">
          <h1 className="flex-none order-none self-stretch grow-0 text-9 font-medium">
            Oooops! We couldn’t find this page
          </h1>
        </div>
        <div className="flex flex-col items-start p-0 gap-9">
          <div className="flex-none order-none self-stretch grow-0 text-4 text-neutral-11">
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
