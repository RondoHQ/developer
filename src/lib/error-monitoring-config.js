import packageInfo from '../../package.json' with { type: 'json' };

// Public ingestion key, not a GlitchTip management credential.
export const monitoringDsn = 'https://abeddf9aaabf4010841e75f8f89c01a2@errors.rondo.club/6';
export const monitoringRelease = `rondo-developer@${packageInfo.version}`;
export const isProductionHost = (hostname) => hostname === 'developer.rondo.club';

const errorTypes = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError']);

// Explicit allowlist: no form values, raw messages, request data, user details,
// breadcrumbs, URLs with query parameters, or source-code context leave the app.
export function sanitizeErrorEvent(event) {
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    exception: event.exception && {
      values: event.exception.values?.map((value) => ({
        type: errorTypes.has(value.type) ? value.type : 'Error',
        value: 'Rondo developer JavaScript error',
        mechanism: value.mechanism && { type: value.mechanism.type, handled: value.mechanism.handled },
        stacktrace: value.stacktrace && {
          frames: value.stacktrace.frames?.map((frame) => ({
            filename: safeFilename(frame.filename),
            function: frame.function,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  };
}

function safeFilename(filename) {
  if (!filename) return undefined;
  const clean = filename.split(/[?#]/)[0];
  if (/^https:\/\/developer\.rondo\.club\/_astro\/[\w.-]+\.js$/.test(clean)) return clean;
  if (/^[\w./-]+\.(m?js|ts)$/.test(clean) && !clean.startsWith('/')) return clean;
  return '[redacted]';
}
