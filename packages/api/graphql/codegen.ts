import * as dotenv from 'dotenv';
import type { CodegenConfig } from '@graphql-codegen/cli';

dotenv.config({ path: __dirname + '/../../../.env' });

const config: CodegenConfig = {
  schema: process.env.GRAPHQL_URI,
  documents: ['./packages/api/graphql/src/**/*.ts'],
  generates: {
    // TODO: rename to generated/
    './packages/api/graphql/src/gql/': {
      preset: 'client',
      config: {
        documentMode: 'string',
      },
    },
    './packages/api/graphql/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
      },
    },
  },
};
export default config;
