// apps/api/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerSwagger } from './plugins/swagger';
import v1Routes from './routes/v1';
import { API_PREFIX } from './constants';

const app = Fastify();
app.register(cors);

const start = async () => {
  try {
    await registerSwagger(app);

    // Register v1 API
    app.register(v1Routes, { prefix: API_PREFIX });

    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log(`🚀 API ready at http://localhost:3001${API_PREFIX}`);
  } catch (err) {
    console.error('❌ Failed to start API:', err);
    process.exit(1);
  }
};

start();
