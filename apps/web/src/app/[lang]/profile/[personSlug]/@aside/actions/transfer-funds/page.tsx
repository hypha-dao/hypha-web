import { db } from '@hypha-platform/storage-postgres';
import {
  findAllPeopleWithoutPagination,
  getAllSpaces,
} from '@hypha-platform/core/server';
import { ProfilePageParams, ProfileTransferFunds } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function ProfileTransferFundsWrapper(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const personSlug = decodeURIComponent(personSlugRaw);

  const spaces = await getAllSpaces({
    parentOnly: false,
    omitSandbox: false,
  });
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
