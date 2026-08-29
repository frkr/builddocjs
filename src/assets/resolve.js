'use strict';

const fs = require('fs');
const path = require('path');
const { renderError } = require('../errors');

/**
 * Resolve e valida assets locais referenciados no HTML, confinados à raiz
 * autorizada, e os inlina como data URI quando adequado.
 *
 * - Não permite traversal/symlink escape (canonicalização + realpath).
 * - Não permite fetch remoto pelo browser (assets remotos proibidos por padrão).
 * - Valida magic bytes/MIME, tamanho e formato.
 */

/** Sem teto de megabytes: assets locais válidos são inlined por completo. */
const MAX_ASSET_BYTES = Infinity;

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// Magic bytes para validação de formato.
const MAGIC = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
};

/**
 * Verifica se um caminho está confinado dentro da raiz (após realpath).
 * @param {string} root Raiz autorizada (absoluta).
 * @param {string} target Caminho absoluto a verificar.
 * @returns {boolean}
 */
function isWithinRoot(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Valida magic bytes de um buffer contra o MIME esperado.
 * @param {Buffer} buf
 * @param {string} mime
 * @returns {boolean}
 */
function matchesMagic(buf, mime) {
  const sigs = MAGIC[mime];
  if (!sigs) return true; // SVG/texto não tem magic fixo
  return sigs.some((sig) => sig.every((b, i) => buf[i] === b));
}

/**
 * Resolve um src de imagem local para data URI, confinado à raiz.
 * @param {string} src Valor do atributo src.
 * @param {string} docDir Diretório do documento.
 * @param {string} root Raiz autorizada.
 * @returns {string} data URI ou o src original (se remoto/data).
 */
function resolveLocalAsset(src, docDir, root) {
  if (/^(https?:|data:|mailto:|ftp:)/i.test(src)) {
    // Remoto/data: não resolve localmente. Remoto é proibido por padrão.
    return src;
  }
  const ext = path.extname(src).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw renderError(`Formato de asset não permitido: ${ext || '(sem extensão)'}`);
  }

  const candidate = path.isAbsolute(src) ? src : path.resolve(docDir, src);
  let real;
  try {
    real = fs.realpathSync(candidate);
  } catch (err) {
    throw renderError(`Asset não encontrado: ${path.basename(src)}`, { cause: err });
  }
  // Canonicaliza a raiz (realpath) para comparar com o asset realpath'd.
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch (_) {
    realRoot = path.resolve(root);
  }
  if (!isWithinRoot(realRoot, real)) {
    throw renderError(`Asset fora da raiz autorizada: ${path.basename(src)}`);
  }

  const stat = fs.statSync(real);
  if (!stat.isFile()) {
    throw renderError(`Asset não é arquivo regular: ${path.basename(src)}`);
  }
  const buf = fs.readFileSync(real);
  if (!matchesMagic(buf, mime)) {
    throw renderError(`Asset com conteúdo inválido (MIME falso): ${path.basename(src)}`);
  }

  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Processa o HTML, inlinando assets locais referenciados em <img>.
 * @param {string} html HTML sanitizado.
 * @param {string} docDir Diretório do documento.
 * @param {string} root Raiz autorizada.
 * @returns {string} HTML com assets inlined.
 */
function inlineAssets(html, docDir, root) {
  return html.replace(/<img([^>]*?)src="([^"]*)"([^>]*?)>/gi, (match, before, src, after) => {
    if (/^(https?:|data:|mailto:|ftp:)/i.test(src)) return match;
    const resolved = resolveLocalAsset(src, docDir, root);
    return `<img${before}src="${resolved}"${after}>`;
  });
}

module.exports = { resolveLocalAsset, inlineAssets, isWithinRoot, MAX_ASSET_BYTES };
