'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeAtomic, sha256, publishPdf } = require('../../src/pipeline/publish');

test('writeAtomic: escreve arquivo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-pub-'));
  const dest = path.join(dir, 'out.pdf');
  writeAtomic(dest, Buffer.from('%PDF-1.4'));
  assert.ok(fs.existsSync(dest));
  assert.strictEqual(fs.readFileSync(dest, 'utf8'), '%PDF-1.4');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeAtomic: não deixa temporário residual', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-pub-'));
  const dest = path.join(dir, 'out.pdf');
  writeAtomic(dest, Buffer.from('data'));
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepStrictEqual(leftovers, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('sha256: calcula hash estável', () => {
  const h1 = sha256(Buffer.from('abc'));
  const h2 = sha256(Buffer.from('abc'));
  assert.strictEqual(h1, h2);
  assert.strictEqual(h1.length, 64);
});

test('publishPdf: retorna path, hash e bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-pub-'));
  const dest = path.join(dir, 'a.pdf');
  const r = publishPdf(Buffer.from('pdf-data'), dest);
  assert.strictEqual(r.path, dest);
  assert.strictEqual(r.bytes, 8);
  assert.strictEqual(r.sha256.length, 64);
  fs.rmSync(dir, { recursive: true, force: true });
});
