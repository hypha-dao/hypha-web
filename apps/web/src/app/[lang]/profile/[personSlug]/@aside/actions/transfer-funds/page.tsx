import { db } from '@hypha-platform/storage-postgres';
import {
  findAllPeopleWithoutPagination,
  getAllSpaces,
} from '@hypha-platform/core/server';
import { ProfileTransferFunds } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: string; personSlug: string }>;
};

export default async function ProfileTransferFundsWrapper(props: PageProps) {
  const { lang, personSlug } = await props.params;

  const spaces = await getAllSpaces();
  const peoples = await findAllPeopleWithoutPagination({ db });

  const filteredSpaces = spaces.filter(
    (space) => space.address && space.address.trim() !== '',
  );

  const filteredPeoples = peoples.filter(
    (person) => person.address && person.address.trim() !== '',
  );

  return (
    <ProfileTransferFunds
      lang={lang}
      spaces={filteredSpaces}
      peoples={filteredPeoples}
      personSlug={personSlug}
    />
  );
}
