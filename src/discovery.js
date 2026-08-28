'use strict';

const fs = require('fs');
const path = require('path');
const { discoveryError } = require('./errors');

/**
 * Descobre arquivos regulares `.md` na raiz, sem recursão, em ordem
 * determinística (ordenação lexicográfica por nome).
 *
 * Aplica denylist padrão (case-insensitive) + denylist adicional configurável.
 * Não segue diretórios nem paths externos.
 *
 * @param {string} root Diretório raiz.
 * @param {string[]} [denylist] Nomes a excluir (case-insensitive).
 * @returns {string[]} Caminhos absolutos dos arquivos elegíveis, ordenados.
 */
function discoverMarkdown(root, denylist = []) {
  let entries;
  try {
    entries = fs.readdirSync(root);
  } catch (err) {
    throw discoveryError(`Não foi possível ler a raiz: ${err.message}`, { cause: err });
  }

  const deny = new Set(denylist.map((d) => d.toLowerCase()));
  const files = [];

  for (const entry of entries) {
    const full = path.join(root, entry);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch (err) {
      // Arquivo sumiu entre readdir e stat; ignorar (não é erro fatal).
      continue;
    }
    if (!stat.isFile()) continue; // não segue diretórios
    if (!entry.toLowerCase().endsWith('.md')) continue;
    if (deny.has(entry.toLowerCase())) continue;
    files.push(full);
  }

  // Ordem determinística (lexicográfica por nome de arquivo).
  files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return files;
}

/**
 * Detecta colisões de saída (dois documentos gerando o mesmo nome de saída).
 * @param {string[]} files Caminhos absolutos dos arquivos elegíveis.
 * @returns {Map<string, string[]>} Mapa de nome de saída -> arquivos colidentes.
 */
function detectOutputCollisions(files) {
  const byName = new Map();
  for (const f of files) {
    const base = path.basename(f, '.md');
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base).push(f);
  }
  const collisions = new Map();
  for (const [name, list] of byName) {
    if (list.length > 1) collisions.set(name, list);
  }
  return collisions;
}

/**
 * Preflight de discovery: descobre arquivos e valida colisões/overwrite.
 * @param {string} root
 * @param {object} [options] { denylist, outputDir }
 * @returns {{ files: string[], collisions: Map<string,string[]> }}
 */
function preflight(root, options = {}) {
  const files = discoverMarkdown(root, options.denylist || []);
  const collisions = detectOutputCollisions(files);
  if (collisions.size > 0) {
    const names = Array.from(collisions.keys()).join(', ');
    throw discoveryError(`Colisão de saída detectada para: ${names}.`);
  }
  return { files, collisions };
}

module.exports = {
  discoverMarkdown,
  detectOutputCollisions,
  preflight,
};
