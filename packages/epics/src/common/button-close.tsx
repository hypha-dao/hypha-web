'use client';

import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RxCross1 } from 'react-icons/rx';

type ButtonCloseProps = {
  closeUrl?: string;
  dropSegment?: string;
  narrow?: boolean;
  className?: string;
};

export const ButtonClose = ({
  closeUrl,
  dropSegment,
  narrow = false,
  className,
}: ButtonCloseProps) => {
  const pathname = usePathname();

  if (!closeUrl) {
    if (dropSegment) {
      closeUrl = pathname.replace(dropSegment, '');
    } else {
      console.debug('ButtonClose: closeUrl or dropSegment must be provided');
      return null;
    }
  }

  const title = 'Close';

  return (
    <Button
      asChild
      variant="ghost"
      colorVariant="neutral"
      className={className}
      title={title}
    >
      <Link href={closeUrl} scroll={false}>
        {narrow ? null : title}
        <RxCross1 />
      </Link>
    </Button>
  );
};
