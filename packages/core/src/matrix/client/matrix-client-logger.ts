/**
 * matrix-js-sdk defaults internal loggers to DEBUG, which floods the browser console
 * during sync (push rules, sync queue, etc.) and makes DevTools sluggish.
 *
 * Pass this as `createClient({ logger })` so trace/debug/info/warn are silent unless
 * `NEXT_PUBLIC_MATRIX_SDK_VERBOSE=true`. Errors always reach `console.error`.
 *
 * GroupCallEventHandler uses the deprecated global matrix logger, not the per-client
 * logger — configure that separately via {@link configureMatrixGlobalLogger}.
 */
import type { Logger } from 'matrix-js-sdk/lib/logger';
import { logger as matrixGlobalLogger } from 'matrix-js-sdk/lib/logger';

const BENIGN_MATRIX_GLOBAL_WARNINGS = [
  'GroupCallEventHandler onRoomStateChanged() currently does not support multiple calls',
  'GroupCallEventHandler onRoomStateChanged() currently does not support changing type',
] as const;

let matrixGlobalLoggerConfigured = false;

function matrixSdkVerboseFromEnv(): boolean {
  if (typeof process === 'undefined') return false;
  const raw = process.env['NEXT_PUBLIC_MATRIX_SDK_VERBOSE'];
  if (raw == null || raw.trim() === '') return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Silence known benign matrix-js-sdk global warnings during long calls. */
export function configureMatrixGlobalLogger(): void {
  if (matrixGlobalLoggerConfigured) return;
  matrixGlobalLoggerConfigured = true;

  const originalWarn = matrixGlobalLogger.warn.bind(matrixGlobalLogger);
  matrixGlobalLogger.warn = (...args: unknown[]) => {
    const message = args.map((arg) => String(arg)).join(' ');
    if (
      BENIGN_MATRIX_GLOBAL_WARNINGS.some((snippet) => message.includes(snippet))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

export function createHyphaMatrixClientLogger(): Logger {
  const verbose = matrixSdkVerboseFromEnv();

  const make = (prefix: string): Logger => {
    return {
      trace: (...args: unknown[]) => {
        if (verbose) {
          if (prefix) console.trace(prefix, ...args);
          else console.trace(...args);
        }
      },
      debug: (...args: unknown[]) => {
        if (verbose) {
          if (prefix) console.debug(prefix, ...args);
          else console.debug(...args);
        }
      },
      info: (...args: unknown[]) => {
        if (verbose) {
          if (prefix) console.info(prefix, ...args);
          else console.info(...args);
        }
      },
      warn: (...args: unknown[]) => {
        if (verbose) {
          if (prefix) console.warn(prefix, ...args);
          else console.warn(...args);
        }
      },
      error: (...args: unknown[]) => {
        if (prefix) console.error(prefix, ...args);
        else console.error(...args);
      },
      getChild(namespace: string): Logger {
        const next = prefix ? `${prefix}:${namespace}` : namespace;
        return make(next);
      },
    };
  };

  return make('');
}
