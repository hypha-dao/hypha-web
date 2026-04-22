import { ProposalOverlayShell } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  findSpaceBySlug,
  getAllSpaces,
  findAllPeopleWithoutPagination,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { UpdateIssuedTokenForm } from '@hypha-platform/epics';
import { Plugin } from '../../../../_components/plugins';
import { Person, Space } from '@hypha-platform/core/client';
// >>> MAINTENANCE START — remove this import together with the early return below.
import {
  TOKEN_PROPOSAL_MAINTENANCE,
  UnderMaintenance,
} from '../_maintenance/under-maintenance';
// <<< MAINTENANCE END
type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{ hideBack?: string }>;
};

export default async function UpdateIssuedTokenPage({
  params,
  searchParams,
}: PageProps) {
  // >>> MAINTENANCE START — token contracts in flight; remove this block to re-enable.
  if (TOKEN_PROPOSAL_MAINTENANCE) {
    return (
      <ProposalOverlayShell>
        <UnderMaintenance />
      </ProposalOverlayShell>
    );
  }
  // <<< MAINTENANCE END

  const { lang, id, tab } = await params;
  const { hideBack = 'false' } = await searchParams;
  const hideBackUrl = hideBack?.toLowerCase?.() === 'true';

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang, id);
  const closeUrl = `/${lang}/dho/${id}/${tab}`;
  const backUrl = hideBackUrl
    ? undefined
    : `${closeUrl}${PATH_SELECT_SETTINGS_ACTION}`;

  let spaces = [] as Space[];
  const peoples: Person[] = await findAllPeopleWithoutPagination({ db });
  const filteredPeoples = peoples.filter(
    (person) => person.address && person.address.trim() !== '',
  );

  try {
    spaces = await getAllSpaces({
      parentOnly: false,
      omitSandbox: false,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
  }

  const filteredSpaces = spaces?.filter(
    (space) =>
      space?.address && space.address.trim() !== '' && space.id !== spaceId,
  );

  return (
    <ProposalOverlayShell>
      <UpdateIssuedTokenForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        closeUrl={closeUrl}
        backUrl={backUrl}
        plugin={
          <Plugin
            name="update-issued-token"
            spaceSlug={id}
            spaceId={spaceId}
            spaces={filteredSpaces}
            spacesForChainMapping={spaces}
            members={filteredPeoples}
          />
        }
      />
    </ProposalOverlayShell>
  );
}
