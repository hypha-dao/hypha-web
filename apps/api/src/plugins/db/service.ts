import { neonConfig, Pool } from '@neondatabase/serverless';
import { WebSocket } from 'ws';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { schema } from './schema';
import {
  findAllDocumentsBySpaceId,
  findDocumentById,
  findDocumentWeb3Id,
  findTokensByAddresses,
  peopleByAddresses,
  findPersonByAuth,
  verifyAuth,
} from './query';

export class DbService {
  readonly db;

  constructor(
    private readonly authenticatedUrl: string,
    private readonly anonymousUrl: string,
    defaultUrl: string,
  ) {
    if (defaultUrl.includes('localhost')) {
      neonConfig.wsProxy = (host) => `${host}:5433/v1`;
      neonConfig.useSecureWebSocket = false;
      neonConfig.pipelineTLS = false;
      neonConfig.pipelineConnect = false;
    } else {
      neonConfig.webSocketConstructor = WebSocket;
      neonConfig.poolQueryViaFetch = true;
    }

    const pool = new Pool({ connectionString: defaultUrl });

    this.db = drizzleNeon(pool, { schema });
  }

  private getDb(authToken?: string) {
    const url = authToken ? this.authenticatedUrl : this.anonymousUrl;

    const sql = neon(url, {
      authToken,
    });

    return drizzle(sql, { schema });
  }

  public findAllDocumentsBySpaceId({
    id,
    filter,
    pagination,
  }: {
    id: number;
  } & Omit<Parameters<typeof findAllDocumentsBySpaceId>[1], 'db'>) {
    return findAllDocumentsBySpaceId(
      { id },
      { filter, pagination, db: this.db },
    );
  }

  public findDocumentById({ id }: { id: number }) {
    return findDocumentById({ id }, { db: this.db });
  }

  public findDocumentWeb3Id({ id }: { id: number }) {
    return findDocumentWeb3Id({ id }, { db: this.db });
  }

  public findTokensByAddresses({ addresses }: { addresses: `0x${string}`[] }) {
    return findTokensByAddresses({ addresses }, { db: this.db });
  }

  public peopleByAddresses({
    addresses,
    pagination,
  }: {
    addresses: `0x${string}`[];
  } & Omit<Parameters<typeof peopleByAddresses>[1], 'db'>) {
    return peopleByAddresses({ addresses }, { db: this.db, pagination });
  }

  public findPersonByAuth({ authToken }: { authToken: string }) {
    const db = this.getDb(authToken);

    return findPersonByAuth({ db });
  }

  public verifyAuth({ authToken }: { authToken: string }) {
    const db = this.getDb(authToken);

    return verifyAuth({ db });
  }
}
