'use client';

import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { cn } from '@hypha-platform/lib/utils';

type ButtonBackProps = {
  label?: string;
  backUrl?: string;
  dropSegment?: string;
  className?: string;
};

export const ButtonBack = ({
  label = 'Back',
  backUrl,
  dropSegment,
  className,
}: ButtonBackProps) => {
  const pathname = usePathname();

  let resolvedBackUrl = backUrl;
  if (!resolvedBackUrl) {
    if (dropSegment) {
      resolvedBackUrl = pathname.endsWith(dropSegment)
        ? pathname.slice(0, -dropSegment.length)
        : pathname.replace(dropSegment, '');
    } else {
      console.debug('ButtonBack: backUrl or dropSegment must be provided');
      return null;
    }
  }

  return (
    <Button
      asChild
      variant="ghost"
      colorVariant="neutral"
      className={cn('text-neutral-10', className)}
    >
      <Link href={resolvedBackUrl} scroll={false}>
        <ChevronLeftIcon className="size-4" />
        {label}
      </Link>
    </Button>
  );
};
