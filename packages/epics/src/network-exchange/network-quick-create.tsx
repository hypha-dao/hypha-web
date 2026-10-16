'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, FileText, Landmark, Radio, Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  EXCHANGE_CAPITALS_DRAFT_KEY,
  NETWORK_FIELD_KINDS,
  useAttachmentUpload,
  useJwt,
  useMe,
  type CapitalKey,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import { AddAttachment, Input } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { getLegacyCreateSpacePath } from '../common/get-path-function';
import { MemberSpaceSelect } from './member-space-select';
import {
  SIGNAL_DOCUMENT_ACCEPT,
  SIGNAL_DOCUMENT_LIMIT,
  SIGNAL_IMAGE_ACCEPT,
  SIGNAL_IMAGE_LIMIT,
  SIGNAL_MEDIA_MAX_BYTES,
  uploadSignalFiles,
  writeSignalCreateMedia,
} from '../coherence/utils/signal-media';

const DRAFT_KEY = EXCHANGE_CAPITALS_DRAFT_KEY;

const CAPITAL_MARK: Record<CapitalKey, string> = {
  financial: '◈',
  material: '▣',
  living: '✿',
  wellbeing: '♡',
  ecological: '❋',
  experiential: '◎',
  wisdom: '☼',
  social: '❀',
  creative: '✧',
  cultural: '❖',
  intellectual: '✦',
};

type Kind = 'project' | 'funder' | 'signal' | 'agreement' | 'story';
type Persona = 'member' | 'builder' | 'investor';

/** Investor is the funder. Each persona only sees the actions that fit how they show up. */
const KINDS_FOR_PERSONA: Record<Persona, readonly Kind[]> = {
  member: ['signal', 'story'],
  builder: ['project', 'signal', 'agreement', 'story'],
  investor: ['funder', 'agreement'],
};

function personaOf(value: string | null | undefined): Persona {
  if (value === 'builder' || value === 'investor') return value;
  return 'member';
}
type StoryMedia = 'photo' | 'video' | 'voice';
type MemberSpace = { slug: string; title: string };
type Party = { slug: string; offers: CapitalKey[] };

function toggle(list: CapitalKey[], key: CapitalKey): CapitalKey[] {
  return list.includes(key)
    ? list.filter((item) => item !== key)
    : [...list, key];
}

function signalKindLabel(
  t: (key: string) => string,
  option: NetworkFieldSignalKind,
) {
  if (option === 'Need') return t('filterNeed');
  if (option === 'Opportunity') return t('filterOpportunity');
  if (option === 'Risk') return t('filterRisk');
  if (option === 'Tension') return t('filterTension');
  if (option === 'Insight') return t('filterInsight');
  if (option === 'Action') return t('filterAction');
  return t('filterImpact');
}

function normalizeMemberSpaces(
  rows: readonly { slug?: string | null; title?: string | null }[],
): MemberSpace[] {
  const seen = new Set<string>();
  const next: MemberSpace[] = [];
  for (const row of rows) {
    const slug = row.slug?.trim() ?? '';
    const title = row.title?.trim() ?? '';
    if (!slug || !title || seen.has(slug)) continue;
    seen.add(slug);
    next.push({ slug, title });
  }
  return next;
}

