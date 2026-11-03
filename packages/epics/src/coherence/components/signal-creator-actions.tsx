'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@hypha-platform/ui';
import {
  revalidateCoherences,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
} from '@hypha-platform/core/client';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { useIsSignalCreator } from '../hooks/use-is-signal-creator';

type SignalCreatorActionsProps = {
  lang: string;
  spaceSlug: string;
  slug: string;
  creatorId?: number | null;
  className?: string;
};

/**
 * Edit and Delete for the person who raised the signal. Everyone else sees
 * nothing; the server enforces the same rule. Delete is permanent.
 */
export function SignalCreatorActions({
  lang,
  spaceSlug,
  slug,
  creatorId,
  className,
}: SignalCreatorActionsProps) {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const isCreator = useIsSignalCreator(creatorId);
  const { jwt } = useJwt();
  const { deleteCoherenceBySlug, isDeletingCoherence } =
    useCoherenceMutationsWeb2Rsc(jwt);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isCreator || !slug) return null;

  const feedHref = `/${lang}/dho/${spaceSlug}/coherence`;

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteCoherenceBySlug({ slug });
    } catch (deleteError) {
      console.warn('Could not delete signal:', deleteError);
      setError(t('signalDeleteFailed'));
      return;
    }
    setConfirmOpen(false);
    router.push(feedHref);
    void revalidateCoherences(spaceSlug);
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        onClick={() =>
          router.push(`${feedHref}/edit-signal/${encodeURIComponent(slug)}`)
        }
        data-testid="signal-edit"
      >
        <Pencil className="craft-icon" aria-hidden />
        {t('signalEdit')}
      </Button>
      <Button
        type="button"
        variant="outline"
        colorVariant="error"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        data-testid="signal-delete"
      >
        <Trash2 className="craft-icon" aria-hidden />
        {t('signalDelete')}
      </Button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isDeletingCoherence) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent
          style={spaceAccentPortalStyle}
          data-space-accent-scope
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('signalDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('signalDeleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="m-0 text-1 text-error-11">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCoherence}>
              {t('signalDeleteCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              colorVariant="error"
              disabled={isDeletingCoherence}
              onClick={() => void handleDelete()}
              data-testid="signal-delete-confirm"
            >
              {isDeletingCoherence ? t('signalDeleting') : t('signalDeleteYes')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
