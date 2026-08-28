'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { publishError } = require('../errors');

/**
 * Publicação atômica: escreve em arquivo temporário no mesmo filesystem e
 * renomeia (rename atômico). Nunca publica PDF parcial nem sobrescreve
 * implicitamente sem validação.
 */

/**
 * Escreve um buffer de forma atômica no destino.
 * @param {string} dest Caminho final.
 * @param {Buffer} data
 */
function writeAtomic(dest, data) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(dest)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, dest);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
    throw publishError(`Falha ao publicar ${path.basename(dest)}: ${err.message}`, { cause: err });
  }
}

/**
 * Calcula o hash SHA-256 de um buffer.
 * @param {Buffer} data
 * @returns {string}
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Publica um PDF validado de forma atômica.
 * @param {Buffer} pdf
 * @param {string} dest
 * @returns {{ path, sha256, bytes }}
 */
function publishPdf(pdf, dest) {
  writeAtomic(dest, pdf);
  return { path: dest, sha256: sha256(pdf), bytes: pdf.length };
}

module.exports = { writeAtomic, sha256, publishPdf };
