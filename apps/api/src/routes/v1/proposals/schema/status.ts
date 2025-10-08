import { Static, Type } from '@sinclair/typebox';

export const status = Type.Enum({
  active: 'active',
  past: 'past',
  all: 'all',
});

export type Status = Static<typeof status>;
