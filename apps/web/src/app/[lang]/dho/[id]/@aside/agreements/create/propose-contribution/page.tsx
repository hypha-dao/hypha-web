import {
  CreateProposeAContributionForm,
  SidePanel,
  type BridgeInitialValues,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { Plugin } from '../../../../_components/plugins';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<{
    bridgeKey?: string;
    title?: string;
    description?: string;
    recipient?: string;
    payouts?: string;
    attachments?: string;
    leadImage?: string;
  }>;
};

/**
 * Defensively parse a JSON-encoded URL searchParam. Malformed JSON returns
 * undefined so the form just degrades to "blank field" instead of crashing.
 */
function safeJsonParse<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export default async function CreateProposeAContributionPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const sp = await searchParams;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  // Bridge pre-fill data set by external integrations (e.g. ReGen Civics
  // quest submission). Only the presence of *any* user-visible field triggers
  // the prefill path so direct navigation still works as before.
  const hasBridgeFields = Boolean(
    sp.title ||
      sp.description ||
      sp.leadImage ||
      sp.recipient ||
      sp.payouts ||
      sp.attachments,
  );

  const initialValues: BridgeInitialValues | undefined = hasBridgeFields
    ? {
        title: sp.title,
        description: sp.description,
        leadImage: sp.leadImage,
        recipient: sp.recipient,
        attachments: safeJsonParse<BridgeInitialValues['attachments']>(
          sp.attachments,
        ),
        payouts: safeJsonParse<BridgeInitialValues['payouts']>(sp.payouts),
      }
    : undefined;

  return (
    <SidePanel>
      <CreateProposeAContributionForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_CREATE_ACTION}`}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={<Plugin spaceSlug={spaceSlug} name="propose-contribution" />}
        initialValues={initialValues}
        bridgeKey={sp.bridgeKey}
      />
    </SidePanel>
  );
}
