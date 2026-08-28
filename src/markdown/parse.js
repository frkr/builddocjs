'use strict';

const { marked } = require('marked');
const { renderError } = require('../errors');

/**
 * Converte Markdown/GFM para HTML por tokens/AST (via marked), reconhecendo
 * Mermaid e variantes de código/terminal.
 *
 * - GFM habilitado.
 * - IDs determinísticos de headings.
 * - Blocos de código `mermaid` são convertidos em `<div class="mermaid">`.
 * - Blocos de código `terminal` são convertidos em `<pre class="terminal">`.
 * - Não usa regex sobre HTML final para reconhecer Mermaid (usa o tokenizer).
 */

// Renderer customizado para headings com IDs determinísticos.
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Entidades HTML construídas via fromCharCode para evitar decodificação
// indesejada ao gravar o arquivo (o gravador decodifica &/</>/").
const AMP = '&' + 'amp;';
const LT = '&' + 'lt;';
const GT = '&' + 'gt;';
const QUOT = '&' + 'quot;';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
}

function escapeAttr(s) {
  return String(s).replace(/"/g, QUOT).replace(/</g, LT);
}

/**
 * Converte Markdown para HTML.
 * @param {string} markdown
 * @returns {string} HTML intermediário (ainda não sanitizado).
 */
function parseMarkdown(markdown) {
  if (typeof markdown !== 'string') {
    throw renderError('Markdown inválido: esperado string.');
  }
  try {
    const renderer = new marked.Renderer();

    // marked v11: renderer.heading(text, level, raw)
    renderer.heading = (text, level) => {
      const id = slugify(text);
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    // marked v11: renderer.code(text, lang, escaped)
    renderer.code = (text, lang) => {
      const language = (lang || '').toLowerCase();
      if (language === 'mermaid') {
        return `<div class="mermaid">${text.trim()}</div>`;
      }
      if (language === 'terminal') {
        return `<pre class="terminal"><code>${escapeHtml(text)}</code></pre>`;
      }
      const langClass = language ? ` class="language-${escapeAttr(language)}"` : '';
      return `<pre><code${langClass}>${escapeHtml(text)}</code></pre>`;
    };

    // Aplica o renderer customizado via marked.use (API estável do marked v11).
    const instance = marked.use({ renderer });
    return instance.parse(markdown, { gfm: true, breaks: true });
  } catch (err) {
    throw renderError(`Falha ao converter Markdown: ${err.message}`, { cause: err });
  }
}

module.exports = { parseMarkdown, slugify };
