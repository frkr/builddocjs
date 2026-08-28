'use strict';

const { DEFAULT_CDN } = require('../config');
const { mermaidBootstrapScript } = require('../mermaid/prepare');

/**
 * Template HTML completo com CSS A4 profissional, CSP, headers/footers e
 * bootstrap de Mermaid/highlight.js via CDN pinada.
 *
 * Não injeta conteúdo sem sanitização (o HTML de entrada já é sanitizado).
 */

const A4_CSS = `
@page {
  size: A4;
  margin: 1.5cm;
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1f2328;
  margin: 0;
}
h1 { font-size: 22pt; color: #111; margin: 0 0 12pt; padding-bottom: 6pt; border-bottom: 2px solid #333; page-break-after: avoid; }
h2 { font-size: 17pt; color: #222; margin: 18pt 0 8pt; page-break-after: avoid; }
h3 { font-size: 14pt; color: #333; margin: 14pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 12pt; color: #444; margin: 12pt 0 6pt; page-break-after: avoid; }
p { margin: 0 0 10pt; }
ul, ol { margin: 0 0 10pt; padding-left: 22pt; }
li { margin-bottom: 4pt; }
blockquote { border-left: 4px solid #d0d7de; margin: 12pt 0; padding: 4pt 12pt; color: #57606a; }
a { color: #0969da; text-decoration: none; }
code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 0.9em; background: #f6f8fa; padding: 1pt 4pt; border-radius: 3pt; }
pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 5pt; padding: 10pt; margin: 12pt 0; overflow-x: auto; page-break-inside: avoid; }
pre code { background: transparent; padding: 0; white-space: pre-wrap; word-break: break-word; }
pre.terminal { background: #0d1117; color: #c9d1d9; border-color: #30363d; }
pre.terminal code { color: #c9d1d9; }
table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; }
th, td { border: 1px solid #d0d7de; padding: 6pt 8pt; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
img { max-width: 100%; height: auto; page-break-inside: avoid; }
.mermaid, .mermaid-container { text-align: center; margin: 16pt 0; page-break-inside: avoid; }
.mermaid-container svg { max-width: 100%; height: auto; }
.table-wrapper { overflow-x: auto; }
@media print {
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

/**
 * Gera o HTML completo.
 * @param {object} params { title, bodyHtml, config }
 * @returns {string}
 */
function renderTemplate({ title, bodyHtml, config }) {
  const cdn = config.cdn || DEFAULT_CDN;
  const mermaidEnabled = config.mermaidEnabled !== false;
  const highlightEnabled = config.highlightEnabled !== false;

  // CSP: script apenas do origin local e hosts/paths pinados da CDN.
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'", // necessário para o bootstrap inline
    `https://cdn.jsdelivr.net`,
  ].join(' ');

  const styleSrc = [
    "'self'",
    "'unsafe-inline'",
    `https://cdn.jsdelivr.net`,
  ].join(' ');

  const highlightCss = highlightEnabled
    ? `<link rel="stylesheet" href="${cdn.highlightCss}">`
    : '';

  const highlightScript = highlightEnabled
    ? `
<script src="${cdn.highlightJs}"></script>
<script>
  window.__hlReady = false;
  function initHighlight() {
    const blocks = document.querySelectorAll('pre code');
    if (blocks.length === 0) { window.__hlReady = true; return; }
    blocks.forEach((el) => { try { hljs.highlightElement(el); } catch (_) {} });
    window.__hlReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHighlight);
  else initHighlight();
</script>`
    : '';

  const mermaidScript = mermaidEnabled ? mermaidBootstrapScript({ cdnUrl: cdn.mermaid }) : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src ${styleSrc}; script-src ${scriptSrc}; font-src 'self' data:; connect-src 'self'">
<title>${escapeTitle(title)}</title>
${highlightCss}
<style>${A4_CSS}</style>
</head>
<body>
${bodyHtml}
${highlightScript}
${mermaidScript}
</body>
</html>`;
}

function escapeTitle(s) {
  const AMP = '&' + 'amp;';
  const LT = '&' + 'lt;';
  const GT = '&' + 'gt;';
  const QUOT = '&' + 'quot;';
  return String(s)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
}

module.exports = { renderTemplate, A4_CSS };
