'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import type {
  NetworkHorizon,
  NetworkHorizonSignal,
  NetworkRelevanceReason,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

import { getSignalPath } from '../../common/get-path-function';

type MemberHomeHorizonProps = {
  lang: Locale;
  horizon: NetworkHorizon;
  signals: NetworkHorizonSignal[];
  isSaving?: boolean;
  error?: string | null;
  onChoose: (horizon: NetworkHorizon) => void;
};

const CHOICES: NetworkHorizon[] = ['spaces', 'network'];

function reasonKey(reason: NetworkRelevanceReason) {
  if (reason === 'location') return 'horizonReasonLocation' as const;
  if (reason === 'interest') return 'horizonReasonInterest' as const;
  return 'horizonReasonExperience' as const;
}

export function MemberHomeHorizon({
  lang,
  horizon,
  signals,
  isSaving,
  error,
  onChoose,
}: MemberHomeHorizonProps) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');

  return (
    <section
      aria-label={t('horizonLabel')}
      className="border-b border-border bg-background/90 px-4 py-4"
    >
      <p className="text-1 tracking-[0.16em] text-neutral-11 uppercase">
        {t('horizonLabel')}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {CHOICES.map((choice) => {
          const selected = choice === horizon;
          const title =
            choice === 'spaces' ? t('horizonSpaces') : t('horizonNetwork');
          const body =
            choice === 'spaces'
              ? t('horizonSpacesBody')
              : t('horizonNetworkBody');
          return (
            <button
              key={choice}
              type="button"
              disabled={isSaving}
              aria-pressed={selected}
              onClick={() => {
                if (choice !== horizon) onChoose(choice);
              }}
              className={cn(
                'border px-4 py-3 text-left transition-colors disabled:opacity-60',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground hover:border-foreground',
              )}
            >
              <span className="block text-2 font-medium">{title}</span>
              <span
                className={cn(
                  'mt-1 block text-1 leading-relaxed',
                  selected ? 'text-background/80' : 'text-neutral-11',
                )}
              >
                {body}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-3 text-2 text-error-11" role="alert">
          {error}
        </p>
      ) : null}
      {horizon === 'network' ? (
        <div className="mt-4">
          <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
            {t('horizonNetworkFeed')}
          </p>
          {signals.length === 0 ? (
            <div className="mt-2">
              <p className="text-2 text-neutral-11">
                {t('horizonNetworkEmpty')}
              </p>
              <p className="mt-1 text-1 text-neutral-11">
                {t('horizonNetworkHint')}
              </p>
            </div>
          ) : (
            <ul className="mt-2 grid gap-2">
              {signals.map((signal) => {
                const href = signal.slug
                  ? getSignalPath(lang, signal.spaceSlug, signal.slug)
                  : null;
                const typeLabel = tTypes.has(
                  `types.${signal.type}` as 'types.Need',
                )
                  ? tTypes(`types.${signal.type}` as 'types.Need')
                  : signal.type;
                const body = (
                  <>
                    <span className="block text-2 font-medium text-foreground">
                      {signal.title}
                    </span>
                    <span className="mt-1 block text-1 text-neutral-11">
                      {[typeLabel, signal.spaceTitle]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {signal.relevance.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="border border-border px-1.5 py-0.5 text-1 tracking-[0.08em] text-neutral-12 uppercase"
                        >
                          {t(reasonKey(reason))}
                        </span>
                      ))}
                    </span>
                  </>
                );
                return (
                  <li
                    key={signal.id}
                    className="border border-border bg-background"
                  >
                    {href ? (
                      <Link href={href} className="block px-3 py-3">
                        {body}
                      </Link>
                    ) : (
                      <div className="px-3 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
