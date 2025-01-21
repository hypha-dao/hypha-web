import invariant from 'tiny-invariant';
import { graphql } from '../../gql/gql';
import { DaoListQuery } from '../../gql/graphql';

export const postsQueryDocument = graphql(/* GraphQL */ `
  query daoList(
    $order: DaoOrder
    $filter: DaoFilter
    $first: Int!
    $offset: Int!
  ) {
    queryDao(order: $order, filter: $filter, first: $first, offset: $offset) {
      docId
      details_daoName_n
      createdDate

      settings {
        settings_daoDescription_s
        settings_daoTitle_s
        settings_daoName_n
        settings_logo_s
        settings_primaryColor_s
        settings_secondaryColor_s
        settings_daoUrl_s
      }
      memberAggregate {
        count
      }
      proposalAggregate {
        count
      }
    }
  }
`);

const toDaoList = (data: DaoListQuery) => {
  return (
    data.queryDao?.map((dao) => {
      invariant(dao, 'Expected non-null DAO');
      invariant(dao.settings, 'Expected non-null DAO settings');
      invariant(dao.memberAggregate, 'Expected non-null DAO member aggregate');
      invariant(
        dao.proposalAggregate,
        'Expected non-null DAO proposal aggregate'
      );
      return {
        id: dao.docId,
        name: dao.settings[0].settings_daoName_n,
        title: dao.settings[0].settings_daoTitle_s,
        members: dao.memberAggregate.count,
        date: dao.createdDate,
        description: dao.settings[0].settings_daoDescription_s,
        proposals: dao.proposalAggregate.count,
        logo: `https://hypha.infura-ipfs.io/ipfs/${
          dao.settings[0].settings_logo_s?.split(':')[0]
        }`,
        primaryColor: dao.settings[0].settings_primaryColor_s,
        secondaryColor: dao.settings[0].settings_secondaryColor_s,
        url: dao.settings[0].settings_daoUrl_s,
      };
    }) ?? []
  );
};

export const getDaoList = async ({ token }: { token: string }) => {
  console.debug('getDaoList', { query: JSON.stringify(postsQueryDocument) });

  return fetch(process.env.GRAPHQL_URI as string, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'X-Dgraph-Accesstoken': token,
    },

    body: JSON.stringify({
      variables: {
        order: {
          desc: 'createdDate',
        },
        filter: null,
        first: 12,
        offset: 0,
      },
      query: postsQueryDocument.toString(),
    }),
  })
    .then((res) => {
      return res.json() as Promise<{ data: DaoListQuery }>;
    })
    .then((data) => {
      console.debug('getDaoList', { data });
      return toDaoList(data.data);
    });
};
