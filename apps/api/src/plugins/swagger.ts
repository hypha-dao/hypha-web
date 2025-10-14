import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_PREFIX, API_VERSION } from '../constants';

export async function registerSwagger(app: FastifyInstance) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const specPath = path.join(
    currentDir,
    '..',
    '..',
    'docs',
    API_VERSION,
    'openapi.yaml',
  );
  const fallbackPath = path.join(currentDir, 'openapi.yaml');

  const openApiSpec = (() => {
    try {
      return YAML.load(specPath);
    } catch (error) {
      console.error(
        `Failed to load openapi specification from "${specPath}".`,
        `Trying fallback path "${fallbackPath}".`,
      );

      return YAML.load(fallbackPath);
    }
  })();

  // Dynamically prefix all paths with /api/v1
  openApiSpec.paths = Object.fromEntries(
    Object.entries(openApiSpec.paths).map(([key, val]) => [
      `${API_PREFIX}${key}`,
      val,
    ]),
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
