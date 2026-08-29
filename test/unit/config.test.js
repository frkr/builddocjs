'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig, resolveChromiumPath, redactConfig, DEFAULT_DENYLIST } = require('../../src/config');

test('loadConfig: aplica defaults', () => {
  const cfg = loadConfig({ root: '/tmp/x' });
  assert.strictEqual(cfg.root, '/tmp/x');
  assert.strictEqual(cfg.format, 'A4');
  assert.deepStrictEqual(cfg.margin, { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' });
  assert.deepStrictEqual(cfg.denylist, [...DEFAULT_DENYLIST]);
});

test('loadConfig: valida root obrigatório', () => {
  assert.throws(() => loadConfig({ root: '' }));
});

test('loadConfig: valida timeoutMs positivo', () => {
  assert.throws(() => loadConfig({ root: '/tmp', timeoutMs: 0 }));
});

test('loadConfig: aceita timeoutMs e hardTimeoutMs explícitos', () => {
  const cfg = loadConfig({ root: '/tmp/x', timeoutMs: 300000, hardTimeoutMs: 600000 });
  assert.strictEqual(cfg.timeoutMs, 300000);
  assert.strictEqual(cfg.hardTimeoutMs, 600000);
});

test('resolveChromiumPath: precedência CLI > env > config', () => {
  const cfg = { chromiumPath: '/config/path' };
  assert.strictEqual(resolveChromiumPath(cfg, {}, '/cli/path'), '/cli/path');
  assert.strictEqual(resolveChromiumPath(cfg, { BUILDDOC_CHROMIUM_PATH: '/env/path' }), '/env/path');
  assert.strictEqual(resolveChromiumPath(cfg, {}), '/config/path');
});

test('redactConfig: não expõe chromiumPath', () => {
  const cfg = loadConfig({ root: '/tmp/x', chromiumPath: '/secret/path' });
  const red = redactConfig(cfg);
  assert.ok(!('chromiumPath' in red));
});
