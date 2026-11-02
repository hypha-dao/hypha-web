'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hypha-platform/ui';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';

/** Projects are not built yet, so the action only says so. */
export function SignalCreateProjectButton({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const tCommon = useTranslations('Common');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          colorVariant="accent"
          className={className}
          data-testid="signal-create-project"
        >
          <Sparkles className="craft-icon" aria-hidden />
          {t('createProject')}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-[min(24rem,calc(100vw-2rem))]"
        style={spaceAccentPortalStyle}
        data-space-accent-scope
      >
        <DialogHeader>
          <DialogTitle>{t('comingSoon')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('createProject')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" colorVariant="neutral">
              {tCommon('close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