export function NetworkQuickCreate({
  lang,
  memberSpaces,
  kinds,
}: {
  lang: Locale;
  /** Prefer the member's known spaces (e.g. home intelligence) over a second fetch. */
  memberSpaces?: readonly { slug: string; title: string }[];
  /** Limit the actions. The create page asks only for a new space. */
  kinds?: readonly Kind[];
}) {
  const t = useTranslations('NetworkExchange');
  const tSignals = useTranslations('CoherenceTab');
  const router = useRouter();
  const { jwt } = useJwt();
  const { person, isLoading: isLoadingMe } = useMe();
  const persona = personaOf(person?.primaryOrientation);
  const allowedKinds = kinds ?? KINDS_FOR_PERSONA[persona];
  const { upload: uploadSignalMedia } = useAttachmentUpload({
    authorizationToken: jwt ?? undefined,
  });
  const [kind, setKind] = useState<Kind>('project');
  const [spaces, setSpaces] = useState<MemberSpace[]>(() =>
    normalizeMemberSpaces(memberSpaces ?? []),
  );
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [spaceSlug, setSpaceSlug] = useState(
    () => normalizeMemberSpaces(memberSpaces ?? [])[0]?.slug ?? '',
  );
  const [seeks, setSeeks] = useState<CapitalKey[]>(['financial']);
  const [offers, setOffers] = useState<CapitalKey[]>(['social']);
  const [signalType, setSignalType] =
    useState<NetworkFieldSignalKind>('Insight');
  const [signalText, setSignalText] = useState('');
  const [signalImages, setSignalImages] = useState<File[]>([]);
  const [signalDocuments, setSignalDocuments] = useState<File[]>([]);
  const [linkedAmount, setLinkedAmount] = useState('');
  const [storyMedia, setStoryMedia] = useState<StoryMedia>('photo');
  const [storyTitle, setStoryTitle] = useState('');
  const [parties, setParties] = useState<Party[]>([
    { slug: '', offers: ['financial'] },
    { slug: '', offers: ['social'] },
  ]);
  const [agreementNote, setAgreementNote] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applySpaces = (next: MemberSpace[]) => {
    setSpaces(next);
    setSpaceSlug((current) =>
      current && next.some((space) => space.slug === current)
        ? current
        : next[0]?.slug || '',
    );
    setParties((current) =>
      current.map((party, index) =>
        party.slug && next.some((space) => space.slug === party.slug)
          ? party
          : { ...party, slug: next[index]?.slug ?? next[0]?.slug ?? '' },
      ),
    );
  };

  const memberSpacesKey = (memberSpaces ?? [])
    .map((space) => `${space.slug}:${space.title}`)
    .join('|');

  useEffect(() => {
    const fromProps = normalizeMemberSpaces(memberSpaces ?? []);
    if (fromProps.length > 0) {
      applySpaces(fromProps);
      return;
    }
    if (!jwt) return;
    let cancelled = false;
    void (async () => {
      const headers = { Authorization: `Bearer ${jwt}` };
      const intel = await fetch('/api/v1/people/me/intelligence', { headers });
      if (intel.ok) {
        const body = (await intel.json()) as {
          spaces?: { slug?: string; title?: string }[];
        };
        const fromIntel = normalizeMemberSpaces(body.spaces ?? []);
        if (!cancelled && fromIntel.length > 0) {
          applySpaces(fromIntel);
          return;
        }
      }
      const slug = person?.slug;
      if (!slug) return;
      const list = await fetch(`/api/v1/people/${slug}/spaces`, { headers });
      if (!list.ok) return;
      const rows = (await list.json()) as { slug?: string; title?: string }[];
      if (cancelled || !Array.isArray(rows)) return;
      applySpaces(normalizeMemberSpaces(rows));
    })();
    return () => {
      cancelled = true;
    };
    // memberSpacesKey tracks prop identity without depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [jwt, memberSpacesKey, person?.slug]);

  useEffect(() => {
    if (isLoadingMe || allowedKinds.includes(kind)) return;
    const next = allowedKinds[0];
    if (next) setKind(next);
  }, [allowedKinds, isLoadingMe, kind]);

  const chips = (
    selected: CapitalKey[],
    setSelected: (next: CapitalKey[]) => void,
  ) => (
    <div className="flex flex-wrap gap-1">
      {CAPITALS.map((key) => {
        const on = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => setSelected(toggle(selected, key))}
            className={cn(
              'border px-2 py-1 text-1',
              on
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11',
            )}
          >
            <span aria-hidden>{CAPITAL_MARK[key]} </span>
            {t(`capitals.${key}`)}
          </button>
        );
      })}
    </div>
  );

  const remember = () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name, place, seeks, offers, kind }),
    );
  };

  const saveOnSpace = async () => {
    if (!spaceSlug || !jwt) return;
    setSaving(true);
    setNote(null);
    try {
      const response = await fetch('/api/v1/network/space-capitals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spaceSlug, seeks, offers }),
      });
      const body = (await response.json()) as { saved?: boolean };
      setNote(body.saved ? t('saved') : t('saveLater'));
    } catch {
      setNote(t('saveLater'));
    } finally {
      setSaving(false);
    }
  };

  const openSignal = (type: string, title: string, amount?: string) => {
    if (!spaceSlug || !/^[a-z0-9_-]{1,80}$/i.test(spaceSlug) || !title.trim()) {
      return;
    }
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('title', title.trim().slice(0, 120));
    if (amount && /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) {
      params.set('amount', amount);
    }
    router.push(
      `/${lang}/dho/${spaceSlug}/coherence/new-signal?${params.toString()}`,
    );
  };

  const spaceSelect = (
    value: string,
    onChange: (slug: string) => void,
    exclude: string[] = [],
  ) => {
    const options = spaces.filter(
      (space) => space.slug === value || !exclude.includes(space.slug),
    );
    return (
      <MemberSpaceSelect
        spaces={options}
        value={value}
        onChange={onChange}
        label={t('chooseSpace')}
        emptyLabel={t('noneYet')}
      />
    );
  };

  const cards: {
    id: Kind;
    title: string;
    body: string;
    badge?: string;
    icon: typeof Sprout;
  }[] = [
    {
      id: 'project',
      title: t('shareProject'),
      body: t('shareProjectBody'),
      badge: t('projectKind'),
      icon: Sprout,
    },
    {
      id: 'funder',
      title: t('fundingSpace'),
      body: t('fundingSpaceBody'),
      badge: t('funderKind'),
      icon: Landmark,
    },
    {
      id: 'signal',
      title: t('createSignal'),
      body: t('createSignalBody'),
      icon: Radio,
    },
    {
      id: 'agreement',
      title: t('createAgreement'),
      body: t('createAgreementBody'),
      icon: FileText,
    },
    {
      id: 'story',
      title: t('shareStoryTitle'),
      body: t('shareStoryBody'),
      icon: Camera,
    },
  ];

  const firstParty = parties[0];
  const canPropose =
    Boolean(firstParty?.slug) &&
    /^[a-z0-9_-]{1,80}$/i.test(firstParty?.slug ?? '');
  const visibleCards = cards.filter((card) => allowedKinds.includes(card.id));

  if (isLoadingMe && !kinds) {
    return (
      <div className="@container mx-auto w-full max-w-4xl" aria-busy="true" />
    );
  }

  const showPicker = visibleCards.length > 1;

  return (
    <div
      className={cn(
        '@container grid w-full gap-4',
        kinds ? 'h-full' : 'mx-auto max-w-4xl',
      )}
    >
      {showPicker ? (
        <div className="grid gap-3 @min-[36rem]:grid-cols-2">
          {visibleCards.map((card) => (
            <CreateCard
              key={card.id}
              card={card}
              selected={kind === card.id}
              onSelect={() => setKind(card.id)}
            />
          ))}
        </div>
      ) : null}

      <section className="grid gap-4 border border-border p-4">
        {kind === 'project' || kind === 'funder' ? (
          <>
            <div>
              <h2
                className="text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {kind === 'funder' ? t('fundingSpace') : t('shareProject')}
              </h2>
              <p className="mt-2 text-2 leading-relaxed text-neutral-11">
                {kind === 'funder'
                  ? t('fundingSpaceForm')
                  : t('shareProjectForm')}
              </p>
            </div>
            {allowedKinds.includes('project') &&
            allowedKinds.includes('funder') ? (
              <div className="flex flex-wrap gap-1">
                {(['project', 'funder'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={kind === option}
                    onClick={() => setKind(option)}
                    className={cn(
                      'border px-2 py-1 text-1',
                      kind === option
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-neutral-11',
                    )}
                  >
                    {option === 'project' ? t('projectKind') : t('funderKind')}
                  </button>
                ))}
              </div>
            ) : null}
            <Input
              value={name}
              maxLength={80}
              placeholder={t('spaceName')}
              aria-label={t('spaceName')}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              value={place}
              maxLength={80}
              placeholder={t('place')}
              aria-label={t('place')}
              onChange={(event) => setPlace(event.target.value)}
            />
            <div>
              <p className="text-2 text-foreground">{t('seeks')}</p>
              <div className="mt-2">{chips(seeks, setSeeks)}</div>
            </div>
            <div>
              <p className="text-2 text-foreground">{t('offers')}</p>
              <div className="mt-2">{chips(offers, setOffers)}</div>
            </div>
            {spaces.length > 0 ? (
              <label className="grid gap-1 text-1 text-neutral-11">
                {t('attach')}
                {spaceSelect(spaceSlug, setSpaceSlug)}
              </label>
            ) : null}
            {note ? <p className="text-2 text-neutral-11">{note}</p> : null}
            {spaces.length > 0 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void saveOnSpace();
                }}
                className="h-10 border border-border text-1 uppercase tracking-[0.12em] disabled:opacity-40"
              >
                {t('saveCapitals')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                remember();
                const params = new URLSearchParams();
                if (name.trim()) params.set('name', name.trim());
                if (place.trim()) params.set('place', place.trim());
                const query = params.toString();
                router.push(
                  `${getLegacyCreateSpacePath(lang)}${
                    query ? `?${query}` : ''
                  }`,
                );
              }}
              className="h-10 border border-foreground bg-foreground text-1 uppercase tracking-[0.12em] text-background disabled:border-border disabled:bg-neutral-3 disabled:text-neutral-11"
            >
              {t('createSpace')}
            </button>
          </>
        ) : null}

        {kind === 'signal' ? (
          <>
            <div>
              <h2
                className="text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('createSignal')}
              </h2>
              <p className="mt-2 text-2 leading-relaxed text-neutral-11">
                {t('createSignalBody')}
              </p>
            </div>
            <label className="grid gap-1 text-1 text-neutral-11">
              {t('chooseSpace')}
              {spaces.length === 0 ? (
                <p className="text-2">{t('noneYet')}</p>
              ) : (
                spaceSelect(spaceSlug, setSpaceSlug)
              )}
            </label>
            <div>
              <p className="text-1 text-neutral-11">{t('signalType')}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {NETWORK_FIELD_KINDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={signalType === option}
                    onClick={() => setSignalType(option)}
                    className={cn(
                      'border px-2 py-1 text-1',
                      signalType === option
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-neutral-11',
                    )}
                  >
                    {signalKindLabel(t, option)}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={signalText}
              maxLength={200}
              rows={3}
              placeholder={t('whatHappened')}
              aria-label={t('whatHappened')}
              onChange={(event) => setSignalText(event.target.value)}
              className="w-full resize-none border border-border bg-neutral-2 p-3 text-2 outline-none"
            />
            <div>
              <p className="text-1 text-neutral-11">
                {tSignals('signalFormImage')}
              </p>
              <AddAttachment
                accept={SIGNAL_IMAGE_ACCEPT}
                maxFiles={SIGNAL_IMAGE_LIMIT}
                maxBytes={SIGNAL_MEDIA_MAX_BYTES}
                label={tSignals('signalFormImageHint')}
                value={signalImages}
                onChange={setSignalImages}
              />
            </div>
            <div>
              <p className="text-1 text-neutral-11">
                {tSignals('signalFormAttachments')}
              </p>
              <AddAttachment
                accept={SIGNAL_DOCUMENT_ACCEPT}
                maxFiles={SIGNAL_DOCUMENT_LIMIT}
                maxBytes={SIGNAL_MEDIA_MAX_BYTES}
                label={tSignals('signalFormAttachmentsHint')}
                value={signalDocuments}
                onChange={setSignalDocuments}
              />
            </div>
            <label className="grid gap-1 text-1 text-neutral-11">
              {t('linkedAmountHint')}
              <Input
                value={linkedAmount}
                inputMode="decimal"
                maxLength={12}
                onChange={(event) => setLinkedAmount(event.target.value)}
              />
            </label>
            {note ? (
              <p className="text-2 text-neutral-11" role="alert">
                {note}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!spaceSlug || !signalText.trim() || saving}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setNote(null);
                  try {
                    const images = await uploadSignalFiles(
                      signalImages,
                      uploadSignalMedia,
                    );
                    const documents = await uploadSignalFiles(
                      signalDocuments,
                      uploadSignalMedia,
                    );
                    writeSignalCreateMedia({ images, documents });
                    openSignal(signalType, signalText, linkedAmount);
                  } catch {
                    setNote(tSignals('signalFormUploadFailed'));
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
              className="h-10 border border-foreground bg-foreground text-1 uppercase tracking-[0.12em] text-background disabled:border-border disabled:bg-neutral-3 disabled:text-neutral-11"
            >
              {t('share')}
            </button>
          </>
        ) : null}

        {kind === 'agreement' ? (
          <>
            <div>
              <h2
                className="text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('createAgreement')}
              </h2>
              <p className="mt-2 text-2 leading-relaxed text-neutral-11">
                {t('createAgreementBody')}
              </p>
            </div>
            {spaces.length < 2 ? (
              <p className="text-2 text-neutral-11">{t('needTwoSpaces')}</p>
            ) : (
              parties.map((party, index) => (
                <div key={`${party.slug}-${index}`} className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    {spaceSelect(
                      party.slug,
                      (slug) =>
                        setParties((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, slug } : item,
                          ),
                        ),
                      parties
                        .filter((_, itemIndex) => itemIndex !== index)
                        .map((item) => item.slug),
                    )}
                    {index > 1 ? (
                      <button
                        type="button"
                        className="shrink-0 text-1 uppercase tracking-[0.12em] text-neutral-11"
                        onClick={() =>
                          setParties((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        {t('removeParty')}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-2 text-foreground">{t('offers')}</p>
                  {chips(party.offers, (next) =>
                    setParties((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, offers: next } : item,
                      ),
                    ),
                  )}
                </div>
              ))
            )}
            {spaces.length > parties.length ? (
              <button
                type="button"
                onClick={() => {
                  const taken = new Set(parties.map((party) => party.slug));
                  const next = spaces.find((space) => !taken.has(space.slug));
                  if (!next) return;
                  setParties((current) => [
                    ...current,
                    { slug: next.slug, offers: [] },
                  ]);
                }}
                className="h-10 border border-dashed border-border text-1 uppercase tracking-[0.12em] text-neutral-11"
              >
                {t('addAnotherParty')}
              </button>
            ) : null}
            <textarea
              value={agreementNote}
              maxLength={300}
              rows={2}
              placeholder={t('agreementNote')}
              aria-label={t('agreementNote')}
              onChange={(event) => setAgreementNote(event.target.value)}
              className="w-full resize-none border border-border bg-neutral-2 p-3 text-2 outline-none"
            />
            <button
              type="button"
              disabled={!canPropose}
              onClick={() => {
                if (!canPropose || !firstParty) return;
                const params = new URLSearchParams();
                if (agreementNote.trim()) {
                  params.set('note', agreementNote.trim().slice(0, 300));
                }
                const query = params.toString();
                router.push(
                  `/${lang}/dho/${
                    firstParty.slug
                  }/agreements/create/space-to-space-membership${
                    query ? `?${query}` : ''
                  }`,
                );
              }}
              className="h-10 border border-foreground bg-foreground text-1 uppercase tracking-[0.12em] text-background disabled:border-border disabled:bg-neutral-3 disabled:text-neutral-11"
            >
              {t('proposeAgreement')}
            </button>
          </>
        ) : null}

        {kind === 'story' ? (
          <>
            <div>
              <h2
                className="text-4"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('shareStoryTitle')}
              </h2>
              <p className="mt-2 text-2 leading-relaxed text-neutral-11">
                {t('shareStoryBody')}
              </p>
            </div>
            <label className="grid gap-1 text-1 text-neutral-11">
              {t('chooseSpace')}
              {spaces.length === 0 ? (
                <p className="text-2">{t('noneYet')}</p>
              ) : (
                spaceSelect(spaceSlug, setSpaceSlug)
              )}
            </label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['photo', t('storyPhoto')],
                  ['video', t('storyVideo')],
                  ['voice', t('storyVoice')],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={storyMedia === value}
                  onClick={() => setStoryMedia(value)}
                  className={cn(
                    'border px-2 py-1 text-1',
                    storyMedia === value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-neutral-11',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input
              value={storyTitle}
              maxLength={120}
              placeholder={t('storyTitle')}
              aria-label={t('storyTitle')}
              onChange={(event) => setStoryTitle(event.target.value)}
            />
            <button
              type="button"
              disabled={!spaceSlug || !storyTitle.trim()}
              onClick={() => openSignal('Impact', storyTitle)}
              className="h-10 border border-foreground bg-foreground text-1 uppercase tracking-[0.12em] text-background disabled:border-border disabled:bg-neutral-3 disabled:text-neutral-11"
            >
              {t('post')}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}

function CreateCard({
  card,
  selected,
  onSelect,
}: {
  card: {
    title: string;
    body: string;
    badge?: string;
    icon: typeof Sprout;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = card.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-28 flex-col gap-2 border p-3 text-left',
        selected ? 'border-foreground' : 'border-border',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <Icon className="size-4" aria-hidden />
        {card.badge ? (
          <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-11">
            {card.badge}
          </span>
        ) : null}
      </span>
      <span className="text-2 text-foreground">{card.title}</span>
      <span className="text-1 leading-relaxed text-neutral-11">
        {card.body}
      </span>
    </button>
  );
}
