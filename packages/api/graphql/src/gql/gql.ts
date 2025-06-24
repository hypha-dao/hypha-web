/* eslint-disable */
import * as types from './graphql';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
  '\n  query activeDao($regexp: String!) {\n    queryDao @cascade(fields: ["settings"]) {\n      docId\n      details_daoName_n\n\n      settings(filter: { settings_daoUrl_s: { regexp: $regexp } }) {\n        settings_daoDescription_s\n        settings_daoTitle_s\n        settings_daoName_n\n        settings_logo_s\n        settings_primaryColor_s\n        settings_secondaryColor_s\n      }\n    }\n  }\n':
    types.ActiveDaoDocument,
  '\n  query daoList(\n    $order: DaoOrder\n    $filter: DaoFilter\n    $first: Int!\n    $offset: Int!\n  ) {\n    queryDao(order: $order, filter: $filter, first: $first, offset: $offset) {\n      docId\n      details_daoName_n\n      createdDate\n\n      settings {\n        settings_daoDescription_s\n        settings_daoTitle_s\n        settings_daoName_n\n        settings_logo_s\n        settings_primaryColor_s\n        settings_secondaryColor_s\n        settings_daoUrl_s\n      }\n      memberAggregate {\n        count\n      }\n      proposalAggregate {\n        count\n      }\n    }\n  }\n':
    types.DaoListDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query activeDao($regexp: String!) {\n    queryDao @cascade(fields: ["settings"]) {\n      docId\n      details_daoName_n\n\n      settings(filter: { settings_daoUrl_s: { regexp: $regexp } }) {\n        settings_daoDescription_s\n        settings_daoTitle_s\n        settings_daoName_n\n        settings_logo_s\n        settings_primaryColor_s\n        settings_secondaryColor_s\n      }\n    }\n  }\n',
): typeof import('./graphql').ActiveDaoDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query daoList(\n    $order: DaoOrder\n    $filter: DaoFilter\n    $first: Int!\n    $offset: Int!\n  ) {\n    queryDao(order: $order, filter: $filter, first: $first, offset: $offset) {\n      docId\n      details_daoName_n\n      createdDate\n\n      settings {\n        settings_daoDescription_s\n        settings_daoTitle_s\n        settings_daoName_n\n        settings_logo_s\n        settings_primaryColor_s\n        settings_secondaryColor_s\n        settings_daoUrl_s\n      }\n      memberAggregate {\n        count\n      }\n      proposalAggregate {\n        count\n      }\n    }\n  }\n',
): typeof import('./graphql').DaoListDocument;

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
