'use client';

import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RxCross1 } from 'react-icons/rx';

type ButtonCloseProps = {
  closeUrl?: string;
  dropSegment?: string;
  className?: string;
};

export const ButtonClose = ({
  closeUrl,
  dropSegment,
  className,
}: ButtonCloseProps) => {
  const tCommon = useTranslations('Common');
  const pathname = usePathname();

  if (!closeUrl) {
    if (dropSegment) {
      closeUrl = pathname.replace(dropSegment, '');
    } else {
      console.debug('ButtonClose: closeUrl or dropSegment must be provided');
      return null;
    }
  }

  return (
    <Button
      asChild
      variant="ghost"
      colorVariant="neutral"
      className={className}
    >
      <Link href={closeUrl} scroll={false}>
        {tCommon('close')}
        <RxCross1 />
      </Link>
    </Button>
  );
};
