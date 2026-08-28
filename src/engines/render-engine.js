'use strict';

/**
 * Contrato de engine de renderização.
 *
 * Uma engine deve implementar:
 * - probe(): valida o ambiente (path, versão, arquitetura) sem renderizar.
 * - start(): inicia a engine (launch do browser) e retorna um handle.
 * - render(handle, { html, url, config }): renderiza e retorna o PDF (Buffer).
 * - stop(handle): encerra a engine e limpa PID/árvore.
 *
 * Nenhuma engine baixa browser.
 */

class RenderEngine {
  async probe() {
    throw new Error('RenderEngine.probe() não implementado');
  }
  async start() {
    throw new Error('RenderEngine.start() não implementado');
  }
  async render() {
    throw new Error('RenderEngine.render() não implementado');
  }
  async stop() {
    throw new Error('RenderEngine.stop() não implementado');
  }
}

module.exports = { RenderEngine };
