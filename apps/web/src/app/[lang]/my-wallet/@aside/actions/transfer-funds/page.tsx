import { db } from '@hypha-platform/storage-postgres';
import {
  findAllPeopleWithoutPagination,
  getAllSpaces,
} from '@hypha-platform/core/server';
import { MyWalletTransferFundsClient } from '../../_components/my-wallet-action-clients';

export default async function MyWalletTransferFundsPage() {
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
    <MyWalletTransferFundsClient
      spaces={filteredSpaces}
      peoples={filteredPeoples}
    />
  );
}
