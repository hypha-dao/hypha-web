'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn, stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';

/** Card-ready plain text: markdown markers and lead-image syntax removed. */
export function useSignalPlainDescription(description?: string | null): string {
  return React.useMemo(
    () =>
      stripDescription(
        stripMarkdown(description ?? '', {
          orderedListMarkers: false,
          unorderedListMarkers: false,
        }),
      ),
    [description],
  );
}

/**
 * Signal descriptions are kept off the cards so columns stay dense — this
 * button is the one-click way back to the full text from any card surface.
 */
export function SignalDescriptionButton({
  title,
  description,
  className,
  size = 'sm',
}: {
  title: string;
  description?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const tSignalCard = useTranslations('SignalCard');
  const tCommon = useTranslations('Common');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const [open, setOpen] = React.useState(false);
  const plainDescription = useSignalPlainDescription(description);

  if (!plainDescription.trim()) return null;

  const stopActivation = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className={cn(
          size === 'sm'
            ? 'h-6 w-6 min-h-6 min-w-6 max-h-6 max-w-6 p-0'
            : 'h-7 w-7 min-h-7 min-w-7 max-h-7 max-w-7 p-0',
          'shrink-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          className,
        )}
        aria-label={tSignalCard('readFullDescription')}
        title={tSignalCard('readFullDescription')}
        draggable={false}
        onMouseDown={stopActivation}
        onClick={(event) => {
          stopActivation(event);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.stopPropagation();
          }
        }}
      >
        <FileText
          className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'}
          aria-hidden
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'flex max-h-[min(560px,85dvh)] flex-col gap-0 overflow-hidden border-border/70 bg-background-2 p-0 shadow-md sm:max-w-lg',
            'border-l-[3px] border-l-[var(--space-accent)]',
          )}
          style={spaceAccentPortalStyle}
          onClick={(event) => event.stopPropagation()}
          onPointerDownOutside={(event) => event.stopPropagation()}
        >
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-6 pb-4 pt-6">
            <DialogTitle className="pr-10 text-balance text-4 font-medium leading-snug tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-1 text-muted-foreground">
              {tSignalCard('fullDescriptionDialogSubtitle')}
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              'narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5',
              '[scrollbar-gutter:stable]',
            )}
          >
            <p className="whitespace-pre-wrap text-2 leading-relaxed text-foreground">
              {plainDescription}
            </p>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="w-full sm:w-auto"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
