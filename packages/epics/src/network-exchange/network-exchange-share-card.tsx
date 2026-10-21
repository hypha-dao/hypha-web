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
import {
  WalletFlowCard,
  WalletFlowLabel,
  walletPresetClass,
} from '../common/wallet-flow-card';
import { CAPITAL_MARK } from './capital-marks';
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
  type: NetworkFieldSignalKind;
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
  const [amount, setAmount] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const kind = (NETWORK_FIELD_KINDS as readonly string[]).includes(type)
    ? type
    : 'Need';

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
    if (!spaceSlug || !/^[a-z0-9_-]{1,80}$/i.test(spaceSlug) || !body) return;
    setSaving(true);
    setNote(null);
    try {
      const uploadedImages = await uploadSignalFiles(images, uploadSignalMedia);
      const uploadedDocuments = await uploadSignalFiles(
        documents,
        uploadSignalMedia,
      );
      writeSignalCreateMedia({
        images: uploadedImages,
        documents: uploadedDocuments,
      });
      const params = new URLSearchParams();
      params.set('type', kind);
      params.set('sharedWithNetwork', '1');
      params.set('title', headline.slice(0, 50));
      params.set('description', body.slice(0, 4000));
      if (/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) {
        params.set('amount', amount);
      }
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

  return (
    <WalletFlowCard
      title={t('shareExchangeTitle', { type: typeLabel(kind, t) })}
    >
      <p className="flex items-start gap-2 text-1 leading-relaxed text-neutral-11">
        <TypeIcon type={kind} />
        <span>{t('shareExchangeBody', { type: typeLabel(kind, t) })}</span>
      </p>

      <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-2">
        <WalletFlowLabel>{t('signalTitle')}</WalletFlowLabel>
        <input
          value={title}
          maxLength={50}
          placeholder={t('signalTitleHint')}
          aria-label={t('signalTitle')}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 w-full border border-border bg-background px-3 text-2 outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <WalletFlowLabel>{t('whatHappened')}</WalletFlowLabel>
        <textarea
          value={text}
          maxLength={4000}
          rows={3}
          placeholder={t('shareExchangePrompt', { type: typeLabel(kind, t) })}
          aria-label={t('shareExchangePrompt', { type: typeLabel(kind, t) })}
          onChange={(event) => setText(event.target.value)}
          className="w-full resize-none border border-border bg-background p-3 text-2 outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <WalletFlowLabel>{t('formOfCapital')}</WalletFlowLabel>
        <div className="flex flex-wrap gap-2">
          {CAPITALS.map((key) => (
            <button
              key={key}
              type="button"
              className={walletPresetClass(capitals.includes(key))}
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

      <div className="flex flex-col gap-2">
        <WalletFlowLabel>
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" aria-hidden />
            {tSignals('signalFormImage')}
          </span>
        </WalletFlowLabel>
        <AddAttachment
          accept={SIGNAL_IMAGE_ACCEPT}
          maxFiles={SIGNAL_IMAGE_LIMIT}
          maxBytes={SIGNAL_MEDIA_MAX_BYTES}
          label={tSignals('signalFormImageHint')}
          value={images}
          onChange={setImages}
        />
      </div>

      <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-2">
        <WalletFlowLabel>
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="size-3.5" aria-hidden />
            {t('linkedAmountHint')}
          </span>
        </WalletFlowLabel>
        <input
          value={amount}
          inputMode="decimal"
          maxLength={12}
          placeholder="0"
          aria-label={t('linkedAmountHint')}
          onChange={(event) => setAmount(event.target.value)}
          className="h-11 w-full border border-border bg-background px-3 text-2 tabular-nums outline-none"
        />
      </div>

      {note ? (
        <p className="text-1 text-neutral-11" role="alert">
          {note}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={!spaceSlug || !text.trim() || saving}
        onClick={() => {
          void share();
        }}
        className={cn('h-11 w-full')}
      >
        {t('share')}
      </Button>
    </WalletFlowCard>
  );
}
