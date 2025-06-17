'use client';

import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeftIcon } from "@radix-ui/react-icons";

type ButtonBackProps = {
  label?: string;
  backUrl?: string;
  dropSegment?: string;
  className?: string;
};

export const ButtonBack = ({
  label = "Back",
  backUrl,
  dropSegment,
  className
}: ButtonBackProps) => {
  const pathname = usePathname();

  if (!backUrl) {
    if (dropSegment) {
      backUrl = pathname.replace(dropSegment, '');
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
      className={className}
    >
      <Link href={backUrl} scroll={false}>
        <ChevronLeftIcon className="size-4"/>
        {label}
      </Link>
    </Button>
  );
};
