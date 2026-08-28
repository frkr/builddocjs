'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { startLoopback } = require('../../src/server/loopback');

test('startLoopback: serve HTML no path tokenizado', async () => {
  const lb = await startLoopback({ html: '<h1>ok</h1>', token: 'abc123' });
  try {
    const body = await new Promise((resolve, reject) => {
      http.get(lb.url, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      }).on('error', reject);
    });
    assert.strictEqual(body, '<h1>ok</h1>');
  } finally {
    await lb.close();
  }
});

test('startLoopback: retorna 404 para path não tokenizado', async () => {
  const lb = await startLoopback({ html: 'x', token: 'tok' });
  try {
    const status = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${lb.server.address().port}/wrong`, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.strictEqual(status, 404);
  } finally {
    await lb.close();
  }
});

test('startLoopback: gera token aleatório quando não fornecido', async () => {
  const lb = await startLoopback({ html: 'x' });
  try {
    assert.ok(lb.token.length >= 16);
  } finally {
    await lb.close();
  }
});
