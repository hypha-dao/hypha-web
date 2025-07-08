import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import YAML from 'yamljs';
import path from 'path';
import { API_PREFIX, API_VERSION } from "../constants";

export async function registerSwagger(app: FastifyInstance) {
  const openApiSpec = YAML.load(path.resolve(process.cwd(), 'docs', API_VERSION, 'openapi.yaml'));

  // Dynamically prefix all paths with /api/v1
  openApiSpec.paths = Object.fromEntries(
    Object.entries(openApiSpec.paths).map(([key, val]) => [`${API_PREFIX}${key}`, val])
  );

  await app.register(fastifySwagger, {
    mode: 'static',
    specification: { document: openApiSpec },
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: `/${API_VERSION}/docs`,
    staticCSP: true,
  });
}