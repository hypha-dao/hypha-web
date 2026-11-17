'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ModalStickyNavigation,
  ProposalOverlayShell,
  useActionStatus,
} from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

import { SelectCreateAction } from '@web/app/(main)/[lang]/dho/[id]/_components/select-create-action';
import { useWhiteLabelSectionHref } from '@web/components/white-label/white-label-provider';

/**
 * Client side of the create menu. The main app's menu with only the enabled
 * types; no settings button and no activation banner (both lead to flows a
 * host does not serve).
 */
export function SelectCreateOverlay() {
  const { id, lang } = useParams<{ id: string; lang: Locale }>();
  const tModalAside = useTranslations('ModalAside');
  const sectionHref = useWhiteLabelSectionHref();
  const agreement = useActionStatus('create-agreement') === 'live';
  const contribution = useActionStatus('create-contribution') === 'live';
  const allowedHrefs = [
    ...(agreement ? ['agreements/create'] : []),
    ...(contribution ? ['agreements/create/propose-contribution'] : []),
  ];
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('createProposal')}
          closeUrl={sectionHref('agreements')}
        />
        <SelectCreateAction
          lang={lang}
          daoSlug={id}
          allowedHrefs={allowedHrefs}
        />
      </div>
    </ProposalOverlayShell>
  );
}
