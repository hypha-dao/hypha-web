'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AiLeftPanel } from '@hypha-platform/epics';
import { SidebarProvider } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';

type HomeSignal = {
  id: number;
  title: string;
  description: string;
  slug: string | null;
  type: string;
  leadImage: string | null;
  upvotes?: { upvoteCount?: number };
};

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalKind(type: string) {
  const text = type.replace(/[_-]+/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function safeImage(url: string | null) {
  if (!url) return null;
  if (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('/')
  ) {
    return url;
  }
  return null;
}

export function MemberSpaceHome({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('MemberMenu');
  const params = useParams<{ lang?: string }>();
  const lang = (typeof params.lang === 'string' ? params.lang : 'en') as Locale;
  const stripRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useSWR<{ data?: HomeSignal[] }>(
    `/api/v1/spaces/${encodeURIComponent(
      spaceSlug,
    )}/coherences?pageSize=12&orderBy=mostrecent`,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return { data: [] };
      return (await response.json()) as { data?: HomeSignal[] };
    },
  );
  const signals = useMemo(
    () => (data?.data ?? []).filter((signal) => signal.title?.trim()),
    [data],
  );

  const scrollStrip = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction * strip.clientWidth * 0.85,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex flex-col gap-10 px-4 py-2 sm:px-5">
      <section aria-labelledby="member-space-home-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {t('communitySignals')}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={t('previousSignals')}
              onClick={() => scrollStrip(-1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={t('nextSignals')}
              onClick={() => scrollStrip(1)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <h1
          id="member-space-home-title"
          className="text-7 text-foreground sm:text-8"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('around')}
        </h1>
        {isLoading ? (
          <div className="mt-6 flex gap-4 overflow-hidden" aria-hidden>
            <div className="h-64 w-72 shrink-0 bg-accent-3" />
            <div className="h-64 w-72 shrink-0 bg-accent-3" />
          </div>
        ) : signals.length === 0 ? (
          <p className="mt-6 max-w-md text-2 text-muted-foreground">
            {t('noSignals')}
          </p>
        ) : (
          <div
            ref={stripRef}
            className="mt-6 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {signals.map((signal) => {
              const image = safeImage(signal.leadImage);
              const href = signal.slug
                ? `/${lang}/dho/${spaceSlug}/coherence?signal=${encodeURIComponent(
                    signal.slug,
                  )}`
                : `/${lang}/dho/${spaceSlug}/coherence`;
              const votes = signal.upvotes?.upvoteCount ?? 0;
              return (
                <article
                  key={signal.id}
                  className="flex w-72 shrink-0 snap-start flex-col border border-border bg-background"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {signalKind(signal.type)}
                    </p>
                    <h2
                      className="text-3 text-foreground"
                      style={{ fontFamily: 'var(--font-family-heading)' }}
                    >
                      {signal.title}
                    </h2>
                    <p className="line-clamp-3 text-1 text-muted-foreground">
                      {plainText(signal.description)}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <span className="text-1 tabular-nums text-muted-foreground">
                        {votes}
                      </span>
                      <Link
                        href={href}
                        className="inline-flex h-8 items-center gap-1 border border-border px-3 text-1 text-foreground hover:bg-foreground/5"
                      >
                        {t('open')}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section aria-label={t('askThisSpace')} className="min-w-0">
        <SidebarProvider
          open
          className="h-auto min-h-[28rem] border border-border"
        >
          <AiLeftPanel embed="page" />
        </SidebarProvider>
      </section>
    </div>
  );
}
