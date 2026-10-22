'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  FileText,
  Flame,
  Landmark,
  Layers,
  Lightbulb,
  Megaphone,
  Receipt,
  TriangleAlert,
  Video,
} from 'lucide-react';
import { EXCHANGE_SIGNAL_CAPITALS_KEY } from './exchange-draft-keys';
import { useTranslations } from 'next-intl';
import { AddAttachment, Button } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  NETWORK_FIELD_KINDS,
  useAttachmentUpload,
  useJwt,
  type CapitalKey,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { WalletFlowLabel } from '../common/wallet-flow-card';
import { CAPITAL_MARK } from './capital-marks';
import {
  appendIndicativePayoutParams,
  LinkedTreasuryAmountField,
  type LinkedTreasuryPayout,
} from './linked-treasury-amount';
import { MemberSpaceSelect } from './member-space-select';
import { useMemberNamedSpaces } from './use-member-named-spaces';
import {
  SIGNAL_DOCUMENT_ACCEPT,
  SIGNAL_DOCUMENT_LIMIT,
  SIGNAL_IMAGE_ACCEPT,
  SIGNAL_IMAGE_LIMIT,
  SIGNAL_MEDIA_MAX_BYTES,
  uploadSignalFiles,
  writeSignalCreateMedia,
} from '../coherence/utils/signal-media';

function typeLabel(
  type: NetworkFieldSignalKind,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  if (type === 'Need') return t('filterNeed');
  if (type === 'Resource') return t('filterResource');
  if (type === 'Opportunity') return t('filterOpportunity');
  if (type === 'Risk') return t('filterRisk');
  if (type === 'Tension') return t('filterTension');
  if (type === 'Insight') return t('filterInsight');
  if (type === 'Action') return t('filterAction');
  return t('filterImpact');
}

function startsWithVowel(label: string) {
  return /^[aeiou]/i.test(label.trim());
}

function shareHeading(
  kind: NetworkFieldSignalKind | null,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  if (!kind) return t('shareExchangeSignal');
  const label = typeLabel(kind, t);
  return startsWithVowel(label)
    ? t('shareExchangeTitleAn', { type: label })
    : t('shareExchangeTitle', { type: label });
}

function TypeIcon({ type }: { type: NetworkFieldSignalKind }) {
  const className = 'size-4 shrink-0';
  if (type === 'Need') return <Megaphone className={className} aria-hidden />;
  if (type === 'Resource') return <Layers className={className} aria-hidden />;
  if (type === 'Opportunity') {
    return <ArrowUpRight className={className} aria-hidden />;
  }
  if (type === 'Insight')
    return <Lightbulb className={className} aria-hidden />;
  if (type === 'Tension') return <Flame className={className} aria-hidden />;
  if (type === 'Risk') {
    return <TriangleAlert className={className} aria-hidden />;
  }
  if (type === 'Action') return <Receipt className={className} aria-hidden />;
  return <BookOpen className={className} aria-hidden />;
}

/**
 * Compact create tile for the reciprocal exchange rail. Collects the fields
 * the create-signal form needs, then opens that form with them prefilled and
 * share-with-network already on.
 */
