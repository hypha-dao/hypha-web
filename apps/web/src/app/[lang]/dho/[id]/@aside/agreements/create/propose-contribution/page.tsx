import {
    CreateProposeAContributionForm,
    SidePanel,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../../@tab/agreements/constants';
import { Plugin } from '../../../../../_components/plugins';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug, getAllSpaces } from '@hypha-platform/core/server';
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

  // Parse bridge pre-fill data from URL search params (set by ReGen Civics bridge)
  const initialValues = (sp.title || sp.description || sp.leadImage)
      ? {
                title: sp.title,
                description: sp.description,
                leadImage: sp.leadImage,
                attachments: sp.attachments
                  ? (() => { try { return JSON.parse(sp.attachments); } catch { return undefined; } })()
                            : undefined,
                payouts: sp.payouts
                  ? (() => { try { return JSON.parse(sp.payouts); } catch { return undefined; } })()
                            : undefined,
      }
        : undefined;

  return (
        <SidePanel>
              <CreateProposeAContributionForm
                        successfulUrl={successfulUrl}
                        backUrl={`${successfulUrl}${PATH_SELECT_CREATE_ACTION}`}
                        spaceId={spaceId}
                        web3SpaceId={web3SpaceId}
                        plugin={<Plugin spaceSlug={spaceSlug} type="propose-contribution" />}
                        initialValues={initialValues}
                        bridgeKey={sp.bridgeKey}
                      />
        </SidePanel>SidePanel>
      );
}</SidePanel>
