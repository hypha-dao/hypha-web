'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConfig } from 'wagmi';
import { useSWRConfig } from 'swr';
import {
  COHERENCE_SIGNAL_TYPES,
  revalidateCoherences,
  useCoherenceMutationsWeb2Rsc,
  useCreateAgreementOrchestrator,
  useJwt,
  useMe,
  type CoherenceSignalType,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  getOnboardingPath,
  getProposalPath,
  getSignalPath,
} from '../../common/get-path-function';

type HomeSpace = MemberIntelligence['spaces'][number];
type Kind = 'signal' | 'proposal' | 'space';

type Created = {
  kind: Kind;
  href: string;
  spaceTitle: string;
};

const FIELD_CLASS =
  'w-full border border-border bg-background px-3 py-2 text-2 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : '';
}

export function MemberHomeQuickCreate({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: HomeSpace[];
}) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const { mutate } = useSWRConfig();
  const { createCoherence } = useCoherenceMutationsWeb2Rsc(jwt);
  const { createAgreement, isPending, reset } = useCreateAgreementOrchestrator({
    authToken: jwt,
    config,
  });

  const [kind, setKind] = useState<Kind>('signal');
  const [spaceId, setSpaceId] = useState<number | null>(spaces[0]?.id ?? null);
  const [type, setType] = useState<CoherenceSignalType>('Need');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const space = useMemo(
    () => spaces.find((item) => item.id === spaceId) ?? spaces[0] ?? null,
    [spaceId, spaces],
  );
  const spaceHref = space ? `/${lang}/dho/${space.slug}/overview` : null;
  const createSpaceHref = getOnboardingPath(lang);
  const proposalNeedsChain =
    kind === 'proposal' && typeof space?.web3SpaceId !== 'number';
  const busy = isSaving || isPending;

  async function refreshHome(spaceSlug: string) {
    if (jwt) {
      await mutate(['/api/v1/people/me/intelligence', jwt]);
    }
    await revalidateCoherences(spaceSlug);
  }

  async function submit() {
    if (!space || !person?.id || busy) return;
    const nextTitle = title.trim();
    const nextBody = description.trim();
    if (!nextTitle || !nextBody) {
      setError(t('quickCreateFailed'));
      return;
    }
    if (kind === 'proposal' && typeof space.web3SpaceId !== 'number') {
      setError(t('quickCreateProposalChain'));
      return;
    }

    setError(null);
    setCreated(null);
    setIsSaving(true);
    try {
      if (kind === 'signal') {
        const signal = await createCoherence({
          creatorId: person.id,
          spaceId: space.id,
          type,
          priority: 'medium',
          title: nextTitle.slice(0, 50),
          description: nextBody.slice(0, 4000),
          archived: false,
          tags: [],
        });
        const slug = signal.slug?.trim();
        setCreated({
          kind,
          spaceTitle: space.title,
          href: slug
            ? getSignalPath(lang, space.slug, slug)
            : `/${lang}/dho/${space.slug}/coherence`,
        });
      } else {
        const proposal = await createAgreement({
          title: nextTitle.slice(0, 50),
          description: nextBody.slice(0, 4000),
          creatorId: person.id,
          spaceId: space.id,
          web3SpaceId: space.web3SpaceId ?? undefined,
          label: 'Collective Agreement',
        });
        const slug = proposal?.slug?.trim();
        setCreated({
          kind,
          spaceTitle: space.title,
          href: slug
            ? getProposalPath(lang, space.slug, slug)
            : `/${lang}/dho/${space.slug}/agreements`,
        });
        reset();
      }
      setTitle('');
      setDescription('');
      await refreshHome(space.slug);
    } catch (cause) {
      const message = messageOf(cause).toLowerCase();
      setError(
        message.includes('user rejected') || message.includes('user denied')
          ? t('quickCreateRejected')
          : t('quickCreateFailed'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col border border-border bg-background/80 p-4">
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('quickCreateTitle')}
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(['signal', 'proposal', 'space'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={cn(
              'border px-2 py-2 text-2',
              kind === option
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:bg-accent-2',
            )}
            onClick={() => {
              setKind(option);
              setError(null);
              setCreated(null);
            }}
          >
            {option === 'signal'
              ? t('quickCreateSignal')
              : option === 'proposal'
              ? t('quickCreateProposal')
              : t('quickCreateSpace')}
          </button>
        ))}
      </div>
      {kind === 'space' ? (
        <div className="mt-3 grid gap-3">
          <p className="text-2 text-neutral-11">{t('quickCreateSpaceBody')}</p>
          <Button asChild>
            <Link href={createSpaceHref}>{t('quickCreateSubmitSpace')}</Link>
          </Button>
        </div>
      ) : spaces.length === 0 ? (
        <p className="mt-3 text-2 text-neutral-11">{t('quickCreateEmpty')}</p>
      ) : (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1">
            <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
              {t('quickCreateSpace')}
            </span>
            <select
              className={FIELD_CLASS}
              value={space?.id ?? ''}
              onChange={(event) => {
                setSpaceId(Number(event.target.value));
                setError(null);
              }}
            >
              {spaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          {kind === 'signal' ? (
            <label className="grid gap-1">
              <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
                {t('quickCreateType')}
              </span>
              <select
                className={FIELD_CLASS}
                value={type}
                onChange={(event) =>
                  setType(event.target.value as CoherenceSignalType)
                }
              >
                {COHERENCE_SIGNAL_TYPES.map((signalType) => {
                  const key = `types.${signalType}` as 'types.Need';
                  return (
                    <option key={signalType} value={signalType}>
                      {tTypes.has(key) ? tTypes(key) : signalType}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}

          <label className="grid gap-1">
            <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
              {t('quickCreateName')}
            </span>
            <input
              className={FIELD_CLASS}
              value={title}
              maxLength={50}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
              {t('quickCreateBody')}
            </span>
            <textarea
              className={cn(FIELD_CLASS, 'min-h-24 resize-y')}
              value={description}
              maxLength={4000}
              required
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {proposalNeedsChain ? (
            <p className="text-2 text-neutral-11">
              {t('quickCreateProposalChain')}
            </p>
          ) : null}
          {error ? (
            <p className="text-2 text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          {created ? (
            <p className="text-2 text-neutral-12">
              {created.kind === 'signal'
                ? t('quickCreateSuccessSignal', { space: created.spaceTitle })
                : t('quickCreateSuccessProposal', {
                    space: created.spaceTitle,
                  })}{' '}
              <Link
                href={created.href}
                className="text-accent-11 underline-offset-4 hover:underline"
              >
                {t('quickCreateOpenItem')}
              </Link>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || !person?.id || proposalNeedsChain}
            >
              {busy
                ? t('quickCreateWorking')
                : kind === 'signal'
                ? t('quickCreateSubmitSignal')
                : t('quickCreateSubmitProposal')}
            </Button>
            {spaceHref ? (
              <Button asChild variant="outline" colorVariant="neutral">
                <Link href={spaceHref}>{t('quickCreateOpenSpace')}</Link>
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
