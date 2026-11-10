import { getMigrations } from 'better-auth/db/migration';
import { createAuthServer } from '../src/auth';
import { loadAuthServerConfig } from '../src/config';

const config = loadAuthServerConfig({
  AUTH_SERVER_ENABLED: 'true',
  AUTH_SERVER_ISSUER: 'http://auth.localhost:3000',
  AUTH_SERVER_SECRET: 'x'.repeat(40),
  DEFAULT_DB_URL: 'postgresql://postgres@localhost:54329/asdev',
  NEXT_PUBLIC_PRIVY_APP_ID: 'app',
  AUTH_SERVER_RESOURCES: 'http://auth.localhost:3000/api/auth/test',
});
if (!config.enabled) throw new Error(config.reason);
const { auth, pool } = createAuthServer(config);
const { compileMigrations } = await getMigrations(auth.options);
console.log(await compileMigrations());
await pool.end();
