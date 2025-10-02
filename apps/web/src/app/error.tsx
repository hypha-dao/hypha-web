'use client';

import React, { useEffect } from 'react';
import { Button } from '@hypha-platform/ui';
import { ReloadIcon } from '@radix-ui/react-icons';
import { LightRootLayout } from '@web/components/light-root-layout';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <LightRootLayout>
      <div className="w-full h-96 relative">
        <div className="flex flex-col items-center justify-center p-0 gap-6 absolute top-0 left-0 right-0 bottom-0">
          <div className="flex flex-row items-start p-0 gap-9">
            <h1 className="flex-none order-none self-stretch grow-0 text-9 font-medium">
              We’ll Be Back Shortly!
            </h1>
          </div>
          <div className="flex flex-col items-start p-0 gap-9">
            <div className="flex-none order-none self-stretch grow-0 text-4 text-neutral-11">
              Hypha is taking a short break while we roll out updates. We’ll be
              back soon with exciting improvements on the way!
            </div>
          </div>
          <div className="flex flex-row justify-center items-center pt-0 pb-0 pl-3 pr-3 gap-2 isolate">
            <div className="flex-none order-2 grow-0">
              <Button
                colorVariant="accent"
                variant="default"
                className="gap-2"
                onClick={reset}
              >
                <ReloadIcon />
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      </div>
    </LightRootLayout>
  );
}
