'use strict';

const sanitizeHtml = require('sanitize-html');
const { renderError } = require('../errors');

/**
 * Allowlist de tags permitidas no HTML intermediário.
 * Remove scripts, handlers, forms, frames, objects, embeds, meta refresh,
 * estilos arbitrários e URLs executáveis.
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'span', 'div', 'figure', 'figcaption',
  'svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'marker', 'foreignObject',
];

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel', 'name'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  code: ['class'],
  pre: ['class'],
  div: ['class', 'id'],
  span: ['class'],
  th: ['align', 'colspan', 'rowspan'],
  td: ['align', 'colspan', 'rowspan'],
  svg: ['viewBox', 'width', 'height', 'xmlns', 'preserveAspectRatio'],
  path: ['d', 'fill', 'stroke', 'stroke-width', 'transform'],
  rect: ['x', 'y', 'width', 'height', 'fill', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r', 'fill'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
  polyline: ['points', 'fill', 'stroke'],
  polygon: ['points', 'fill', 'stroke'],
  text: ['x', 'y', 'font-family', 'font-size', 'text-anchor', 'fill'],
  tspan: ['x', 'dy', 'text-anchor'],
  g: ['transform', 'fill', 'stroke'],
  marker: ['id', 'viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient'],
  foreignObject: ['x', 'y', 'width', 'height'],
};

const ALLOWED_CLASSES = {
  div: ['mermaid', 'mermaid-container', 'table-wrapper'],
  pre: ['terminal'],
  code: [/^language-/, 'hljs'],
  span: [/^hljs-/],
};

// Protocolos permitidos em href/src.
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'data', 'ftp'];

/**
 * Sanitiza HTML com allowlist de tags, atributos, classes e protocolos.
 * @param {string} html
 * @returns {string} HTML sanitizado.
 */
function sanitizeHtmlContent(html) {
  if (typeof html !== 'string') {
    throw renderError('HTML inválido para sanitização: esperado string.');
  }
  try {
    return sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRS,
      allowedClasses: ALLOWED_CLASSES,
      allowedSchemes: ALLOWED_SCHEMES,
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
        a: ['http', 'https', 'mailto', 'ftp'],
      },
      allowProtocolRelative: false,
      // Remove tags não permitidas em vez de escapar (fail-closed).
      nonTextTags: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'title', 'head', 'noscript'],
    });
  } catch (err) {
    throw renderError(`Falha ao sanitizar HTML: ${err.message}`, { cause: err });
  }
}

module.exports = { sanitizeHtmlContent, ALLOWED_TAGS, ALLOWED_ATTRS };
