'use client';

import clsx from 'clsx';
import { ChevronRight, Radio, Scale, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  Separator,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const HYPHA_TOKENOMICS_BRIEF_URL = 'https://hypha.earth/tokenomics';

const profileMenuItemClass =
  'gap-2 px-2 py-2 text-2 [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-foreground';

const profileSheetItemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-2 text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type FeedbackOptionProps = {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  actionHref: string;
  onNavigate: () => void;
  /** When true, card uses router navigation so inline links can stop propagation. */
  hasInlineLink?: boolean;
};

function FeedbackOption({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onNavigate,
  hasInlineLink = false,
}: FeedbackOptionProps) {
  const router = useRouter();

  const cardClassName = clsx(
    'group flex h-full flex-col rounded-2xl border border-border/80 bg-background-2 p-5 shadow-sm ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,background-color] duration-200 ease-out md:p-6',
    'cursor-pointer hover:border-accent-9 hover:bg-background-3/70 hover:shadow-md hover:ring-accent-10/45',
    'focus-visible:border-accent-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background-2',
  );

  const cardBody = (
    <>
      <div className="flex items-start gap-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-accent-11 ring-2 ring-transparent transition-[border-color,box-shadow,--tw-ring-color,color] duration-200 group-hover:border-accent-9 group-hover:text-foreground group-hover:ring-accent-10/50 [&_svg]:shrink-0"
          aria-hidden
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-2 font-semibold leading-snug text-foreground">
            {title}
          </span>
          <span className="text-1 leading-relaxed text-muted-foreground">
            {description}
          </span>
          <span className="mt-2 text-1 font-medium text-accent-11 group-hover:underline">
            {actionLabel} →
          </span>
        </div>
      </div>
    </>
  );

  const navigate = () => {
    onNavigate();
    router.push(actionHref);
  };

  if (hasInlineLink) {
    return (
      <Card
        role="link"
        tabIndex={0}
        className={cardClassName}
        onClick={navigate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate();
          }
        }}
      >
        {cardBody}
      </Card>
    );
  }

  return (
    <Link href={actionHref} onClick={onNavigate} className="block h-full">
      <Card className={cardClassName}>{cardBody}</Card>
    </Link>
  );
}

function NetworkFeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('NetworkFeedback');
  const { lang } = useParams<{ lang: string }>();
  const locale = typeof lang === 'string' ? lang : 'en';

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden rounded-2xl border border-border/90 bg-background-2 p-0 shadow-2xl ring-1 ring-white/5 dark:ring-white/10',
          'max-h-[min(90dvh,calc(100dvh-2rem))] w-[min(768px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]',
        )}
      >
        <div className="flex max-h-[min(90dvh,calc(100dvh-2rem))] flex-col gap-6 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-4 font-semibold tracking-tight">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-2 leading-relaxed text-muted-foreground">
              {t('subtitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-2 font-semibold leading-snug text-foreground">
              {t('missionLine1')} {t('missionLine2')}
            </p>
            <p className="text-2 leading-relaxed text-muted-foreground">
              {t('missionBody')}
            </p>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FeedbackOption
            icon={<Radio className="size-[22px]" strokeWidth={1.75} />}
            title={t('community.title')}
            description={t('community.description')}
            actionLabel={t('community.action')}
            actionHref={`/${locale}/dho/hypha/coherence`}
            onNavigate={close}
          />
          <FeedbackOption
            icon={<Scale className="size-[22px]" strokeWidth={1.75} />}
            title={t('governance.title')}
            hasInlineLink
            description={
              <>
                {t('governance.description')}{' '}
                <a
                  href={HYPHA_TOKENOMICS_BRIEF_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type HyphaNetworkFeedbackTriggerProps = {
  className?: string;
  variant?: 'toolbar' | 'menu' | 'sheet';
  onNavigate?: () => void;
};

export function HyphaNetworkFeedbackTrigger({
  className,
  variant = 'toolbar',
  onNavigate,
}: HyphaNetworkFeedbackTriggerProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('NetworkFeedback');

  const openDialog = () => {
    onNavigate?.();
    setOpen(true);
  };

  const triggerIcon = (
    <Sparkles className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
  );

  let trigger: React.ReactNode;

  if (variant === 'menu') {
    trigger = (
      <DropdownMenuItem
        className={profileMenuItemClass}
        onSelect={(event) => {
          event.preventDefault();
          openDialog();
        }}
      >
        {triggerIcon}
        <span className="flex-1">{t('triggerLabel')}</span>
        <ChevronRight className="ml-auto size-4 opacity-60" aria-hidden />
      </DropdownMenuItem>
    );
  } else if (variant === 'sheet') {
    trigger = (
      <button
        type="button"
        className={cn(profileSheetItemClass, className)}
        aria-label={t('triggerAriaLabel')}
        onClick={openDialog}
      >
        <span className="text-muted-foreground">{triggerIcon}</span>
        <span className="flex-1">{t('triggerLabel')}</span>
        <ChevronRight
          className="ml-auto size-4 text-muted-foreground"
          aria-hidden
        />
      </button>
    );
  } else {
    trigger = (
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className={cn('gap-1.5 hover:bg-neutral-3', className)}
        aria-label={t('triggerAriaLabel')}
        onClick={openDialog}
      >
        {triggerIcon}
        {t('triggerLabel')}
      </Button>
    );
  }

  return (
    <>
      {trigger}
      <NetworkFeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
