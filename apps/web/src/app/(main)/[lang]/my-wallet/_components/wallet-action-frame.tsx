'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { MyWalletDashboard } from '@hypha-platform/epics';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useIsMobile,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const SHEET_CLOSE_NAV_MS = 280;

export function WalletActionFrame({
  lang,
  backLabel,
  title,
  children,
}: {
  lang: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const t = useTranslations('MyWallet');
  const closeHref = `/${lang}/my-wallet`;
  const [sheetOpen, setSheetOpen] = useState(true);

  useEffect(() => {
    if (isMobile !== true) return;
    setSheetOpen(true);
  }, [isMobile, title]);

  const closeToWallet = () => {
    setSheetOpen(false);
    window.setTimeout(() => {
      router.push(closeHref);
    }, SHEET_CLOSE_NAV_MS);
  };

  const desktop = (
    <div className="w-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 xl:gap-9 xl:px-9 xl:py-9">
        <header className="flex items-start justify-between gap-4">
          <h1
            className="min-w-0 text-6 font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {title}
          </h1>
          <Link
            href={closeHref}
            className="inline-flex shrink-0 items-center gap-1 pt-1 text-1 text-neutral-11 hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4 shrink-0" aria-hidden />
            {backLabel}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );

  // Desktop (and SSR / unknown): keep the full-page wallet action layout.
  if (isMobile !== true) {
    return desktop;
  }

  return (
    <>
      {/* Keep One Wallet behind the sheet, like Privy fund/receive. */}
      <div
        className="w-full min-w-0 overflow-x-hidden overflow-y-auto"
        aria-hidden
      >
        <div className="flex min-w-0 flex-col gap-4 px-5 py-3">
          <header>
            <p className="mb-2 text-1 font-bold uppercase text-foreground">
              {t('allYourAssets')}
            </p>
            <h1
              className="text-7 leading-tight"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('oneWallet')}
            </h1>
          </header>
          <MyWalletDashboard lang={lang} section="wallet" />
        </div>
      </div>
      <Dialog
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeToWallet();
          else setSheetOpen(true);
        }}
      >
        <DialogContent
          hideCloseButton={false}
          overlayClassName="bg-black/45 backdrop-blur-[2px]"
          className={cn(
            /* Bottom sheet — override centered Dialog defaults (same pattern as chat overflow). */
            'left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0',
            'max-h-[min(92dvh,720px)] gap-0 overflow-hidden rounded-t-2xl border-border p-0',
            'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            'bg-background font-sans text-foreground shadow-lg',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'duration-300',
          )}
        >
          <div
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            aria-hidden
          />
          <DialogHeader className="gap-1 border-b border-border px-5 pb-3 pt-2 text-left sm:text-left">
            <div className="flex items-start justify-between gap-3 pr-8">
              <DialogTitle
                className="min-w-0 text-5 font-medium tracking-[-0.03em]"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {title}
              </DialogTitle>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 pt-1 text-1 text-neutral-11 hover:text-foreground"
                onClick={closeToWallet}
              >
                <ChevronLeftIcon className="size-4 shrink-0" aria-hidden />
                {backLabel}
              </button>
            </div>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[calc(min(92dvh,720px)-5.5rem)] flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
