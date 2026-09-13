import type { StandardSchemaV1 } from './types';

export type ParamsValidation<P> =
  | { ok: true; value: P }
  | { ok: false; issues: string[] };

/**
 * Synchronously validate model-supplied params against a widget's schema.
 * v0 does not support async schemas (none of the widget schemas are async);
 * an async result is treated as a validation failure rather than awaited.
 */
export function validateParams<P>(
  schema: StandardSchemaV1<P>,
  value: unknown,
): ParamsValidation<P> {
  let result;
  try {
    result = schema['~standard'].validate(value);
  } catch (error) {
    return {
      ok: false,
      issues: [error instanceof Error ? error.message : 'schema threw'],
    };
  }

  if (result instanceof Promise) {
    return { ok: false, issues: ['async schema validation is not supported'] };
  }

  if (result.issues) {
    return { ok: false, issues: result.issues.map((issue) => issue.message) };
  }

  return { ok: true, value: result.value };
}
