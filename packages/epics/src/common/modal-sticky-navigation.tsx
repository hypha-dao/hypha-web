'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ButtonBack } from './button-back';
import { ButtonClose } from './button-close';
import { cn } from '@hypha-platform/ui-utils';

export type ModalStickyNavigationProps = {
  /** Title only (no subtitle), e.g. “Create Space” — shown left like upload-image dialogs. */
  contextTitle?: ReactNode;
  /** Full URL to navigate on close (wins over `closeDropSegment`). */
  closeUrl?: string;
  /** Path segment to strip from the current pathname for close (e.g. `/select-settings-action`). */
  closeDropSegment?: string;
  /** Full URL for back; if omitted and `backToParent` is true, uses parent path of current route. */
  backUrl?: string;
  /** When `backUrl` is not set, navigate to `pathname` with the last segment removed. */
  backToParent?: boolean;
  /** Back button label (defaults to Common.back). */
  backLabel?: string;
  /** When false, hide back even if a URL could be resolved. */
  showBack?: boolean;
  /** Rendered immediately before Back / Close (e.g. space settings gear). */
  beforeNavActions?: ReactNode;
  className?: string;
};

/**
 * Sticky top bar with optional context title + Back / Close — stays visible while the
 * modal body scrolls (`ProposalOverlayShell` inner scroller).
 */
export function ModalStickyNavigation({
  contextTitle,
  closeUrl: closeUrlProp,
  closeDropSegment,
  backUrl: backUrlProp,
  backToParent,
  backLabel,
  showBack = true,
  beforeNavActions,
  className,
}: ModalStickyNavigationProps) {
  const pathname = usePathname();
  const tCommon = useTranslations('Common');

  const normalizedCloseDropSegment = closeDropSegment
    ? closeDropSegment.startsWith('/')
      ? closeDropSegment
      : `/${closeDropSegment}`
    : undefined;

  const closeUrl = (() => {
    if (closeUrlProp) {
      return closeUrlProp;
    }
    if (!normalizedCloseDropSegment) {
      return undefined;
    }
    if (pathname.endsWith(normalizedCloseDropSegment)) {
      return pathname.slice(0, -normalizedCloseDropSegment.length) || '/';
    }
    if (pathname.endsWith(`${normalizedCloseDropSegment}/`)) {
      return pathname.slice(0, -(normalizedCloseDropSegment.length + 1)) || '/';
    }
    if (pathname.includes(`${normalizedCloseDropSegment}/`)) {
      return pathname.replace(`${normalizedCloseDropSegment}/`, '/');
    }
    const strippedPath = pathname.replace(normalizedCloseDropSegment, '');
    if (strippedPath && strippedPath !== pathname) {
      return strippedPath;
    }
    // Fallback: if segment matching failed for any route variant,
    // still close by navigating to the parent path instead of no-op.
    const lastSlash = pathname.lastIndexOf('/');
    if (lastSlash <= 0) {
      return '/';
    }
    return pathname.slice(0, lastSlash) || '/';
  })();

  if (
    process.env.NODE_ENV !== 'production' &&
    normalizedCloseDropSegment &&
    closeUrlProp === undefined &&
    closeUrl === undefined
  ) {
    console.warn(
      '[ModalStickyNavigation] closeDropSegment does not match pathname tail',
      { pathname, normalizedCloseDropSegment },
    );
  }

  const rawBackUrl =
    backUrlProp ??
    (backToParent && pathname.includes('/')
      ? pathname.slice(0, pathname.lastIndexOf('/'))
      : undefined);

  const backUrl =
    rawBackUrl === undefined || rawBackUrl === null
      ? undefined
      : rawBackUrl === ''
      ? '/'
      : rawBackUrl;

  const resolvedBackLabel = backLabel ?? tCommon('back');

  if (!closeUrl) {
    return null;
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-[5] -mx-4 mb-4 bg-background-2/95 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7',
          contextTitle ? 'justify-between' : 'justify-end',
        )}
      >
        {contextTitle ? (
          <h2
            className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground"
            id="modal-aside-context-title"
          >
            {contextTitle}
          </h2>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden />
        )}
        <div className="flex shrink-0 items-center justify-end gap-1">
          {beforeNavActions}
          {showBack && backUrl ? (
            <ButtonBack
              label={resolvedBackLabel}
              backUrl={backUrl}
              className="px-0 md:px-3"
            />
          ) : null}
          <ButtonClose
            closeUrl={closeUrl}
            preferBack={true}
            className="px-0 md:px-3"
          />
        </div>
      </div>
    </div>
  );
}
