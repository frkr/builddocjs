'use strict';

const zlib = require('zlib');
const { pdfError } = require('../errors');

/**
 * Validação de PDF por parser independente.
 * Verifica integridade, páginas, dimensões A4, texto e links.
 * Não aceita PDF parcial.
 */

/**
 * Descomprime streams FlateDecode para inspeção.
 * @param {string} s
 * @returns {string}
 */
function inflateStreams(s) {
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    parts.push(s.slice(last, m.index));
    try {
      const dec = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      parts.push('stream\n' + dec + '\nendstream');
    } catch (_) { parts.push(m[0]); }
    last = re.lastIndex;
  }
  parts.push(s.slice(last));
  return parts.join('');
}

/**
 * Analisa um buffer de PDF.
 * @param {Buffer} buf
 * @returns {{ pageCount, hasMediaBoxA4, textLen, hasAnnots, hasEOF }}
 */
function analyzePdf(buf) {
  const raw = buf.toString('latin1');
  const s = inflateStreams(raw);
  const pageCount = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const hasMediaBoxA4 =
    /MediaBox\s*\[\s*0\s+0\s+59[0-9]\.?\d*\s+84[0-9]\.?\d*\]/.test(s) ||
    /CropBox\s*\[\s*0\s+0\s+59[0-9]\.?\d*\s+84[0-9]\.?\d*\]/.test(s);
  const literalText = (s.match(/\(([^)]*)\)/g) || []).join(' ');
  const hexText = (s.match(/<([0-9A-Fa-f]{4,})>/g) || []).join(' ');
  const textLen = literalText.length + hexText.length;
  const hasAnnots = /\/Annots/.test(s);
  const hasEOF = /%%EOF\s*$/.test(raw.trim());
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
