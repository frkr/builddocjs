'use strict';

/**
 * Códigos de erro estáveis do BuildDocJS.
 * Cada falha retorna um código não-zero estável e logs redigidos.
 */
const ErrorCodes = Object.freeze({
  OK: 0,
  USAGE: 1,
  CONFIG: 2,
  DISCOVERY: 3,
  BROWSER: 4,
  RENDER: 5,
  PDF: 6,
  PUBLISH: 7,
  TIMEOUT: 8,
  INTERNAL: 9,
});

/**
 * Erro de domínio do BuildDocJS com código estável e categoria.
 */
class BuildDocError extends Error {
  /**
   * @param {number} code Código estável (ErrorCodes).
   * @param {string} message Mensagem redigida (sem conteúdo de cliente).
   * @param {object} [options] { cause, category, details }
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'BuildDocError';
    this.code = code;
    this.category = options.category || 'generic';
    this.cause = options.cause;
    this.details = options.details;
  }
}

/**
 * Cria um erro de uso de CLI.
 */
function usageError(message, options = {}) {
  return new BuildDocError(ErrorCodes.USAGE, message, { category: 'usage', ...options });
}

/**
 * Cria um erro de configuração.
 */
function configError(message, options = {}) {
  return new BuildDocError(ErrorCodes.CONFIG, message, { category: 'config', ...options });
}

/**
 * Cria um erro de discovery.
 */
function discoveryError(message, options = {}) {
  return new BuildDocError(ErrorCodes.DISCOVERY, message, { category: 'discovery', ...options });
}

/**
 * Cria um erro de browser/Chromium.
 */
function browserError(message, options = {}) {
  return new BuildDocError(ErrorCodes.BROWSER, message, { category: 'browser', ...options });
}

/**
 * Cria um erro de renderização.
 */
function renderError(message, options = {}) {
  return new BuildDocError(ErrorCodes.RENDER, message, { category: 'render', ...options });
}

/**
 * Cria um erro de PDF.
 */
function pdfError(message, options = {}) {
  return new BuildDocError(ErrorCodes.PDF, message, { category: 'pdf', ...options });
}

/**
 * Cria um erro de publicação.
 */
function publishError(message, options = {}) {
  return new BuildDocError(ErrorCodes.PUBLISH, message, { category: 'publish', ...options });
}

/**
 * Cria um erro de timeout.
 */
function timeoutError(message, options = {}) {
  return new BuildDocError(ErrorCodes.TIMEOUT, message, { category: 'timeout', ...options });
}

module.exports = {
  ErrorCodes,
  BuildDocError,
  usageError,
  configError,
  discoveryError,
  browserError,
  renderError,
  pdfError,
  publishError,
  timeoutError,
};
