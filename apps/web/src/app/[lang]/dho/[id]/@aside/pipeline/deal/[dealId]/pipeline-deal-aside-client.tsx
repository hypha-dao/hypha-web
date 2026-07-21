'use client';

import { useRouter } from 'next/navigation';
import { DealPanel, ButtonClose } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

export function PipelineDealAsideClient({
  spaceSlug,
  dealId,
  closeUrl,
}: {
  spaceSlug: string;
  dealId: number;
  closeUrl: string;
}) {
  const router = useRouter();
  const t = useTranslations('Pipeline');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-5 px-4 py-3">
        <h2 className="text-3 font-medium">{t('dealDetails')}</h2>
        <ButtonClose closeUrl={closeUrl} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DealPanel
          spaceSlug={spaceSlug}
          dealId={dealId}
          onDeleted={() => router.push(closeUrl)}
        />
      </div>
    </div>
  );
}
