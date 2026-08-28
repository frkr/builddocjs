'use strict';

const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { RenderEngine } = require('./render-engine');
const { browserError, timeoutError } = require('../errors');
const { DEFAULT_CDN } = require('../config');

/**
 * Adapter Chromium via puppeteer-core.
 *
 * - Path explícito e validado; não detecta Chrome/Edge nem baixa browser.
 * - Possui o processo filho por PID/árvore (nunca por nome).
 * - Controle de rede fail-closed: permite loopback/data e apenas as URLs
 *   pinadas da CDN (Mermaid/highlight.js) quando habilitadas.
 * - Timeout encerra a árvore e preserva a causa primária.
 * - stop() é garantido: fecha o browser e, se necessário, mata a árvore por PID.
 */

const ALLOWED_CDN = new Set([
  DEFAULT_CDN.mermaid,
  DEFAULT_CDN.highlightJs,
  DEFAULT_CDN.highlightCss,
]);

class ChromiumEngine extends RenderEngine {
  /**
   * @param {object} config Configuração (chromiumPath, timeoutMs, network, cdn).
   */
  constructor(config) {
    super();
    this.config = config;
    this.browser = null;
    this.pid = null;
    this.child = null;
  }

  /**
   * Valida o path do Chromium (arquivo regular e executável).
   * @returns {string} path validado.
   */
  probe() {
    const p = this.config.chromiumPath;
    let stat;
    try {
      stat = fs.statSync(p);
    } catch (err) {
      throw browserError(`Chromium não encontrado no path configurado.`, { cause: err });
    }
    if (!stat.isFile()) {
      throw browserError(`Chromium path não é um arquivo regular: ${p}`);
    }
    if (!(stat.mode & 0o111)) {
      throw browserError(`Chromium path não é executável: ${p}`);
    }
    return p;
  }

  /**
   * Inicia o Chromium headless como filho direto.
   * @returns {Promise<ChromiumEngine>}
   */
  async start() {
    const executablePath = this.probe();
    try {
      this.browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.child = this.browser.process() || null;
      this.pid = this.child ? this.child.pid : null;
      return this;
    } catch (err) {
      throw browserError(`Falha ao iniciar Chromium: ${err.message}`, { cause: err });
    }
  }

  /**
   * Configura interceptação de rede fail-closed na página.
   * @param {import('puppeteer-core').Page} page
   */
  async setupNetworkControl(page) {
    await page.setRequestInterception(true);
    const network = this.config.network || {};
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('about:')) { req.continue(); return; }
      if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) { req.continue(); return; }
      if (network.allowMermaidCdn && url === (this.config.cdn || {}).mermaid) { req.continue(); return; }
      if (network.allowHighlightCdn && (url === (this.config.cdn || {}).highlightJs || url === (this.config.cdn || {}).highlightCss)) { req.continue(); return; }
      req.abort();
    });
  }

  /**
   * Mata a árvore de processos do Chromium iniciada por este job, por PID
   * (nunca por nome). Tenta o grupo de processos primeiro (SIGKILL no -pid);
   * se o filho não for líder de grupo, mata o filho direto.
   * @returns {boolean} true se algum sinal foi enviado.
   */
  killTree() {
    const pid = this.pid;
    if (!pid) return false;
    let sent = false;
    try {
      // Grupo de processos (árvore inteira iniciada pelo job).
      process.kill(-pid, 'SIGKILL');
      sent = true;
    } catch (_) { /* não é líder de grupo ou já morto */ }
    if (this.child && typeof this.child.kill === 'function') {
      try {
        this.child.kill('SIGKILL');
        sent = true;
      } catch (_) { /* já morto */ }
    }
    return sent;
  }

  /**
   * Renderiza HTML para PDF.
   * @param {object} opts { html, url, config }
   * @returns {Promise<Buffer>} PDF
   */
  async render(opts) {
    if (!this.browser) throw browserError('Engine não iniciada.');
    const { html, url } = opts;
    const page = await this.browser.newPage();
    await this.setupNetworkControl(page);

    const timeoutMs = this.config.timeoutMs || 30000;

    // Timeout de renderização: fecha a página e rejeita a renderização.
    // Não mata o browser aqui (o stop() é responsável pelo encerramento),
    // mas garante que render() não fique pendente para sempre.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      page.close().catch(() => {});
    }, timeoutMs);

    try {
      if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      } else {
        await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html), {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        });
      }
      // Aguardar readiness de Mermaid/highlight se presentes.
      await Promise.race([
        page.waitForFunction(
          'window.__mermaidReady === undefined || window.__mermaidReady === true',
          { timeout: timeoutMs }
        ),
        page.waitForFunction(
          'window.__hlReady === undefined || window.__hlReady === true',
          { timeout: timeoutMs }
        ),
      ]);

      const margin = this.config.margin || { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' };
      const pdfBytes = await page.pdf({
        format: this.config.format || 'A4',
        printBackground: this.config.printBackground !== false,
        printHeaderFooter: this.config.printHeaderFooter !== false,
        margin,
      });
      if (timedOut) {
        throw timeoutError('Timeout ao renderizar PDF: operação excedeu o limite.');
      }
      return Buffer.from(pdfBytes);
    } catch (err) {
      if (timedOut || /timeout/i.test(err.message)) {
        throw timeoutError(`Timeout ao renderizar PDF: ${err.message}`, { cause: err });
      }
      throw browserError(`Falha ao renderizar PDF: ${err.message}`, { cause: err });
    } finally {
      clearTimeout(timer);
      await page.close().catch(() => {});
    }
  }

  /**
   * Encerra o browser e limpa PID/árvore.
   * Garantido: fecha o browser com um limite de tempo e, se o processo ainda
   * existir, mata a árvore por PID como fallback. Nunca deixa processo para trás.
   */
  async stop() {
    const pid = this.pid;
    if (this.browser) {
      // browser.close() pode travar se o Chromium estiver irresponsivo; damos
      // um limite curto e seguimos para o kill por PID como fallback.
      await Promise.race([
        this.browser.close().catch(() => {}),
        new Promise((res) => {
          const t = setTimeout(res, 3000);
          t.unref?.();
        }),
      ]);
      this.browser = null;
    }
    // Fallback: se o processo ainda estiver vivo, mata a árvore por PID.
    if (pid && this.isAlive(pid)) {
      this.killTree();
    }
    this.pid = null;
    this.child = null;
  }

  /**
   * Verifica se um PID ainda está vivo (sem matar por nome).
   * @param {number} pid
   * @returns {boolean}
   */
  isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  }
}

module.exports = { ChromiumEngine, ALLOWED_CDN };
