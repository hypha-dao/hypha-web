'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Megaphone, Radio, Scale } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const HYPHA_TOKENOMICS_BRIEF_URL = 'https://hypha.earth/tokenomics';

type FeedbackOptionProps = {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  actionHref: string;
  onNavigate: () => void;
};

function FeedbackOption({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onNavigate,
}: FeedbackOptionProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-muted/20 p-5">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent-9/15 text-accent-11">
        {icon}
      </div>
      <h3 className="text-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-2 leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button asChild colorVariant="accent" className="mt-5 w-full">
        <Link href={actionHref} onClick={onNavigate}>
          {actionLabel}
        </Link>
      </Button>
    </div>
  );
}

export function HyphaNetworkFeedbackTrigger({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('NetworkFeedback');
  const { lang } = useParams<{ lang: string }>();
  const locale = typeof lang === 'string' ? lang : 'en';

  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className={cn('hover:bg-neutral-3', className)}
        aria-label={t('triggerAriaLabel')}
        onClick={() => setOpen(true)}
      >
        <Megaphone className="mr-1.5 size-4" aria-hidden />
        {t('triggerLabel')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5 text-left">
            <DialogTitle className="text-5 font-semibold tracking-tight">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-2 text-muted-foreground">
              {t('subtitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <FeedbackOption
              icon={<Radio className="size-5" aria-hidden />}
              title={t('community.title')}
              description={t('community.description')}
              actionLabel={t('community.action')}
              actionHref={`/${locale}/dho/hypha/coherence`}
              onNavigate={close}
            />
            <FeedbackOption
              icon={<Scale className="size-5" aria-hidden />}
              title={t('governance.title')}
              description={
                <>
                  {t('governance.description')}{' '}
                  <a
                    href={HYPHA_TOKENOMICS_BRIEF_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent-11 underline-offset-2 hover:underline"
                  >
                    {t('governance.learnMore')}
                  </a>
                </>
              }
              actionLabel={t('governance.action')}
              actionHref={`/${locale}/dho/hypha-tokenomics/ecosystem-navigation`}
              onNavigate={close}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
