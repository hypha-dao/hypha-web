'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
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
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
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
  'w-full border border-border bg-background px-3 py-2 text-1 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function FieldMenu({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const label = options.find((option) => option.value === value)?.label ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            FIELD_CLASS,
            'flex items-center justify-between gap-2 text-left data-[state=open]:border-foreground data-[state=open]:[&_svg]:rotate-180',
          )}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown
            className="size-3.5 shrink-0 transition-transform"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-none border border-border bg-background p-0 shadow-none"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn(
                'gap-2 rounded-none px-3 py-2 text-1',
                selected
                  ? 'bg-foreground text-background focus:bg-foreground focus:text-background data-[highlighted]:bg-foreground data-[highlighted]:text-background [&_svg]:text-background data-[highlighted]:[&_svg]:text-background'
                  : 'text-foreground focus:bg-accent-2 data-[highlighted]:bg-accent-2 data-[highlighted]:text-foreground',
              )}
              onSelect={() => onChange(option.value)}
            >
              {selected ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">{option.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
    <section className="flex w-full min-w-0 flex-col border border-border bg-background/80 p-4">
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
              'border px-2 py-2 text-1',
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
        <div className="mt-3 grid w-full grid-cols-1 gap-3">
          <p className="text-1 text-neutral-11">{t('quickCreateSpaceBody')}</p>
          <Button asChild className="w-full text-sm">
            <Link href={createSpaceHref}>{t('quickCreateSubmitSpace')}</Link>
          </Button>
        </div>
      ) : spaces.length === 0 ? (
        <p className="mt-3 text-1 text-neutral-11">{t('quickCreateEmpty')}</p>
      ) : (
        <form
          className="mt-3 grid w-full grid-cols-1 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1">
            <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
              {t('quickCreateSpace')}
            </span>
            <FieldMenu
              value={String(space?.id ?? '')}
              options={spaces.map((item) => ({
                value: String(item.id),
                label: item.title,
              }))}
              onChange={(next) => {
                setSpaceId(Number(next));
                setError(null);
              }}
            />
          </label>

          {kind === 'signal' ? (
            <label className="grid gap-1">
              <span className="text-[11px] tracking-[0.14em] text-neutral-11 uppercase">
                {t('quickCreateType')}
              </span>
              <FieldMenu
                value={type}
                options={COHERENCE_SIGNAL_TYPES.map((signalType) => {
                  const key = `types.${signalType}` as 'types.Need';
                  return {
                    value: signalType,
                    label: tTypes.has(key) ? tTypes(key) : signalType,
                  };
                })}
                onChange={(next) => setType(next as CoherenceSignalType)}
              />
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
            <p className="text-1 text-neutral-11">
              {t('quickCreateProposalChain')}
            </p>
          ) : null}
          {error ? (
            <p className="text-1 text-error-11" role="alert">
              {error}
            </p>
          ) : null}
          {created ? (
            <p className="text-1 text-neutral-12">
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

          <Button
            type="submit"
            className="w-full text-sm"
            disabled={busy || !person?.id || proposalNeedsChain}
          >
            {busy
              ? t('quickCreateWorking')
              : kind === 'signal'
              ? t('quickCreateSubmitSignal')
              : t('quickCreateSubmitProposal')}
          </Button>
        </form>
      )}
    </section>
  );
}
