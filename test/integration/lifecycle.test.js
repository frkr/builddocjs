'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Verifica que nenhum processo Chromium do job fica para trás após um run.
 *
 * O teste executa o pipeline real (node src/cli.js) sobre uma fixture sintética
 * e confirma que, ao final, não há processo Chromium do aplicativo vivo.
 *
 * Nota: o teste depende do Chromium externo instalado (cask Homebrew). Se o
 * path não existir, o teste é pulado (skip) para não falhar em ambientes sem
 * browser — o gate de browser é responsabilidade do workstream de gate.
 */

const CHROMIUM_PATH = '/Applications/Chromium.app/Contents/MacOS/Chromium';

function chromiumExists() {
  try {
    return fs.statSync(CHROMIUM_PATH).isFile();
  } catch (_) {
    return false;
  }
}

function countChromiumProcesses() {
  try {
    const out = execFileSync('ps', ['aux'], { encoding: 'utf8' });
    return out
      .split('\n')
      .filter((line) => line.includes('Chromium.app/Contents/MacOS/Chromium'))
      .length;
  } catch (_) {
    return 0;
  }
}

test('pipeline: não deixa processo Chromium para trás após run', { skip: !chromiumExists() }, async () => {
  // Cria um diretório temporário com uma fixture sintética (sem dados de cliente).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'builddocjs-lifecycle-'));
  const fixture = path.join(tmp, 'sample.md');
  fs.writeFileSync(
    fixture,
    [
      '# Documento Sintético',
      '',
      '> Fixture de teste de ciclo de vida. Sem dados de cliente.',
      '',
      '## Seção',
      '',
      'Conteúdo de teste.',
      '',
      '```javascript',
      'const x = 1;',
      '```',
      '',
    ].join('\n'),
    'utf8'
  );

  const cli = path.join(__dirname, '..', '..', 'src', 'cli.js');
  // O CLI resolve a saída como path.join(root, outputDir, ...); usamos um
  // diretório relativo para que o PDF fique em tmp/build/pdf/sample.pdf.
  const outputDir = 'build';

  try {
    // Executa o pipeline completo (renderiza PDF real).
    execFileSync(process.execPath, [cli, '--root', tmp, '--output-dir', outputDir], {
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, BUILDDOC_CHROMIUM_PATH: CHROMIUM_PATH },
    });

    // Confirma que o PDF foi gerado.
    const pdf = path.join(tmp, outputDir, 'pdf', 'sample.pdf');
    assert.ok(fs.existsSync(pdf), 'PDF deve ter sido gerado');

    // Confirma que não há processo Chromium do aplicativo vivo.
    assert.strictEqual(countChromiumProcesses(), 0, 'Não deve haver processo Chromium do job vivo');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
