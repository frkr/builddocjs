'use strict';

const path = require('path');
const { configError } = require('./errors');

/**
 * Caminho esperado do cask Homebrew no macOS (candidato, precisa existir).
 */
const DEFAULT_CHROMIUM_PATH = '/Applications/Chromium.app/Contents/MacOS/Chromium';

/**
 * URLs pinadas das bibliotecas via CDN (versão exata, arquivo exato).
 */
const DEFAULT_CDN = Object.freeze({
  mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
  highlightJs: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js',
  highlightCss: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css',
});

/**
 * Denylist padrão de documentos de governança (case-insensitive).
 */
const DEFAULT_DENYLIST = Object.freeze(['README.md', 'AGENTS.md', 'ARCHITECTURE_PLAN.md']);

/**
 * Defaults de configuração.
 */
const DEFAULTS = Object.freeze({
  root: process.cwd(),
  outputDir: 'build',
  htmlDir: 'html',
  pdfDir: 'pdf',
  chromiumPath: DEFAULT_CHROMIUM_PATH,
  denylist: [...DEFAULT_DENYLIST],
  margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
  format: 'A4',
  printBackground: true,
  printHeaderFooter: true,
  timeoutMs: 30000,
  hardTimeoutMs: 0, // 0 = derivado automaticamente (timeoutMs * docs + margem)
  cdn: { ...DEFAULT_CDN },
  mermaidEnabled: true,
  highlightEnabled: true,
  network: { allowMermaidCdn: true, allowHighlightCdn: true },
});

/**
 * Valida o schema de configuração, lançando configError em caso de invalidez.
 * @param {object} cfg
 */
function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') {
    throw configError('Configuração inválida: esperado objeto.');
  }
  if (typeof cfg.root !== 'string' || cfg.root.length === 0) {
    throw configError('Configuração inválida: root deve ser um caminho não vazio.');
  }
  if (typeof cfg.chromiumPath !== 'string' || cfg.chromiumPath.length === 0) {
    throw configError('Configuração inválida: chromiumPath deve ser um caminho não vazio.');
  }
  if (!Array.isArray(cfg.denylist)) {
    throw configError('Configuração inválida: denylist deve ser um array.');
  }
  if (typeof cfg.timeoutMs !== 'number' || cfg.timeoutMs <= 0) {
    throw configError('Configuração inválida: timeoutMs deve ser um número positivo.');
  }
  if (cfg.margin && typeof cfg.margin !== 'object') {
    throw configError('Configuração inválida: margin deve ser um objeto.');
  }
  return cfg;
}

/**
 * Mescla defaults com configuração fornecida (precedência: fornecida > default).
 * @param {object} [overrides]
 * @returns {object} configuração validada
 */
function loadConfig(overrides = {}) {
  const cfg = {
    ...DEFAULTS,
    ...overrides,
    margin: { ...DEFAULTS.margin, ...(overrides.margin || {}) },
    cdn: { ...DEFAULTS.cdn, ...(overrides.cdn || {}) },
    network: { ...DEFAULTS.network, ...(overrides.network || {}) },
    denylist: overrides.denylist ? [...overrides.denylist] : [...DEFAULTS.denylist],
  };
  return validateConfig(cfg);
}

/**
 * Resolve a precedência do caminho Chromium:
 * opção explícita > variável de ambiente > configuração > caminho esperado do cask.
 * @param {object} cfg
 * @param {object} [env]
 * @param {string} [cliPath]
 * @returns {string}
 */
function resolveChromiumPath(cfg, env = process.env, cliPath) {
  if (cliPath) return cliPath;
  if (env.BUILDDOC_CHROMIUM_PATH) return env.BUILDDOC_CHROMIUM_PATH;
  return cfg.chromiumPath;
}

/**
 * Retorna uma configuração redigida (sem paths absolutos de logs normais,
 * sem conteúdo de cliente). Usada para manifest/logs.
 * @param {object} cfg
 * @returns {object}
 */
function redactConfig(cfg) {
  return {
    root: path.basename(cfg.root) || cfg.root,
    outputDir: cfg.outputDir,
    format: cfg.format,
    margin: cfg.margin,
    printBackground: cfg.printBackground,
    printHeaderFooter: cfg.printHeaderFooter,
    timeoutMs: cfg.timeoutMs,
    mermaidEnabled: cfg.mermaidEnabled,
    highlightEnabled: cfg.highlightEnabled,
    network: cfg.network,
    // chromiumPath é omitido (não expor path absoluto em logs normais)
  };
}

module.exports = {
  DEFAULTS,
  DEFAULT_CHROMIUM_PATH,
  DEFAULT_DENYLIST,
  DEFAULT_CDN,
  loadConfig,
  validateConfig,
  resolveChromiumPath,
  redactConfig,
};
