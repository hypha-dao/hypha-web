'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ButtonBack } from './button-back';
import { ButtonClose } from './button-close';
import { cn } from '@hypha-platform/ui-utils';

export type ModalStickyNavigationProps = {
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
  className?: string;
};

/**
 * Sticky top bar with Back / Close aligned to proposal create flows — stays visible while the
 * modal body scrolls (`ProposalOverlayShell` inner scroller).
 */
export function ModalStickyNavigation({
  closeUrl: closeUrlProp,
  closeDropSegment,
  backUrl: backUrlProp,
  backToParent,
  backLabel,
  showBack = true,
  className,
}: ModalStickyNavigationProps) {
  const pathname = usePathname();
  const tCommon = useTranslations('Common');

  const closeUrl =
    closeUrlProp ??
    (closeDropSegment ? pathname.replace(closeDropSegment, '') : undefined);

  const backUrl =
    backUrlProp ??
    (backToParent && pathname.includes('/')
      ? pathname.slice(0, pathname.lastIndexOf('/'))
      : undefined);

  const resolvedBackLabel = backLabel ?? tCommon('back');

  if (!closeUrl) {
    return null;
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-[5] -mx-4 mb-4 border-b border-border bg-background-2 lg:-mx-7',
        className,
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-border px-4 lg:px-7">
        {showBack && backUrl ? (
          <ButtonBack
            label={resolvedBackLabel}
            backUrl={backUrl}
            className="px-0 md:px-3 align-top"
          />
        ) : null}
        <ButtonClose closeUrl={closeUrl} className="px-0 md:px-3 align-top" />
      </div>
    </div>
  );
}
