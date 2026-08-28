'use strict';

const http = require('http');
const crypto = require('crypto');
const { renderError } = require('../errors');

/**
 * Servidor loopback efêmero/tokenizado que serve apenas os recursos do job.
 * Não escuta interfaces públicas (bind em 127.0.0.1).
 */

/**
 * Cria e inicia um servidor loopback em 127.0.0.1 com porta efêmera.
 * @param {object} options { html, token }
 * @returns {Promise<{ server, url, close }>}
 */
function startLoopback({ html, token } = {}) {
  return new Promise((resolve, reject) => {
    const t = token || crypto.randomBytes(16).toString('hex');
    const server = http.createServer((req, res) => {
      // Apenas o path tokenizado é servido; qualquer outro é 404.
      if (req.url === `/${t}`) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.on('error', (err) => {
      reject(renderError(`Falha ao iniciar servidor loopback: ${err.message}`, { cause: err }));
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/${t}`;
      resolve({
        server,
        url,
        token: t,
        close: () => new Promise((res) => {
          // O Chromium mantém conexões HTTP keep-alive abertas após page.pdf().
          // Sem forçar o encerramento, server.close() nunca dispara o callback e
          // o pipeline trava (hang). Fechamos conexões ativas e ociosas e ainda
          // temos um guard de segurança para nunca travar.
          server.close(() => res());
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
          const guard = setTimeout(() => res(), 2000);
          guard.unref?.();
        }),
      });
    });
  });
}

module.exports = { startLoopback };