export function NetworkExchangeShareCard({
  lang,
  type,
  preferredSlug,
}: {
  lang: Locale;
  /** Set when exactly one signal type is filtered. Otherwise the form asks. */
  type: NetworkFieldSignalKind | null;
  preferredSlug?: string;
}) {
  const t = useTranslations('NetworkExchange');
  const tSignals = useTranslations('CoherenceTab');
  const router = useRouter();
  const { jwt } = useJwt();
  const { upload: uploadSignalMedia } = useAttachmentUpload({
    authorizationToken: jwt ?? undefined,
  });
  const touched = useRef(false);
  const spaces = useMemberNamedSpaces();
  const [spaceSlug, setSpaceSlug] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [capitals, setCapitals] = useState<CapitalKey[]>([]);
  const [payouts, setPayouts] = useState<LinkedTreasuryPayout[]>([
    { amount: '', token: '' },
  ]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [mediaKind, setMediaKind] = useState<'images' | 'video' | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [chosenType, setChosenType] = useState<NetworkFieldSignalKind | null>(
    null,
  );
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lockedType = (NETWORK_FIELD_KINDS as readonly string[]).includes(
    type ?? '',
  )
    ? type
    : null;
  const kind = lockedType ?? chosenType;

  useEffect(() => {
    setChosenType(null);
  }, [lockedType]);

  useEffect(() => {
    if (touched.current) return;
    if (preferredSlug && spaces.some((space) => space.slug === preferredSlug)) {
      setSpaceSlug(preferredSlug);
      return;
    }
    setSpaceSlug((current) => current || spaces[0]?.slug || '');
  }, [preferredSlug, spaces]);

  const toggleCapital = (key: CapitalKey) => {
    setCapitals((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const share = async () => {
    const body = text.trim();
    const headline = title.trim() || body.slice(0, 50);
    const video = videoUrl.trim();
    if (
      !kind ||
      !spaceSlug ||
      !/^[a-z0-9_-]{1,80}$/i.test(spaceSlug) ||
      !body
    ) {
      return;
    }
    if (mediaKind === 'video' && video && !/^https?:\/\//i.test(video)) {
      setNote(tSignals('signalFormVideoHint'));
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      const uploadedImages =
        mediaKind === 'images'
          ? await uploadSignalFiles(images, uploadSignalMedia)
          : [];
      const uploadedDocuments = await uploadSignalFiles(
        documents,
        uploadSignalMedia,
      );
      const linkedVideo =
        mediaKind === 'video' && /^https?:\/\//i.test(video)
          ? video.slice(0, 2000)
          : '';
      writeSignalCreateMedia({
        images: uploadedImages,
        documents: uploadedDocuments,
        ...(linkedVideo ? { videoUrl: linkedVideo } : {}),
      });
      const params = new URLSearchParams();
      params.set('type', kind);
      params.set('sharedWithNetwork', '1');
      params.set('title', headline.slice(0, 50));
      params.set('description', body.slice(0, 4000));
      if (linkedVideo) params.set('video', linkedVideo);
      appendIndicativePayoutParams(params, payouts);
      if (capitals.length > 0 && typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          EXCHANGE_SIGNAL_CAPITALS_KEY,
          JSON.stringify(capitals),
        );
      }
      router.push(
        `/${lang}/dho/${spaceSlug}/coherence/new-signal?${params.toString()}`,
      );
    } catch {
      setNote(tSignals('signalFormUploadFailed'));
      setSaving(false);
    }
  };

  const kindLabel = kind ? typeLabel(kind, t) : '';

  return (
    <section className="min-w-0 border border-border bg-background">
      <header className="border-b border-border px-3 py-2.5">
        <h2
          className="text-3 leading-tight font-medium tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {shareHeading(kind, t)}
        </h2>
      </header>
      <div className="flex flex-col gap-2.5 px-3 py-3">
        {lockedType ? null : (
          <div className="flex flex-col gap-1.5">
            <WalletFlowLabel>{t('chooseSignalType')}</WalletFlowLabel>
            <div
              className="grid grid-cols-2 gap-1"
              role="group"
              aria-label={t('chooseSignalType')}
            >
              {NETWORK_FIELD_KINDS.map((option) => {
                const selected = kind === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChosenType(option)}
                    className={cn(
                      'inline-flex items-center gap-1 border px-1.5 py-1 text-left text-1 uppercase tracking-[0.06em]',
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-foreground hover:border-foreground',
                    )}
                  >
                    <TypeIcon type={option} />
                    <span className="truncate">{typeLabel(option, t)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>{t('chooseSpace')}</WalletFlowLabel>
          <MemberSpaceSelect
            spaces={spaces}
            value={spaceSlug}
            onChange={(next) => {
              touched.current = true;
              setSpaceSlug(next);
            }}
            label={t('chooseSpace')}
            emptyLabel={t('noneYet')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>{t('signalTitle')}</WalletFlowLabel>
          <input
            value={title}
            maxLength={50}
            placeholder={t('signalTitleHint')}
            aria-label={t('signalTitle')}
            onChange={(event) => setTitle(event.target.value)}
            className="h-9 w-full border border-border bg-background px-2.5 text-2 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>{t('whatHappened')}</WalletFlowLabel>
          <textarea
            value={text}
            maxLength={4000}
            rows={2}
            placeholder={
              kind
                ? t('shareExchangePrompt', { type: kindLabel })
                : t('shareExchangePromptSignal')
            }
            aria-label={
              kind
                ? t('shareExchangePrompt', { type: kindLabel })
                : t('shareExchangePromptSignal')
            }
            onChange={(event) => setText(event.target.value)}
            className="w-full resize-none border border-border bg-background px-2.5 py-2 text-2 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>{t('formOfCapital')}</WalletFlowLabel>
          <div className="flex flex-wrap gap-1">
            {CAPITALS.map((key) => (
              <button
                key={key}
                type="button"
                className={cn(
                  'inline-flex h-8 items-center border px-2 text-1',
                  capitals.includes(key)
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:bg-accent-2',
                )}
                onClick={() => toggleCapital(key)}
              >
                <span aria-hidden className="mr-1">
                  {CAPITAL_MARK[key]}
                </span>
                {t(`capitals.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            role="group"
            aria-label={`${tSignals('signalFormImage')}, ${tSignals(
              'signalFormMediaVideo',
            )}`}
            className="grid grid-cols-2 gap-1"
          >
            {(
              [
                {
                  kind: 'images' as const,
                  label: tSignals('signalFormImage'),
                  Icon: Camera,
                },
                {
                  kind: 'video' as const,
                  label: tSignals('signalFormMediaVideo'),
                  Icon: Video,
                },
              ] as const
            ).map(({ kind: option, label, Icon }) => {
              const selected = mediaKind === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMediaKind(option)}
                  className={cn(
                    'flex h-12 items-center justify-center gap-1.5 border px-2 text-1',
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:bg-neutral-2',
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {mediaKind === 'images' ? (
            <AddAttachment
              accept={SIGNAL_IMAGE_ACCEPT}
              maxFiles={SIGNAL_IMAGE_LIMIT}
              maxBytes={SIGNAL_MEDIA_MAX_BYTES}
              label={tSignals('signalFormImageHint')}
              value={images}
              onChange={setImages}
            />
          ) : null}
          {mediaKind === 'video' ? (
            <input
              type="url"
              value={videoUrl}
              placeholder="https://"
              aria-label={tSignals('signalFormVideo')}
              onChange={(event) => setVideoUrl(event.target.value)}
              className="h-9 w-full border border-border bg-background px-2.5 text-2 outline-none"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="size-3.5" aria-hidden />
              {tSignals('signalFormAttachments')}
            </span>
          </WalletFlowLabel>
          <AddAttachment
            accept={SIGNAL_DOCUMENT_ACCEPT}
            maxFiles={SIGNAL_DOCUMENT_LIMIT}
            maxBytes={SIGNAL_MEDIA_MAX_BYTES}
            label={tSignals('signalFormAttachmentsHint')}
            value={documents}
            onChange={setDocuments}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <WalletFlowLabel>
            <span className="inline-flex items-center gap-1.5">
              <Landmark className="size-3.5" aria-hidden />
              {t('linkedAmountHint')}
            </span>
          </WalletFlowLabel>
          <LinkedTreasuryAmountField
            spaceSlug={spaceSlug}
            value={payouts}
            onChange={setPayouts}
          />
        </div>

        {note ? (
          <p className="text-1 text-neutral-11" role="alert">
            {note}
          </p>
        ) : null}

        <Button
          type="button"
          disabled={!kind || !spaceSlug || !text.trim() || saving}
          onClick={() => {
            void share();
          }}
          className="h-9 w-full"
        >
          {t('share')}
        </Button>
      </div>
    </section>
  );
}
