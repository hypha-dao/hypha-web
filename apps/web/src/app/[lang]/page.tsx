import { getAccessToken, getDaoList } from '@hypha-platform/graphql/rsc';
import { DaoCard } from '@hypha-platform/ui/server';
import { Card } from '@radix-ui/themes';
import Link from 'next/link';

export default async function Index() {
  const newtoken = await getAccessToken();
  const daos = await getDaoList({ token: newtoken.accessJWT });

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-4">
      {daos.map((dao) => (
        <div key={dao.name}>
          <Link href={`/dho/${dao.url}`}>
            <DaoCard
              createdDate={dao.date}
              description={dao.description}
              icon={`https://hypha.infura-ipfs.io/ipfs/${dao.logo}`}
              members={0}
              title={dao.title}
            />
          </Link>
        </div>
      ))}
    </div>
  );
}
