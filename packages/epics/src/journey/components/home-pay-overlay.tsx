'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';

export function HomePayOverlay({
  lang,
  open,
  onOpenChange,
}: {
  lang: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Journey');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('usefulPayTitle')}</DialogTitle>
          <DialogDescription>{t('usefulPayLead')}</DialogDescription>
        </DialogHeader>
        <Button asChild className="rounded-xl">
          <Link href={`/${lang}/my-wallet`}>{t('usefulPayCta')}</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
