'use strict';

/**
 * Preparação de blocos de código para highlight.js via CDN.
 *
 * O destaque é aplicado no browser (highlight.js carregado de CDN pinada),
 * sem execução de snippets. Este módulo apenas garante que os blocos tenham
 * as classes corretas e que o terminal tenha semântica própria.
 */

/**
 * Garante que blocos de código tenham a classe `hljs` para o highlight.js
 * processar, preservando a classe de linguagem.
 * @param {string} html HTML sanitizado.
 * @returns {string}
 */
function prepareCodeBlocks(html) {
  // Adiciona classe hljs a <code class="language-..."> que ainda não a tem.
  return html.replace(
    /<code class="language-([^"]+)"([^>]*)>/g,
    (match, lang, rest) => {
      if (/hljs/.test(rest)) return match;
      return `<code class="language-${lang} hljs"${rest}>`;
    }
  );
}

/**
 * Extrai a lista de linguagens presentes nos blocos de código.
 * @param {string} html
 * @returns {string[]}
 */
function extractLanguages(html) {
  const langs = new Set();
  const re = /class="language-([^"\s]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    langs.add(m[1]);
  }
  return Array.from(langs);
}

module.exports = { prepareCodeBlocks, extractLanguages };
