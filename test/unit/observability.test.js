'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { Observability, redact } = require('../../src/observability');

test('redact: redige campos sensíveis', () => {
  const out = redact({ path: '/secret', content: '<p>x</p>', name: 'ok' });
  assert.strictEqual(out.path, '[redacted]');
  assert.strictEqual(out.content, '[redacted]');
  assert.strictEqual(out.name, 'ok');
});

test('Observability: registra eventos e métricas', () => {
  const obs = new Observability();
  obs.emit('start', { path: '/tmp/x' });
  obs.increment('docs');
  obs.increment('docs');
  obs.setMetric('pages', 3);
  const s = obs.summary();
  assert.strictEqual(s.events.length, 1);
  assert.strictEqual(s.events[0].path, '[redacted]');
  assert.strictEqual(s.metrics.docs, 2);
  assert.strictEqual(s.metrics.pages, 3);
  assert.ok(s.durationMs >= 0);
});
