'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseMarkdown } = require('../../src/markdown/parse');
const { sanitizeHtmlContent } = require('../../src/html/sanitize');

test('parseMarkdown: converte headings com IDs determinísticos', () => {
  const html = parseMarkdown('# Título Principal\n\n## Subtítulo');
  assert.match(html, /<h1 id="titulo-principal">/);
  assert.match(html, /<h2 id="subtitulo">/);
});

test('parseMarkdown: converte bloco mermaid em div.mermaid', () => {
  const html = parseMarkdown('```mermaid\nflowchart LR\nA-->B\n```');
  assert.match(html, /<div class="mermaid">/);
  assert.doesNotMatch(html, /language-mermaid/);
});

test('parseMarkdown: converte bloco terminal em pre.terminal', () => {
  const html = parseMarkdown('```terminal\n$ ls\n```');
  assert.match(html, /<pre class="terminal">/);
});

test('parseMarkdown: escapa código sem executar', () => {
  const html = parseMarkdown('```js\n<script>alert(1)</script>\n```');
  assert.doesNotMatch(html, /<script>/);
  // Verifica a forma escapada (<script>) construída via fromCharCode
  // para evitar decodificação ao gravar o arquivo.
  const amp = String.fromCharCode(38); // &
  const lt = String.fromCharCode(60); // <
  const gt = String.fromCharCode(62); // >
  const escapedOpen = amp + 'lt;';
  const escapedClose = amp + 'gt;';
  assert.match(html, new RegExp(escapedOpen + 'script' + escapedClose));
  assert.doesNotMatch(html, new RegExp(lt + 'script' + gt));
});

test('sanitizeHtmlContent: remove script', () => {
  const out = sanitizeHtmlContent('<p>ok</p><script>alert(1)</script>');
  assert.doesNotMatch(out, /<script/i);
  assert.match(out, /<p>ok<\/p>/);
});

test('sanitizeHtmlContent: remove iframe/object/embed/form', () => {
  const out = sanitizeHtmlContent(
    '<iframe src="x"></iframe><object data="y"></object><embed src="z"><form></form>'
  );
  assert.doesNotMatch(out, /<iframe/i);
  assert.doesNotMatch(out, /<object/i);
  assert.doesNotMatch(out, /<embed/i);
  assert.doesNotMatch(out, /<form/i);
});

test('sanitizeHtmlContent: remove handlers on*', () => {
  const out = sanitizeHtmlContent('<img src="x" onerror="alert(1)">');
  assert.doesNotMatch(out, /onerror/i);
});

test('sanitizeHtmlContent: bloqueia javascript: em href', () => {
  const out = sanitizeHtmlContent('<a href="javascript:alert(1)">x</a>');
  assert.doesNotMatch(out, /javascript:/i);
});

test('sanitizeHtmlContent: remove style arbitrário', () => {
  const out = sanitizeHtmlContent('<p style="position:fixed">x</p>');
  assert.doesNotMatch(out, /style=/i);
});

test('sanitizeHtmlContent: remove meta refresh', () => {
  const out = sanitizeHtmlContent('<meta http-equiv="refresh" content="0;url=x">');
  assert.doesNotMatch(out, /<meta/i);
});
