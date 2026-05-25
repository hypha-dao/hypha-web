'use client';

import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

/** Apply on `DialogContent` — scroll the whole panel when content exceeds the viewport. */
export const BANKING_DIALOG_CONTENT_CLASS = cn(
  '!block !max-h-[90vh] !overflow-y-scroll',
  'gap-0 p-0',
  '!top-[max(0.5rem,calc(var(--menu-top-height,70px)+0.5rem))] !translate-y-0',
);

export const BANKING_DIALOG_FORM_CONTENT_CLASS = BANKING_DIALOG_CONTENT_CLASS;

export const BANKING_DIALOG_HEADER_CLASS = 'px-6 pt-6 pb-2';

export const BANKING_DIALOG_BODY_CLASS = 'px-6 py-4';

export const BANKING_DIALOG_FOOTER_CLASS = 'border-t border-border px-6 py-4';

/** @deprecated Use BANKING_DIALOG_CONTENT_CLASS */
export const BANKING_DETAILS_DIALOG_CONTENT_CLASS =
  BANKING_DIALOG_CONTENT_CLASS;

/** @deprecated Use BANKING_DIALOG_BODY_CLASS */
export const BANKING_DETAILS_DIALOG_BODY_CLASS = BANKING_DIALOG_BODY_CLASS;

type BankingDialogBodyProps = {
  children: ReactNode;
  className?: string;
};

export function BankingDialogBody({
  children,
  className,
}: BankingDialogBodyProps) {
  return (
    <div className={cn(BANKING_DIALOG_BODY_CLASS, className)}>{children}</div>
  );
}
