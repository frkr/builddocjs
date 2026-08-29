'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveLocalAsset, inlineAssets, isWithinRoot, MAX_ASSET_BYTES } = require('../../src/assets/resolve');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-assets-'));
}

test('isWithinRoot: rejeita traversal', () => {
  const root = '/tmp/root';
  assert.ok(isWithinRoot(root, '/tmp/root/a.png'));
  assert.ok(!isWithinRoot(root, '/tmp/root/../etc/passwd'));
  assert.ok(!isWithinRoot(root, '/etc/passwd'));
});

test('resolveLocalAsset: inline PNG válido como data URI', () => {
  const dir = makeTmpDir();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  fs.writeFileSync(path.join(dir, 'a.png'), png);
  const out = resolveLocalAsset('a.png', dir, dir);
  assert.match(out, /^data:image\/png;base64,/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveLocalAsset: rejeita MIME falso', () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'fake.png'), 'not a png');
  assert.throws(() => resolveLocalAsset('fake.png', dir, dir));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveLocalAsset: rejeita traversal', () => {
  const dir = makeTmpDir();
  assert.throws(() => resolveLocalAsset('../../../../etc/passwd', dir, dir));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveLocalAsset: rejeita formato não permitido', () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'a.exe'), 'MZ');
  assert.throws(() => resolveLocalAsset('a.exe', dir, dir));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveLocalAsset: rejeita asset ausente', () => {
  const dir = makeTmpDir();
  assert.throws(() => resolveLocalAsset('missing.png', dir, dir));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('MAX_ASSET_BYTES: sem teto de megabytes', () => {
  assert.strictEqual(MAX_ASSET_BYTES, Infinity);
});

test('inlineAssets: deixa remoto/data intacto', () => {
  const html = '<img src="https://example.com/x.png"><img src="data:image/png;base64,abc">';
  const out = inlineAssets(html, '/tmp', '/tmp');
  assert.match(out, /https:\/\/example\.com/);
  assert.match(out, /data:image\/png/);
});
