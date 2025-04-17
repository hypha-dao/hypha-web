'use client';

import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RxCross1 } from 'react-icons/rx';

export const ButtonClose = ({ dropSegment }: { dropSegment: string }) => {
  const pathname = usePathname();
  console.debug('ButtonClose', { pathname });

  return (
    <Button
      variant="ghost"
      colorVariant="neutral"
      className="absolute top-8 right-9"
    >
      <Link href={pathname.replace(dropSegment, '')}>
        Close
        <RxCross1 />
      </Link>
    </Button>
  );
};
