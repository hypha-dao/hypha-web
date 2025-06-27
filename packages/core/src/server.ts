import 'server-only';

import { initializeContainer } from './_container/bootstrap';

// Initialize the container with default config
initializeContainer();

// Export components
export * from './assets/server';
export * from './space/server';
export * from './space/types';
export * from './space/validation';
export * from './governance/server';
export * from './governance/types';
export * from './people/server';
export * from './people/types';
export * from './common/server';
export * from './common/types';
