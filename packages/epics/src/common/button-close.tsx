'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MouseEvent, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { RxCross1 } from 'react-icons/rx';
import { APP_NAV_COUNT_KEY } from './app-navigation-session';

type ButtonCloseProps = {
  closeUrl?: string;
  dropSegment?: string;
  narrow?: boolean;
  className?: string;
  preferBack?: boolean;
};

export const ButtonClose = ({
  closeUrl,
  dropSegment,
  narrow = false,
  className,
  preferBack = false,
}: ButtonCloseProps) => {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const router = useRouter();

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
      return null;
    }
  }

  const title = t('close');
  const mergedClassName = cn(
    'inline-flex items-center gap-1 whitespace-nowrap',
    className,
  );
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (typeof window === 'undefined') {
        return;
      }
      const appNavCount = Number.parseInt(
        window.sessionStorage.getItem(APP_NAV_COUNT_KEY) ?? '0',
        10,
      );
      if (!Number.isFinite(appNavCount) || appNavCount <= 0) {
        return;
      }
      event.preventDefault();
      router.back();
    },
    [router],
  );

  const onClick = preferBack ? handleClick : undefined;

  return (
    <Button asChild variant="ghost" colorVariant="neutral" title={title}>
      <Link
        href={closeUrl}
        scroll={false}
        className={mergedClassName}
        onClick={onClick}
      >
        {narrow ? null : title}
        <RxCross1 />
      </Link>
    </Button>
  );
};
