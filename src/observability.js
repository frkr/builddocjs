'use strict';

/**
 * Observabilidade local: eventos, redaction e métricas.
 * Nunca registra conteúdo de cliente (Markdown/HTML/data URI).
 */

/**
 * Redige valores sensíveis de um objeto para logs.
 * @param {object} obj
 * @returns {object}
 */
function redact(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (/path|secret|token|key|password|content|html|markdown|data/i.test(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Coletor de eventos e métricas locais.
 */
class Observability {
  constructor() {
    this.events = [];
    this.metrics = new Map();
    this.startedAt = Date.now();
  }

  /**
   * Registra um evento redigido.
   * @param {string} type
   * @param {object} [data]
   */
  emit(type, data = {}) {
    const entry = { type, ts: Date.now(), ...redact(data) };
    this.events.push(entry);
    return entry;
  }

  /**
   * Incrementa uma métrica.
   * @param {string} name
   * @param {number} [delta]
   */
  increment(name, delta = 1) {
    this.metrics.set(name, (this.metrics.get(name) || 0) + delta);
  }

  /**
   * Define uma métrica.
   * @param {string} name
   * @param {number} value
   */
  setMetric(name, value) {
    this.metrics.set(name, value);
  }

  /**
   * Retorna um resumo redigido (eventos + métricas + duração).
   * @returns {object}
   */
  summary() {
    return {
      durationMs: Date.now() - this.startedAt,
      events: this.events,
      metrics: Object.fromEntries(this.metrics),
    };
  }
}

module.exports = { Observability, redact };
