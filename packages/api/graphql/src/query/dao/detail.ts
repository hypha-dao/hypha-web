import invariant from 'tiny-invariant';
import { graphql } from '../../gql/gql';
import { ActiveDaoQuery } from '../../gql/graphql';

export const activeDao = graphql(/* GraphQL */ `
  query activeDao($regexp: String!) {
    queryDao @cascade(fields: ["settings"]) {
      docId
      details_daoName_n

      settings(filter: { settings_daoUrl_s: { regexp: $regexp } }) {
        settings_daoDescription_s
        settings_daoTitle_s
        settings_daoName_n
        settings_logo_s
        settings_primaryColor_s
        settings_secondaryColor_s
      }
    }
  }
`);

const toDaoDetail = (data: ActiveDaoQuery) => {
  const dao = data.queryDao?.[0];
  invariant(dao, 'Expected non-null DAO');
  invariant(dao.settings, 'Expected non-null DAO settings');
  invariant(dao.settings[0].settings_daoName_n, 'Expected non-null DAO name');
  invariant(dao.settings[0].settings_daoTitle_s, 'Expected non-null DAO title');
  invariant(dao.settings[0].settings_logo_s, 'Expected non-null DAO logo');
  return {
    id: dao.docId,
    name: dao.settings[0].settings_daoName_n,
    title: dao.settings[0].settings_daoTitle_s,
    description: dao.settings[0].settings_daoDescription_s,
    logo: `https://hypha.infura-ipfs.io/ipfs/${
      dao.settings[0].settings_logo_s.split(':')[0]
    }`,
    primaryColor: dao.settings[0].settings_primaryColor_s,
    secondaryColor: dao.settings[0].settings_secondaryColor_s,
  };
};

export const getDaoDetail = async ({
  token,
  daoSlug,
}: {
  token: string;
  daoSlug: string;
}) => {
  return fetch(process.env.GRAPHQL_URI as string, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'X-Dgraph-Accesstoken': token,
    },

    body: JSON.stringify({
      variables: {
        regexp: `/^${daoSlug}$/i`,
      },
      query: activeDao.toString(),
    }),
  })
    .then((res) => {
      return res.json() as Promise<{ data: ActiveDaoQuery }>;
    })
    .then((data) => toDaoDetail(data.data));
};
