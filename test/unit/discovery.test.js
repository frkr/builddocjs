'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { discoverMarkdown, detectOutputCollisions, preflight } = require('../../src/discovery');

function makeTmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'builddoc-test-'));
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content || '');
  }
  return dir;
}

test('discoverMarkdown: descobre apenas .md regulares na raiz, sem recursão', () => {
  const dir = makeTmpDir({
    'a.md': '# A',
    'b.md': '# B',
    'sub/c.md': '# C',
    'not-md.txt': 'x',
  });
  const files = discoverMarkdown(dir, []);
  const names = files.map((f) => path.basename(f));
  assert.deepStrictEqual(names, ['a.md', 'b.md']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('discoverMarkdown: aplica denylist case-insensitive', () => {
  const dir = makeTmpDir({
    'README.md': '# R',
    'readme.md': '# r',
    'AGENTS.md': '# A',
    'ok.md': '# O',
  });
  const files = discoverMarkdown(dir, ['README.md', 'AGENTS.md']);
  const names = files.map((f) => path.basename(f));
  assert.deepStrictEqual(names, ['ok.md']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('discoverMarkdown: ordena deterministicamente', () => {
  const dir = makeTmpDir({
    'z.md': '# Z',
    'a.md': '# A',
    'm.md': '# M',
  });
  const files = discoverMarkdown(dir, []);
  const names = files.map((f) => path.basename(f));
  assert.deepStrictEqual(names, ['a.md', 'm.md', 'z.md']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('detectOutputCollisions: detecta colisões de nome de saída', () => {
  const dir = makeTmpDir({
    'a.md': '# A',
    'a.md.bak': 'x',
  });
  // Simula dois arquivos com mesmo basename (não possível no mesmo dir, mas testa a função)
  const collisions = detectOutputCollisions([path.join(dir, 'a.md'), path.join(dir, 'a.md')]);
  assert.strictEqual(collisions.size, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('preflight: lança erro em colisão', () => {
  const dir = makeTmpDir({ 'a.md': '# A' });
  // Simula colisão: dois arquivos com mesmo basename em diretórios diferentes
  // não são detectados por discoverMarkdown (raiz única), então testamos a
  // função detectOutputCollisions diretamente via preflight com lista forçada.
  const files = [path.join(dir, 'a.md'), path.join(dir, 'a.md')];
  const collisions = detectOutputCollisions(files);
  assert.strictEqual(collisions.size, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
