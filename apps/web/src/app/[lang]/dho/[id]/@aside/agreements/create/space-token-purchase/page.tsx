import {
  SidePanel,
  CreateProposalTokenBackingVaultForm,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getAllSpaces } from '@hypha-platform/core/server';
import { findAllPeopleWithoutPagination } from '@hypha-platform/core/server';
import { Person, Space } from '@hypha-platform/core/client';
import { Plugin } from '../../../../_components/plugins';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/**
 * Token purchase / backing vault proposal (same flow as Settings → Token backing vault).
 * Route alias for deep links such as …/agreements/create/space-token-purchase.
 */
export default async function SpaceTokenPurchaseAgreementPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const { id: spaceId, web3SpaceId, slug } = spaceFromDb;

  const successfulUrl = getDhoPathAgreements(lang, id);
  const backUrl = `${successfulUrl}${PATH_SELECT_CREATE_ACTION}`;

  let spaces: Space[] = [];
  const people: Person[] = await findAllPeopleWithoutPagination({ db });
  const filteredPeople = people.filter(
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
    <SidePanel>
      <CreateProposalTokenBackingVaultForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        closeUrl={successfulUrl}
        plugin={
          <Plugin
            name="token-backing-vault"
            spaceSlug={slug}
            spaces={filteredSpaces}
            members={filteredPeople}
          />
        }
      />
    </SidePanel>
  );
}
