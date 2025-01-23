import { CoreConfig } from './types';

export const defaultConfig: CoreConfig = {
  storage: {
    space: 'memory',
    agreement: 'memory',
    member: 'memory',
    comment: 'memory',
  },
  defaultPageSize: 10,
};
