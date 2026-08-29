'use strict';

const zlib = require('zlib');
const { pdfError } = require('../errors');

/**
 * Validação de PDF por parser independente.
 * Verifica integridade, páginas, dimensões A4, texto e links.
 * Não aceita PDF parcial.
 */

/** Streams maiores que isto são tratados como imagens; não são concatenados. */
const MAX_INFLATE_STREAM_BYTES = 2 * 1024 * 1024;

/**
 * Descomprime streams FlateDecode pequenos para inspeção.
 * Não reconstrói o PDF inteiro em uma string (PDFs com imagens estouram o
 * limite de string do V8).
 * @param {string} s
 * @returns {string} concatenação apenas de streams pequenos já inflados
 */
function inflateStreams(s) {
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const parts = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1].length > MAX_INFLATE_STREAM_BYTES) continue;
    try {
      parts.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
    } catch (_) {
      parts.push(m[0]);
    }
  }
  return parts.join('\n');
}

function addMatchLengths(s, re) {
  let n = 0;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s)) !== null) n += m[0].length;
  return n;
}

/**
 * Analisa um buffer de PDF.
 * @param {Buffer} buf
 * @returns {{ pageCount, hasMediaBoxA4, textLen, hasAnnots, hasEOF }}
 */
function analyzePdf(buf) {
  const raw = buf.toString('latin1');
  const pageCount = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const hasMediaBoxA4 =
    /MediaBox\s*\[\s*0\s+0\s+59[0-9]\.?\d*\s+84[0-9]\.?\d*\]/.test(raw) ||
    /CropBox\s*\[\s*0\s+0\s+59[0-9]\.?\d*\s+84[0-9]\.?\d*\]/.test(raw);
  const hasAnnots = /\/Annots/.test(raw);
  const tail = raw.length > 64 ? raw.slice(raw.length - 64) : raw;
  const hasEOF = /%%EOF\s*$/.test(tail.replace(/\s+$/g, ''));

  let textLen =
    addMatchLengths(raw, /\(([^)]*)\)/g) + addMatchLengths(raw, /<([0-9A-Fa-f]{4,})>/g);

  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m[1].length > MAX_INFLATE_STREAM_BYTES) continue;
    try {
      const dec = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      textLen += addMatchLengths(dec, /\(([^)]*)\)/g);
      textLen += addMatchLengths(dec, /<([0-9A-Fa-f]{4,})>/g);
    } catch (_) { /* stream não é FlateDecode */ }
  }
  return { pageCount, hasMediaBoxA4, textLen, hasAnnots, hasEOF };
}

/**
 * Valida um PDF, lançando pdfError se inválido.
 * @param {Buffer} buf
 * @param {object} [opts] { minPages, requireA4, requireText }
 * @returns {object} análise validada
 */
function validatePdf(buf, opts = {}) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw pdfError('PDF vazio ou inválido.');
  }
  const { minPages = 1, requireA4 = true, requireText = true } = opts;
  const a = analyzePdf(buf);

  if (!a.hasEOF) throw pdfError('PDF incompleto (sem marcador EOF).');
  if (a.pageCount < minPages) {
    throw pdfError(`PDF com ${a.pageCount} páginas (esperado >= ${minPages}).`);
  }
  if (requireA4 && !a.hasMediaBoxA4) {
    throw pdfError('PDF não está em formato A4.');
  }
  if (requireText && a.textLen === 0) {
    throw pdfError('PDF sem texto extraível.');
  }
  return a;
}

module.exports = { analyzePdf, validatePdf, inflateStreams };
