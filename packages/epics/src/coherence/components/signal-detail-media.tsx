'use client';

import { AttachmentList, MarkdownSuspense } from '@hypha-platform/ui';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  isImageAttachment,
  isPdfAttachment,
  resolveSignalVideo,
} from '../utils/signal-video';
import { SignalCategoryTag } from './signal-category-tag';

type SignalAttachment = { name: string; url: string };

type SignalDetailMediaProps = {
  leadImage?: string | null;
  videoUrl?: string | null;
  attachments?: SignalAttachment[] | null;
  description?: string | null;
  /** Skip the written description when the surrounding view already shows it. */
  showDescription?: boolean;
};

export function SignalDetailMedia({
  leadImage,
  videoUrl,
  attachments,
  description,
  showDescription = true,
}: SignalDetailMediaProps) {
  const t = useTranslations('CoherenceTab');
  const image = leadImage?.trim() ?? '';
  const video = resolveSignalVideo(videoUrl);
  const files = attachments ?? [];
  const previewPdf = files.find((file) => isPdfAttachment(file.url, file.name));
  const previewImage =
    !image && files.find((file) => isImageAttachment(file.url, file.name));
  const descriptionText = description?.trim() ?? '';
  const hasMedia = Boolean(
    image || video || previewPdf || previewImage || files.length,
  );
  const hasBody = hasMedia || (showDescription && descriptionText.length > 0);
  if (!hasBody) return null;

  return (
    <div className="flex flex-col gap-3">
      {image ? (
        <img src={image} alt="" className="max-h-56 w-full object-cover" />
      ) : previewImage ? (
        <img
          src={previewImage.url}
          alt={previewImage.name}
          className="max-h-56 w-full object-cover"
        />
      ) : null}
      {video?.kind === 'file' ? (
        <video src={video.src} controls className="max-h-72 w-full bg-black" />
      ) : video ? (
        <div className="relative w-full overflow-hidden bg-black pt-[56.25%]">
          <iframe
            src={video.src}
            title={t('signalFormVideo')}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      {previewPdf ? (
        <iframe
          src={previewPdf.url}
          title={previewPdf.name}
          className="h-72 w-full border border-border/70 bg-background-2"
        />
      ) : null}
      {showDescription && descriptionText ? (
        <div className="text-1 text-neutral-11">
          <MarkdownSuspense>{descriptionText}</MarkdownSuspense>
        </div>
      ) : null}
      {files.length > 0 ? (
        <AttachmentList attachments={files} label={t('signalAttachments')} />
      ) : null}
    </div>
  );
}

/** Media for an open signal thread. The written description stays in the chat. */
export function SignalThreadMedia({ slug }: { slug: string }) {
  const signalSlug = slug.trim();
  const { data } = useSWR(
    signalSlug ? ['signal-thread-media', signalSlug] : null,
    async () => getCoherenceBySlug({ slug: signalSlug }),
  );
  if (!data) return null;
  const hasMedia = Boolean(
    data.leadImage || data.videoUrl || (data.attachments?.length ?? 0) > 0,
  );
  if (!hasMedia && !data.type) return null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <SignalCategoryTag type={data.type} />
      {hasMedia ? (
        <SignalDetailMedia
          leadImage={data.leadImage}
          videoUrl={data.videoUrl}
          attachments={data.attachments}
          showDescription={false}
        />
      ) : null}
    </div>
  );
}
