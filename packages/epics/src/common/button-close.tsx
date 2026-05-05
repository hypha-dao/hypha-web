'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Common');
  const pathname = usePathname();

  if (!closeUrl) {
    if (dropSegment) {
      const normalized = dropSegment.startsWith('/')
        ? dropSegment
        : `/${dropSegment}`;
      if (pathname.endsWith(normalized)) {
        closeUrl = pathname.slice(0, -normalized.length) || '/';
      } else if (pathname.includes(`${normalized}/`)) {
        closeUrl = pathname.replace(`${normalized}/`, '/');
      } else {
        closeUrl = pathname.replace(dropSegment, '');
      }
    } else {
      console.debug('ButtonClose: closeUrl or dropSegment must be provided');
      return null;
    }
  }

  const title = t('close');
  const mergedClassName = cn(
    'inline-flex items-center gap-1 whitespace-nowrap',
    className,
  );

  return (
    <Button asChild variant="ghost" colorVariant="neutral" title={title}>
      <Link href={closeUrl} scroll={false} className={mergedClassName}>
        {narrow ? null : title}
        <RxCross1 />
      </Link>
    </Button>
  );
};
