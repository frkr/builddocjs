'use strict';

const fs = require('fs');
const path = require('path');
const { preflight } = require('../discovery');
const { parseMarkdown } = require('../markdown/parse');
const { sanitizeHtmlContent } = require('../html/sanitize');
const { inlineAssets } = require('../assets/resolve');
const { prepareCodeBlocks } = require('../highlight/render');
const { renderTemplate } = require('../template/render');
const { startLoopback } = require('../server/loopback');
const { ChromiumEngine } = require('../engines/chromium');
const { validatePdf } = require('../pdf/validate');
const { publishPdf, sha256 } = require('./publish');
const { redactConfig } = require('../config');
const { Observability } = require('../observability');
const { BuildDocError, ErrorCodes } = require('../errors');

/**
 * Orquestra o lote: discovery → pipeline HTML → engine → PDF → validação →
 * publicação atômica → manifest.
 *
 * Execução inicial é sequencial. Não conhece detalhes Puppeteer.
 */

/**
 * Constrói o HTML intermediário para um documento.
 * @param {string} mdFile
 * @param {object} cfg
 * @returns {string} HTML completo
 */
function buildDocumentHtml(mdFile, cfg) {
  const markdown = fs.readFileSync(mdFile, 'utf8');
  const title = path.basename(mdFile, '.md');
  const docDir = path.dirname(mdFile);

  let html = parseMarkdown(markdown);
  html = sanitizeHtmlContent(html);
  html = inlineAssets(html, docDir, cfg.root);
  html = prepareCodeBlocks(html);
  return renderTemplate({ title, bodyHtml: html, config: cfg });
}

/**
 * Processa um único documento.
 * @param {string} mdFile
 * @param {object} cfg
 * @param {ChromiumEngine} engine
 * @param {Observability} obs
 * @returns {object} resultado do documento
 */
async function processDocument(mdFile, cfg, engine, obs) {
  const name = path.basename(mdFile, '.md');
  const started = Date.now();
  const html = buildDocumentHtml(mdFile, cfg);

  // Servir via loopback tokenizado (menor privilégio).
  const loopback = await startLoopback({ html });
  try {
    const pdf = await engine.render({ html, url: loopback.url, config: cfg });
    const analysis = validatePdf(pdf, { minPages: 1, requireA4: true, requireText: true });

    const htmlDest = path.join(cfg.root, cfg.outputDir, cfg.htmlDir, `${name}.html`);
    const pdfDest = path.join(cfg.root, cfg.outputDir, cfg.pdfDir, `${name}.pdf`);
    fs.mkdirSync(path.dirname(htmlDest), { recursive: true });
    fs.writeFileSync(htmlDest, html, 'utf8');
    const published = publishPdf(pdf, pdfDest);

    obs.increment('documents_ok');
    return {
      name,
      status: 'ok',
      html: htmlDest,
      pdf: published.path,
      sha256: published.sha256,
      bytes: published.bytes,
      pages: analysis.pageCount,
      durationMs: Date.now() - started,
    };
  } finally {
    await loopback.close();
  }
}

/**
 * Executa o lote completo sob um timeout global rígido.
 * No vencimento, encerra a árvore do Chromium por PID, fecha o browser e
 * preserva a causa primária (o erro original, se houver).
 * @param {object} cfg Configuração validada.
 * @returns {Promise<object>} resumo do lote
 */
async function runBatch(cfg) {
  const obs = new Observability();
  obs.emit('batch_start', { config: redactConfig(cfg) });

  const { files } = preflight(cfg.root, { denylist: cfg.denylist });
  obs.emit('discovery', { count: files.length });

  const engine = new ChromiumEngine(cfg);
  await engine.start();
  obs.emit('engine_start', { pid: engine.pid });

  const results = [];
  let failed = 0;

  // Timeout global rígido: se o lote exceder o limite, mata a árvore do
  // Chromium por PID e rejeita com timeoutError, preservando a causa primária.
  const hardTimeoutMs = cfg.hardTimeoutMs || cfg.timeoutMs * files.length + 15000;
  let hardTimer = null;
  let hardTimedOut = false;
  let primaryError = null;

  const run = (async () => {
    for (const mdFile of files) {
      try {
        const r = await processDocument(mdFile, cfg, engine, obs);
        results.push(r);
        obs.emit('document_ok', { name: r.name, pages: r.pages });
      } catch (err) {
        failed++;
        const name = path.basename(mdFile, '.md');
        results.push({ name, status: 'error', error: err.message });
        obs.emit('document_error', { name, code: err.code || ErrorCodes.INTERNAL });
      }
    }
  })();

  try {
    await Promise.race([
      run,
      new Promise((_, reject) => {
        hardTimer = setTimeout(() => {
          hardTimedOut = true;
          reject(timeoutError('Timeout global do lote: encerrando Chromium.'));
        }, hardTimeoutMs);
      }),
    ]);
  } catch (err) {
    primaryError = err;
    throw err;
  } finally {
    if (hardTimer) clearTimeout(hardTimer);
    try {
      await engine.stop();
    } catch (stopErr) {
      // Preserva a causa primária; registra a falha de encerramento.
      if (!primaryError) primaryError = stopErr;
    }
    obs.emit('engine_stop', { hardTimedOut });
    if (hardTimedOut && primaryError) throw primaryError;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    config: redactConfig(cfg),
    documents: results,
    summary: {
      total: files.length,
      ok: results.filter((r) => r.status === 'ok').length,
      failed,
      durationMs: Date.now() - obs.startedAt,
    },
    observability: obs.summary(),
  };

  const manifestDest = path.join(cfg.root, cfg.outputDir, 'manifest.json');
  fs.mkdirSync(path.dirname(manifestDest), { recursive: true });
  fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2), 'utf8');

  if (failed > 0) {
    throw new BuildDocError(ErrorCodes.RENDER, `${failed} documento(s) falharam.`, {
      category: 'batch',
      details: { failed },
    });
  }
  return manifest;
}

module.exports = { runBatch, buildDocumentHtml, processDocument };
