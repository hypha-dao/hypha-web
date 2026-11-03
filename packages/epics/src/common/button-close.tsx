'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { RxCross1 } from 'react-icons/rx';
import { createAsideOverlayCloseHandler } from './aside-overlay-close';

type ButtonCloseProps = {
  closeUrl?: string;
  dropSegment?: string;
  narrow?: boolean;
  className?: string;
  preferBack?: boolean;
  /** Replaces link navigation (e.g. query-param dialogs that close by editing the URL). */
  onClose?: () => void;
};

export const ButtonClose = ({
  closeUrl,
  dropSegment,
  narrow = false,
  className,
  preferBack = false,
  onClose,
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
    createAsideOverlayCloseHandler({ closeUrl, pathname, router }),
    [closeUrl, pathname, router],
  );

  const onClick = onClose
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onClose();
      }
    : preferBack
    ? handleClick
    : undefined;

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

export { createAsideOverlayCloseHandler } from './aside-overlay-close';
