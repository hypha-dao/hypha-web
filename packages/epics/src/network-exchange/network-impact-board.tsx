'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  parseCapitalKeys,
  useJwt,
  type CapitalKey,
  type NetworkFieldSignal,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  NetworkCapitalFilters,
  NetworkLiveSearch,
  NetworkSectionHeader,
} from './network-section-header';
import { NetworkRightColumn } from './network-right-cards';
import { resolveSignalVideo } from '../coherence/utils/signal-video';

type StoryFormat = 'photo' | 'video' | 'voice';
type NamedSpace = { slug: string; title: string };

const SLUG = /^[a-z0-9_-]{1,80}$/i;

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function plainText(value: string) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, open);
    const close = value.indexOf('>', open + 1);
    if (close === -1) {
      out += value.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function useMemberSpaces() {
  const { jwt } = useJwt();
  const [spaces, setSpaces] = useState<NamedSpace[]>([]);
  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    void (async () => {
      const me = await fetch('/api/v1/people/me', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!me.ok) return;
      const person = (await me.json()) as { slug?: string };
      if (!person.slug || !SLUG.test(person.slug)) return;
      const list = await fetch(`/api/v1/people/${person.slug}/spaces`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!list.ok) return;
      const rows = (await list.json()) as { slug?: string; title?: string }[];
      if (cancelled || !Array.isArray(rows)) return;
      setSpaces(
        rows.flatMap((row) =>
          row.slug && row.title && SLUG.test(row.slug)
            ? [{ slug: row.slug, title: row.title }]
            : [],
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);
  return spaces;
}

function SpaceSelect({
  spaces,
  value,
  onChange,
  label,
}: {
  spaces: NamedSpace[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 font-semibold text-foreground"
    >
      {spaces.map((space) => (
        <option key={space.slug} value={space.slug}>
          {space.title}
        </option>
      ))}
    </select>
  );
}

function storyMeta(signal: NetworkFieldSignal) {
  return [signal.creatorName, signal.spaceTitle, signal.place]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ');
}

function StoryTile({
  signal,
  featured,
  selected,
  onSelect,
  videoLabel,
  photoLabel,
}: {
  signal: NetworkFieldSignal;
  featured: boolean;
  selected: boolean;
  onSelect: () => void;
  videoLabel: string;
  photoLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const video = resolveSignalVideo(signal.videoUrl);
  const image = !failed && signal.leadImage ? signal.leadImage : null;
  const fileVideo = video?.kind === 'file' ? video.src : null;
  const showVideo = Boolean(fileVideo && (featured || !image));
  const hasVisual = Boolean(showVideo || image);
  const badge = signal.videoUrl ? videoLabel : image ? photoLabel : null;
  const byline = [signal.creatorName, signal.spaceTitle]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex h-full min-h-[180px] w-full flex-col justify-between overflow-hidden p-4 text-left',
        hasVisual ? 'text-white' : 'bg-neutral-3 text-foreground',
        selected && 'outline outline-2 -outline-offset-2 outline-foreground',
      )}
    >
      {showVideo ? (
        <video
          src={fileVideo ?? undefined}
          poster={image ?? undefined}
          autoPlay={featured}
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
      {hasVisual ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
      ) : null}
      {badge ? (
        <span
          className={cn(
            'relative self-start px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]',
            hasVisual
              ? 'bg-black/80 text-white'
              : 'bg-foreground text-background',
          )}
        >
          {badge}
        </span>
      ) : (
        <span />
      )}
      <span className="relative">
        <span
          className={cn(
            'block font-semibold leading-tight',
            featured ? 'text-3xl' : 'text-lg',
          )}
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {signal.title}
        </span>
        {byline ? (
          <span
            className={cn(
              'mt-1 block text-1',
              hasVisual ? 'text-white/80' : 'text-neutral-11',
            )}
          >
            {byline}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function StoryDialog({
  lang,
  signal,
  onClose,
  videoLabel,
  photoLabel,
  openLabel,
}: {
  lang: Locale;
  signal: NetworkFieldSignal | null;
  onClose: () => void;
  videoLabel: string;
  photoLabel: string;
  openLabel: string;
}) {
  const video = signal ? resolveSignalVideo(signal.videoUrl) : null;
  const description = signal ? plainText(signal.description) : '';
  const badge = signal?.videoUrl
    ? videoLabel
    : signal?.leadImage
    ? photoLabel
    : null;
  const href =
    signal && SLUG.test(signal.spaceSlug) && SLUG.test(signal.slug)
      ? `/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`
      : null;

  return (
    <Dialog open={Boolean(signal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0">
        {signal ? (
          <>
            <div className="relative h-64 w-full shrink-0 overflow-hidden bg-neutral-3">
              {video?.kind === 'file' ? (
                <video
                  src={video.src}
                  poster={signal.leadImage ?? undefined}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : video?.kind === 'youtube' || video?.kind === 'vimeo' ? (
                <iframe
                  src={video.src}
                  title={signal.title}
                  className="h-full w-full border-0"
                  allow="fullscreen"
                />
              ) : signal.leadImage ? (
                <img
                  src={signal.leadImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="grid gap-4 p-6">
              {badge ? (
                <span className="w-fit bg-neutral-2 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                  {badge}
                </span>
              ) : null}
              <DialogTitle
                className="text-6 leading-tight"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {signal.title}
              </DialogTitle>
              <DialogDescription className="text-1 uppercase text-neutral-11">
                {storyMeta(signal)}
              </DialogDescription>
              {description ? (
                <p className="text-2 leading-relaxed">{description}</p>
              ) : null}
              {href ? (
                <Link
                  href={href}
                  className="text-1 uppercase tracking-[0.12em]"
                >
                  {openLabel}
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PostStoryCard({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: NamedSpace[];
}) {
  const t = useTranslations('NetworkExchange');
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [format, setFormat] = useState<StoryFormat>('photo');
  const [title, setTitle] = useState('');
  const formats: { id: StoryFormat; label: string }[] = [
    { id: 'photo', label: t('storyPhotoMark') },
    { id: 'video', label: t('storyVideoMark') },
    { id: 'voice', label: t('storyVoiceMark') },
  ];

  useEffect(() => {
    if (!spaces.some((space) => space.slug === slug)) {
      setSlug(spaces[0]?.slug ?? '');
    }
  }, [slug, spaces]);

  const canPost = Boolean(slug && SLUG.test(slug) && title.trim());

  return (
    <section className="grid gap-3 border border-border bg-background p-4">
      <h2
        className="text-5"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('shareStoryTitle')}
      </h2>
      <p className="text-1 leading-relaxed text-neutral-11">
        {t('shareStoryBody')} {t('shareStoryNeverPlea')}
      </p>
      {spaces.length === 0 ? (
        <p className="text-1 text-neutral-11">{t('noneYet')}</p>
      ) : (
        <SpaceSelect
          spaces={spaces}
          value={slug}
          onChange={setSlug}
          label={t('chooseSpace')}
        />
      )}
      <p className="text-1 font-semibold">{t('storyFormat')}</p>
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label={t('storyFormat')}
      >
        {formats.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={format === option.id}
            onClick={() => setFormat(option.id)}
            className={cn(
              'px-2 py-0.5 text-[11px]',
              format === option.id
                ? 'bg-foreground text-background'
                : 'bg-neutral-2 text-neutral-11',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        maxLength={80}
        placeholder={t('storyTitle')}
        aria-label={t('storyTitle')}
        onChange={(event) => setTitle(event.target.value)}
        className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 outline-none"
      />
      <button
        type="button"
        disabled={!canPost}
        onClick={() => {
          if (!canPost) return;
          const params = new URLSearchParams();
          params.set('type', 'Impact');
          params.set('title', title.trim().slice(0, 80));
          router.push(
            `/${lang}/dho/${slug}/coherence/new-signal?${params.toString()}`,
          );
        }}
        className="w-full border border-foreground bg-foreground py-2.5 text-1 font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-50"
      >
        {t('post')}
      </button>
    </section>
  );
}

export function NetworkImpactBoard({
  lang,
  signals,
  empty,
}: {
  lang: Locale;
  signals: NetworkFieldSignal[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const memberSpaces = useMemberSpaces();
  const [query, setQuery] = useState('');
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const [openSlug, setOpenSlug] = useState('');
  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      signals.filter((signal) => {
        if (capital !== 'all' && capitalKey(signal.capital) !== capital) {
          return false;
        }
        if (!needle) return true;
        return [
          signal.title,
          signal.description,
          signal.spaceTitle,
          signal.place,
          signal.creatorName,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      }),
    [capital, needle, signals],
  );
  const openStory = signals.find((signal) => signal.slug === openSlug) ?? null;

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @4xl:flex-row @4xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <NetworkSectionHeader
            eyebrow={t('storiesFromTheField')}
            title={t('impactTitle')}
          />
          <NetworkLiveSearch
            value={query}
            onChange={setQuery}
            placeholder={t('searchPlaceholder')}
          />
          <NetworkCapitalFilters
            value={capital}
            onChange={setCapital}
            allLabel={t('allSpaces')}
            labelFor={(key) => t(`capitals.${key}`)}
          />
          {visible.length === 0 ? (
            <p className="text-2 text-neutral-11">
              {signals.length === 0 ? empty : t('needsFilterEmpty')}
            </p>
          ) : (
            <ul className="grid grid-flow-row-dense auto-rows-[180px] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((signal, index) => {
                const featured = index % 5 === 0;
                return (
                  <li
                    key={signal.slug}
                    className={cn(
                      'min-h-0',
                      featured && 'md:col-span-2 md:row-span-2',
                    )}
                  >
                    <StoryTile
                      signal={signal}
                      featured={featured}
                      selected={signal.slug === openStory?.slug}
                      onSelect={() => setOpenSlug(signal.slug)}
                      videoLabel={t('fieldVideoMark')}
                      photoLabel={t('photoMomentMark')}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <NetworkRightColumn
          lang={lang}
          variant="impact"
          spaces={[]}
          selectedSlug=""
        >
          <PostStoryCard lang={lang} spaces={memberSpaces} />
        </NetworkRightColumn>
      </div>
      <StoryDialog
        lang={lang}
        signal={openStory}
        onClose={() => setOpenSlug('')}
        videoLabel={t('fieldVideoMark')}
        photoLabel={t('photoMomentMark')}
        openLabel={t('openSignal')}
      />
    </div>
  );
}
