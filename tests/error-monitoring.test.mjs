import assert from 'node:assert/strict';
import test from 'node:test';
import { isProductionHost, sanitizeErrorEvent } from '../src/lib/error-monitoring-config.js';

test('monitoring is enabled only on the production documentation domain', () => {
  assert.equal(isProductionHost('developer.rondo.club'), true);
  for (const host of ['localhost', 'rondo-developer.pages.dev', 'preview.rondo-developer.pages.dev', 'developer.rondo.club.example.com']) {
    assert.equal(isProductionHost(host), false);
  }
});

test('privacy filtering removes personal data while retaining diagnostic stack locations', () => {
  const secret = 'privacy-canary@example.test';
  const sanitized = sanitizeErrorEvent({
    event_id: 'test-event', release: 'rondo-developer@0.2.0', environment: 'production',
    message: secret, user: { email: secret }, request: { url: secret },
    breadcrumbs: [{ message: secret }], extra: { secret }, tags: { secret }, contexts: { secret },
    exception: { values: [{
      type: 'TypeError', value: secret,
      mechanism: { type: 'onerror', handled: false, data: { secret } },
      stacktrace: { frames: [{
        filename: `https://developer.rondo.club/_astro/client.abc.js?q=${secret}#fragment`,
        function: 'render', lineno: 42, colno: 7, in_app: true,
        vars: { secret }, pre_context: [secret], context_line: secret,
      }] },
    }] },
  });
  assert.equal(JSON.stringify(sanitized).includes(secret), false);
  assert.equal(sanitized.release, 'rondo-developer@0.2.0');
  assert.equal(sanitized.exception.values[0].value, 'Rondo developer JavaScript error');
  assert.deepEqual(sanitized.exception.values[0].stacktrace.frames[0], {
    filename: 'https://developer.rondo.club/_astro/client.abc.js',
    function: 'render', lineno: 42, colno: 7, in_app: true,
  });
});

test('unknown exception types and external URLs are redacted', () => {
  const result = sanitizeErrorEvent({ exception: { values: [{
    type: 'Sensitive user input', value: 'Private message',
    stacktrace: { frames: [{ filename: 'https://example.com/private.js' }] },
  }] } });
  assert.equal(result.exception.values[0].type, 'Error');
  assert.equal(result.exception.values[0].stacktrace.frames[0].filename, '[redacted]');
});
