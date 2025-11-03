import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { API_VERSION } from '../constants';

export async function registerSwagger(app: FastifyInstance) {
  const servers =
    process.env.NODE_ENV !== 'production'
      ? [{ url: 'http://localhost:3001', description: 'Development server' }]
      : [];

  await app.register(fastifySwagger, {
    mode: 'dynamic',
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Hypha API',
        version: '1.0.0',
      },
      servers,
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here',
      },
    },
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: `/${API_VERSION}/docs`,
    staticCSP: true,
  });
}
