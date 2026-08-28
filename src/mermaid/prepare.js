'use strict';

const { DEFAULT_CDN } = require('../config');

/**
 * Preparação de Mermaid para renderização via CDN pinada.
 *
 * - Converte blocos `.mermaid` em containers persistente com id de render
 *   distinto (mermaid.render remove o elemento com o id informado).
 * - Readiness determinístico: marcador global só sinaliza após todos os
 *   diagramas terminarem (renderizados ou erro).
 * - securityLevel 'strict' impede execução de conteúdo ativo.
 */

/**
 * Gera o script de inicialização Mermaid embutido no template.
 * @param {object} [options] { cdnUrl }
 * @returns {string} script HTML
 */
function mermaidBootstrapScript({ cdnUrl = DEFAULT_CDN.mermaid } = {}) {
  return `
<script src="${cdnUrl}"></script>
<script>
  window.__mermaidState = { total: 0, rendered: 0, errors: [] };
  window.__mermaidReady = false;
  function initMermaid() {
    const els = document.querySelectorAll('.mermaid');
    window.__mermaidState.total = els.length;
    if (els.length === 0) { window.__mermaidReady = true; return; }
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
    els.forEach((el, i) => {
      const renderId = 'mermaid-render-' + i;
      const container = document.createElement('div');
      container.className = 'mermaid-container';
      container.id = 'mermaid-container-' + i;
      el.replaceWith(container);
      mermaid.render(renderId, el.textContent).then(({ svg }) => {
        container.innerHTML = svg;
        window.__mermaidState.rendered++;
        if (window.__mermaidState.rendered === window.__mermaidState.total) {
          window.__mermaidReady = true;
        }
      }).catch((err) => {
        window.__mermaidState.errors.push(String(err));
        window.__mermaidState.rendered++;
        if (window.__mermaidState.rendered === window.__mermaidState.total) {
          window.__mermaidReady = true;
        }
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMermaid);
  } else {
    initMermaid();
  }
</script>`;
}

module.exports = { mermaidBootstrapScript };
