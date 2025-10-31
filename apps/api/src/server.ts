// apps/api/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyEnv } from '@fastify/env';
import { registerSwagger } from '@plugins/swagger';
import web3Client from '@plugins/web3-client';
import v1Routes from '@routes/v1';
import { API_PREFIX } from './constants';
import { environment, type Environment } from '@schemas/env';

const app = Fastify();
app.register(cors);

const start = async () => {
  console.log('Booting API...');

  try {
    console.log('Adding health...');

    // health route for app runner
    app.get('/health', async () => {
      return { status: 'ok' };
    });

    console.log('Adding swagger...');
    await registerSwagger(app);

    await app.register(fastifyEnv, {
      schema: environment,
      dotenv: true,
    });

    await app.register(web3Client, {
      rpcUrl: app.getEnvs<Environment>().RPC_URL,
    });

    // Register v1 API
    app.register(v1Routes, { prefix: API_PREFIX });

    const port = parseInt(app.getEnvs<Environment>().PORT, 10);
    await app.listen({ port, host: '0.0.0.0' });

    console.log(`🚀 API ready at http://localhost:${port}${API_PREFIX}`);
  } catch (err) {
    console.error('❌ Failed to start API:', err);
    process.exit(1);
  }
};

start();
